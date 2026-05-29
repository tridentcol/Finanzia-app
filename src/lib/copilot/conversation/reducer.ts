import type { IntentId, SlotKey, Slots } from '../intents/types'
import type { ClassifierDecision, ClassifierResult } from '../nlu/intent-classifier'
import type { Tokens } from '../nlu/tokenize'

/**
 * Estado conversacional multi-turno. Efímero: vive en el dialog del copiloto
 * y se serializa hacia el server en cada turno para resolver elipsis. No toca
 * la tabla `messages`. PURO.
 */
export type TurnRecord = {
  utterance: string
  intent: IntentId
  slots: Slots
}

export type ConversationContext = {
  lastIntent: IntentId | null
  lastSlots: Slots
  /** Máximo 5 turnos, más reciente al final. */
  turnHistory: TurnRecord[]
}

export const EMPTY_CONTEXT: ConversationContext = {
  lastIntent: null,
  lastSlots: {},
  turnHistory: [],
}

const CONNECTOR_RE =
  /^(y|ademas|tambien|ahora|entonces|ok|dale|que tal|y que|y de|y ahora|y que pasa con)\b/

const SLOT_ONLY_KEYS: SlotKey[] = ['period', 'category', 'merchant', 'account', 'money']

/**
 * Redirección de dimensión en un follow-up: una frase de cambio de eje remapea
 * la continuación a otro intent, heredando los slots del turno previo. Solo usa
 * `lastIntent`/`lastSlots` (no requiere la respuesta anterior). Devuelve el
 * intent destino o null si la utterance no pide cambio de dimensión.
 */
function redirectIntent(
  text: string,
  lastIntent: IntentId,
  presentSlots: ReadonlySet<SlotKey>,
): IntentId | null {
  if (/\bpor categoria/.test(text) || /\ben que se (va|me va)\b/.test(text)) {
    return 'spend-by-category'
  }
  if (/\bpor (comercio|tienda)/.test(text) || /\bdonde (mas )?gaste\b/.test(text)) {
    return 'top-merchants'
  }
  if (/\bcomparad|vs (el )?mes pasado|\bcompara\b/.test(text)) {
    return 'compare-month'
  }
  if (
    presentSlots.has('account') &&
    (lastIntent === 'show-balance' || lastIntent === 'account-detail')
  ) {
    return 'account-detail'
  }
  return null
}

export type ResolvedTurn = {
  intent: IntentId
  slots: Slots
  decision: ClassifierDecision
  /** True si se interpretó como continuación elíptica del turno previo. */
  viaEllipsis: boolean
  missingSlot?: SlotKey
  alternative?: IntentId
}

/**
 * Aplica el contexto a la clasificación cruda. Si el classifier no encontró
 * señal fuerte (fallback o confidence ≤0.4) pero hay un intent previo y la
 * utterance trae un slot reconocible o arranca con un conector ("y la semana
 * pasada", "¿y por mes pasado?"), se interpreta como continuación: se reusa
 * `lastIntent` y se fusionan los slots (los nuevos pisan a los viejos).
 */
export function resolveTurn(params: {
  tokens: Tokens
  slots: Slots
  presentSlots: ReadonlySet<SlotKey>
  classification: ClassifierResult
  context: ConversationContext
}): ResolvedTurn {
  const { tokens, slots, presentSlots, classification, context } = params

  const startsWithConnector = CONNECTOR_RE.test(tokens.text)
  const hasSlot = SLOT_ONLY_KEYS.some((k) => presentSlots.has(k))
  const weak =
    classification.decision === 'fallback' || classification.confidence <= 0.4

  // Es un follow-up del hilo si arranca con conector o si la señal es débil
  // pero trae un slot reconocible. En ambos casos heredamos los slots previos.
  const isFollowUp =
    context.lastIntent !== null && (startsWithConnector || (weak && hasSlot))

  if (isFollowUp && context.lastIntent) {
    const redirect = redirectIntent(tokens.text, context.lastIntent, presentSlots)
    // Destino: redirección explícita > intent fuerte recién clasificado (ej.
    // "y comparado" → compare-month) > reuse del intent previo (elipsis pura).
    const intent = redirect ?? (weak ? context.lastIntent : classification.intent)
    return {
      intent,
      slots: mergeSlots(context.lastSlots, slots),
      decision: 'execute',
      viaEllipsis: true,
    }
  }

  return {
    intent: classification.intent,
    slots,
    decision: classification.decision,
    viaEllipsis: false,
    missingSlot: classification.missingSlot,
    alternative: classification.alternative,
  }
}

/** Nuevos slots pisan a los previos; se conservan los que el turno nuevo no trae. */
export function mergeSlots(prev: Slots, next: Slots): Slots {
  return {
    period: next.period ?? prev.period,
    category: next.category ?? prev.category,
    categoryCandidates: next.categoryCandidates ?? undefined,
    merchant: next.merchant ?? prev.merchant,
    account: next.account ?? prev.account,
    money: next.money ?? prev.money,
    ordering: next.ordering ?? prev.ordering,
    query: next.query ?? prev.query,
  }
}

/** Registra el turno resuelto en el contexto, conservando los últimos 5. */
export function pushTurn(
  context: ConversationContext,
  record: TurnRecord,
): ConversationContext {
  const turnHistory = [...context.turnHistory, record].slice(-5)
  return {
    lastIntent: record.intent,
    lastSlots: record.slots,
    turnHistory,
  }
}
