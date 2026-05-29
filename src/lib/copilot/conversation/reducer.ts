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

const CONNECTOR_RE = /^(y|ademas|tambien|ahora|entonces|y que tal|que tal con)\b/

const SLOT_ONLY_KEYS: SlotKey[] = ['period', 'category', 'merchant', 'account', 'money']

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

  const isContinuation =
    context.lastIntent !== null && weak && (hasSlot || startsWithConnector)

  if (isContinuation && context.lastIntent) {
    return {
      intent: context.lastIntent,
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
    query: next.query ?? undefined,
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
