import 'server-only'

import type { AnswerPayload } from './render/answer-ast'
import type { EngineContext, SlotKey, Slots } from './intents/types'
import { INTENT_CATALOG } from './intents/catalog'
import { RESOLVERS } from './intents/registry'
import { tokenize } from './nlu/tokenize'
import { classify, type ClassifierResult } from './nlu/intent-classifier'
import { extractPeriod } from './nlu/slots/period'
import { extractMoney } from './nlu/slots/money'
import { extractOrdering } from './nlu/slots/ordering'
import { extractQuery } from './nlu/slots/query'
import { extractCategory } from './nlu/slots/category'
import { extractAccount } from './nlu/slots/account'
import { extractMerchant } from './nlu/slots/merchant'
import {
  listAvailableCategories,
  listUserAccountsBasic,
} from '@/lib/db/queries/transactions'
import {
  listMerchantsForUser,
  type MerchantRow,
  type MerchantsRange,
} from '@/lib/db/queries/merchants'
import {
  resolveTurn,
  pushTurn,
  EMPTY_CONTEXT,
  type ConversationContext,
  type ResolvedTurn,
} from './conversation/reducer'
import { buildFollowUps } from './conversation/follow-ups'

export type EngineResult = {
  payload: AnswerPayload
  nextContext: ConversationContext
  /** Telemetría: clasificación cruda del turno (sin elipsis aplicada). */
  classification: ClassifierResult
  /** Intent finalmente ejecutado (puede diferir si hubo elipsis). */
  resolvedIntent: string
  viaEllipsis: boolean
}

function presentKeys(slots: Slots): Set<SlotKey> {
  const set = new Set<SlotKey>()
  if (slots.period) set.add('period')
  if (slots.category) set.add('category')
  if (slots.merchant) set.add('merchant')
  if (slots.account) set.add('account')
  if (slots.money) set.add('money')
  if (slots.ordering) set.add('ordering')
  if (slots.query) set.add('query')
  return set
}

type Analysis = {
  resolved: ResolvedTurn
  classification: ClassifierResult
}

/**
 * Cache de listas base por invocación del engine. Memoiza las cargas que los
 * slot extractors necesitan (categorías, cuentas, merchants históricos) como
 * promesas, de modo que un fold de varios turnos comparta una sola query por
 * lista en vez de recargar en cada turno. Las claves se llenan perezosamente:
 * los merchants (caros) sólo se cargan si algún turno apunta a búsqueda.
 */
type RequestCache = {
  categories?: Promise<Awaited<ReturnType<typeof listAvailableCategories>>>
  accounts?: Promise<Awaited<ReturnType<typeof listUserAccountsBasic>>>
  merchants?: Promise<MerchantRow[]>
}

function loadCategories(ctx: EngineContext, cache: RequestCache) {
  return (cache.categories ??= listAvailableCategories(ctx.userId))
}
function loadAccounts(ctx: EngineContext, cache: RequestCache) {
  return (cache.accounts ??= listUserAccountsBasic(ctx.userId))
}
function loadMerchants(ctx: EngineContext, cache: RequestCache) {
  const range: MerchantsRange = {
    scope: 'this-year',
    from: '2000-01-01',
    to: ctx.todayIso,
    label: 'histórico',
  }
  return (cache.merchants ??= listMerchantsForUser(ctx.userId, range, { limit: 200 }))
}

/**
 * Extrae slots, clasifica y resuelve elipsis — SIN ejecutar el resolver. Usa
 * el cache para no recargar listas entre turnos del fold. Merchant se extrae
 * siempre que el turno apunte a búsqueda (también en turnos previos), de modo
 * que la continuidad de comercio no se pierde.
 */
async function analyze(
  message: string,
  ctx: EngineContext,
  context: ConversationContext,
  cache: RequestCache,
): Promise<Analysis> {
  const tokens = tokenize(message)
  const slots: Slots = {}

  const period = extractPeriod(message, ctx.todayIso)
  if (period) slots.period = period
  const moneySlot = extractMoney(message)
  if (moneySlot) slots.money = moneySlot
  const ordering = extractOrdering(message)
  if (ordering) slots.ordering = ordering
  const query = extractQuery(message)
  if (query) slots.query = query

  const [categories, accounts] = await Promise.all([
    loadCategories(ctx, cache),
    loadAccounts(ctx, cache),
  ])
  const [catRes, account] = await Promise.all([
    extractCategory(message, ctx.userId, categories),
    extractAccount(message, ctx.userId, accounts),
  ])
  if (catRes?.match) slots.category = catRes.match
  if (catRes?.candidates) slots.categoryCandidates = catRes.candidates
  if (account) slots.account = account

  let classification = classify(tokens, presentKeys(slots), INTENT_CATALOG)

  if (classification.intent === 'search-transactions' && !slots.merchant) {
    const merchants = await loadMerchants(ctx, cache)
    const merchant = await extractMerchant(message, ctx.userId, ctx.todayIso, merchants)
    if (merchant) {
      slots.merchant = merchant
      classification = classify(tokens, presentKeys(slots), INTENT_CATALOG)
    }
  }

  const resolved = resolveTurn({
    tokens,
    slots,
    presentSlots: presentKeys(slots),
    classification,
    context,
  })

  return { resolved, classification }
}

/**
 * Punto de entrada del motor heurístico. Tokeniza, extrae slots, clasifica,
 * resuelve elipsis con el contexto, despacha al resolver y adjunta follow-ups.
 * Nunca lanza: ante un fallo del resolver devuelve un mensaje legible.
 */
export async function runEngine(
  message: string,
  ctx: EngineContext,
  context: ConversationContext = EMPTY_CONTEXT,
  cache: RequestCache = {},
): Promise<EngineResult> {
  const { resolved, classification } = await analyze(message, ctx, context, cache)

  const payload = await dispatch(resolved.intent, resolved.slots, resolved.decision, ctx, {
    missingSlot: resolved.missingSlot,
    alternative: resolved.alternative,
  })

  if (resolved.decision === 'execute' && !payload.followUps) {
    const followUps = buildFollowUps(resolved.intent, resolved.slots)
    if (followUps.length > 0) payload.followUps = followUps
  }

  const nextContext = pushTurn(context, {
    utterance: message,
    intent: resolved.intent,
    slots: resolved.slots,
  })

  return {
    payload,
    nextContext,
    classification,
    resolvedIntent: resolved.intent,
    viaEllipsis: resolved.viaEllipsis,
  }
}

/**
 * Reconstruye el contexto conversacional plegando los turnos previos del
 * usuario (análisis barato, sin resolver ni merchant) y ejecuta el último.
 * Mantiene el flujo stateless: el server no persiste el contexto del
 * heurístico (efímero, no toca `messages`).
 */
export async function runEngineFromHistory(
  utterances: string[],
  ctx: EngineContext,
): Promise<EngineResult> {
  if (utterances.length === 0) {
    return runEngine('', ctx, EMPTY_CONTEXT)
  }
  const prior = utterances.slice(0, -1).slice(-4) // máx 4 turnos previos
  const last = utterances[utterances.length - 1] as string

  // Un solo cache compartido por todo el fold: las listas base se cargan una
  // vez aunque se reconstruyan varios turnos.
  const cache: RequestCache = {}
  let context = EMPTY_CONTEXT
  for (const u of prior) {
    const { resolved } = await analyze(u, ctx, context, cache)
    context = pushTurn(context, { utterance: u, intent: resolved.intent, slots: resolved.slots })
  }

  return runEngine(last, ctx, context, cache)
}

async function dispatch(
  intent: EngineResult['resolvedIntent'],
  slots: Slots,
  decision: ResolvedTurn['decision'],
  ctx: EngineContext,
  extra: { missingSlot?: SlotKey; alternative?: string },
): Promise<AnswerPayload> {
  if (slots.categoryCandidates && slots.categoryCandidates.length >= 2) {
    const [a, b] = slots.categoryCandidates
    return {
      intro: '¿A cuál categoría te refieres?',
      blocks: [{ type: 'text', body: 'Hay dos que encajan.' }],
      followUps: [
        { label: a!.name, utterance: `gasto en ${a!.name}` },
        { label: b!.name, utterance: `gasto en ${b!.name}` },
      ],
    }
  }

  if (decision === 'clarify-slot' && extra.missingSlot === 'account') {
    return {
      intro: '¿De cuál cuenta?',
      blocks: [{ type: 'text', body: 'Dime el nombre de la cuenta o "mi débito", "mi tarjeta".' }],
    }
  }

  if (decision === 'clarify-intent' && extra.alternative) {
    return {
      intro: 'Puedo entenderlo de dos formas.',
      blocks: [{ type: 'text', body: '¿Cuál buscas?' }],
      followUps: hintFor(intent).concat(hintFor(extra.alternative)),
    }
  }

  try {
    const resolver = RESOLVERS[intent as keyof typeof RESOLVERS] ?? RESOLVERS.help
    return await resolver(slots, ctx)
  } catch (err) {
    console.error('[copilot] resolver falló:', intent, err)
    return {
      intro: 'No pude completar la consulta.',
      blocks: [{ type: 'text', body: 'Intenta de nuevo en un momento.' }],
    }
  }
}

function hintFor(intent: string): Array<{ label: string; utterance: string }> {
  const map: Record<string, { label: string; utterance: string }> = {
    'show-balance': { label: 'Mi saldo', utterance: 'cuál es mi saldo' },
    'spend-by-category': { label: 'En qué gasté', utterance: 'en qué gasté este mes' },
    'monthly-summary': { label: 'Resumen del mes', utterance: 'resumen del mes' },
    'budget-status': { label: 'Presupuestos', utterance: 'cómo van mis presupuestos' },
  }
  const hit = map[intent]
  return hit ? [hit] : []
}
