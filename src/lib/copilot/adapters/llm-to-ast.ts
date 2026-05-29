import type { AnswerBlock, AnswerPayload, ProposalAction } from '../render/answer-ast'
import { isTool, type LoosePart } from '../parts'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'

/**
 * Adapta un mensaje del assistant a AnswerPayload para que el renderer de chat
 * sea único con o sin IA.
 *
 * - Si el server emitió un part `data-answer` (camino heurístico), se usa su
 *   payload tal cual: bloques estructurados Noir.
 * - Si no (camino LLM streaming), se construye desde los parts de texto. El LLM
 *   ya redacta la respuesta en prosa; la mostramos como bloques de texto
 *   editorial.
 * - Además, si el LLM llamó a un tool `propose-*` que mutaría, su salida se
 *   traduce a una `ProposalAction`: la UI muestra un botón "Confirmar" que
 *   dispara la server action real. El LLM nunca muta solo (regla 6).
 *
 * Tipamos los parts de forma laxa (`LoosePart`, compartido con copilot-phase):
 * useChat v6 añade campos según versión.
 */
type LooseMessage = {
  role?: string
  parts?: LoosePart[]
}

function isAnswerPayload(v: unknown): v is AnswerPayload {
  return (
    typeof v === 'object' &&
    v !== null &&
    Array.isArray((v as { blocks?: unknown }).blocks)
  )
}

/** Devuelve el objeto `proposal` de un tool propose-* exitoso, o null. */
function okProposal(out: unknown): Record<string, unknown> | null {
  if (
    typeof out === 'object' &&
    out !== null &&
    (out as { ok?: unknown }).ok === true
  ) {
    const proposal = (out as { proposal?: unknown }).proposal
    if (typeof proposal === 'object' && proposal !== null) {
      return proposal as Record<string, unknown>
    }
  }
  return null
}

const TX_KIND_LABEL: Record<string, string> = {
  income: 'Ingreso',
  expense: 'Gasto',
  transfer: 'Transferencia',
}
const PERIOD_LABEL: Record<string, string> = {
  monthly: 'mensual',
  weekly: 'semanal',
  yearly: 'anual',
}

/** Narrowing seguro de un valor desconocido a un enum string conocido. */
function asEnum<T extends string>(v: unknown, allowed: readonly T[]): T | null {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : null
}

function buildTransactionAction(prop: Record<string, unknown>): ProposalAction | null {
  const kind = asEnum(prop.kind, ['income', 'expense', 'transfer'] as const)
  if (!kind) return null
  const proposal = {
    kind,
    accountId: String(prop.accountId ?? ''),
    transferAccountId: (prop.transferAccountId as string | null) ?? null,
    categoryId: (prop.categoryId as string | null) ?? null,
    date: String(prop.date ?? ''),
    amount: String(prop.amount ?? ''),
    currency: String(prop.currency ?? ''),
    description: String(prop.description ?? ''),
    merchant: (prop.merchant as string | null) ?? null,
    notes: (prop.notes as string | null) ?? null,
  }
  if (!proposal.accountId || !proposal.amount || !proposal.date) return null
  const kindLabel = TX_KIND_LABEL[kind] ?? 'Movimiento'
  const amountStr = formatMoney(proposal.amount, { currency: proposal.currency as CurrencyCode })
  const accountName = typeof prop.accountName === 'string' ? prop.accountName : null
  const summary = `${kindLabel} de ${amountStr} · ${proposal.description}${accountName ? ` · ${accountName}` : ''}`
  return { kind: 'confirm-transaction', label: `Confirmar ${kindLabel.toLowerCase()}`, summary, proposal }
}

function buildBudgetAction(prop: Record<string, unknown>): ProposalAction | null {
  const mode = asEnum(prop.mode, ['create', 'update'] as const)
  if (!mode) return null
  const period = asEnum(prop.period, ['monthly', 'weekly', 'yearly'] as const)
  if (!period) return null
  const proposal = {
    mode,
    existingBudgetId: (prop.existingBudgetId as string | null) ?? null,
    categoryId: String(prop.categoryId ?? ''),
    amount: String(prop.amount ?? ''),
    period,
    rollover: Boolean(prop.rollover),
  }
  if (!proposal.categoryId || !proposal.amount) return null
  const categoryName = typeof prop.categoryName === 'string' ? prop.categoryName : 'la categoría'
  // Monto sin símbolo: el presupuesto va en moneda base, que no conocemos aquí.
  const amountStr = new Intl.NumberFormat('es-CO').format(Number(proposal.amount))
  const verb = mode === 'update' ? 'Actualizar' : 'Crear'
  const summary = `${verb} presupuesto ${PERIOD_LABEL[period]} de ${amountStr} en ${categoryName}`
  return { kind: 'confirm-budget', label: `${verb} presupuesto`, summary, proposal }
}

/** Devuelve el AnswerPayload de un mensaje assistant, o null si aún no hay contenido. */
export function llmMessageToAnswer(message: LooseMessage): AnswerPayload | null {
  const parts = message.parts ?? []

  // Camino heurístico: part estructurado.
  for (const p of parts) {
    if (p.type === 'data-answer' && isAnswerPayload(p.data)) {
      return p.data
    }
  }

  // Camino LLM: acciones de propuesta (mutaciones con confirmación).
  const actions: ProposalAction[] = []
  for (const p of parts) {
    if (isTool(p, 'proposeCreateTransaction')) {
      const prop = okProposal(p.output)
      const action = prop && buildTransactionAction(prop)
      if (action) actions.push(action)
    } else if (isTool(p, 'proposeSetBudget')) {
      const prop = okProposal(p.output)
      const action = prop && buildBudgetAction(prop)
      if (action) actions.push(action)
    }
  }

  // Camino LLM: juntar texto.
  const text = parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
    .trim()

  if (text.length === 0 && actions.length === 0) return null

  // El LLM redacta en markdown (listas, pasos, negrita). Lo emitimos como bloque
  // `markdown` para renderizarlo limpio; el heurístico mantiene `text` plano.
  const blocks: AnswerBlock[] = text.length > 0 ? [{ type: 'markdown', body: text }] : []
  const payload: AnswerPayload = { blocks }
  if (text.length === 0 && actions.length > 0) {
    payload.intro = 'Revisa la propuesta y confírmala:'
  }
  if (actions.length > 0) payload.actions = actions
  return payload
}
