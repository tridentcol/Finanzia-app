/**
 * AST de respuesta del copiloto — contrato COMPARTIDO entre el motor heurístico
 * (server) y el renderer del chat (client). Por eso NO lleva `server-only`.
 *
 * Una respuesta es un `AnswerPayload`: un intro opcional, una lista de bloques
 * tipados que el renderer dibuja con la estética Noir (números Geist Mono
 * tabular, cero emojis/gradientes), follow-ups clickables y acciones que el
 * usuario puede confirmar. El LLM produce el mismo AST vía un adaptador, así
 * la UX se ve idéntica con o sin IA externa.
 */

export type Tone = 'neutral' | 'positive' | 'negative' | 'warning'

export type BudgetStatus = 'safe' | 'warning' | 'exceeded'

/** Fila de un desglose: etiqueta + monto formateado + porcentaje 0..1. */
export type BreakdownRow = {
  label: string
  value: string
  /** 0..1 del total — para la barra segmentada. */
  fraction: number
  sub?: string
}

export type BarRow = {
  label: string
  /** Valor crudo para escalar la barra (mismo unit que `max`). */
  raw: number
  /** Texto ya formateado que se muestra. */
  value: string
}

export type ListItem = {
  id?: string
  primary: string
  secondary?: string
  trailing?: string
  trailingTone?: Tone
}

export type ChartPoint = {
  /** Eje X — ISO date o etiqueta corta. */
  x: string
  y: number
}

export type TimelineItem = {
  id?: string
  dateLabel: string
  primary: string
  amount: string
  tone?: Tone
}

export type AnswerBlock =
  | {
      type: 'amount'
      label: string
      value: string
      currency: string
      tone?: Tone
      delta?: { value: string; since: string; tone?: Tone }
      note?: string
    }
  | {
      type: 'breakdown'
      title: string
      rows: BreakdownRow[]
      total?: { label: string; value: string }
    }
  | {
      type: 'bars'
      title: string
      max: number
      rows: BarRow[]
      valueFormat: 'money' | 'count'
    }
  | { type: 'list'; title?: string; items: ListItem[] }
  | {
      type: 'gauge'
      label: string
      spent: string
      limit: string
      /** 0..1+ (puede exceder 1). */
      percent: number
      status: BudgetStatus
    }
  | {
      type: 'mini-chart'
      kind: 'sparkline'
      points: ChartPoint[]
      annotation?: string
    }
  | { type: 'event-list'; items: TimelineItem[] }
  | { type: 'advice'; tone: Tone; title: string; body: string }
  | { type: 'text'; body: string }
  // Markdown crudo del LLM (listas, pasos, párrafos, negrita). Lo renderiza
  // MarkdownProse con un map Noir restringido (sin HTML crudo, sin img). El
  // camino heurístico NO lo usa — sigue con `text` y bloques estructurados.
  | { type: 'markdown'; body: string }

export type FollowUpChip = {
  /** Texto visible del chip. */
  label: string
  /** Utterance que se envía al hacer click (puede diferir del label). */
  utterance: string
}

/**
 * Acción contextual que el usuario puede disparar desde una respuesta. Toda
 * mutación pasa por confirmación UI + Server Action (regla 6 del mandato): la
 * acción describe la intención, nunca ejecuta sola.
 */
export type ProposalAction =
  | {
      kind: 'create-recurring-from-merchant'
      label: string
      merchantName: string
      suggestedAmount: string
      currency: string
    }
  | {
      kind: 'create-budget-for-category'
      label: string
      categoryId: string
      categoryName: string
      suggestedAmount: string
    }
  | { kind: 'navigate'; label: string; href: string }
  | { kind: 'mark-insight-read'; label: string; insightId: string }
  // Propuestas emitidas por el LLM (tools propose-*): llevan el payload validado
  // por el tool; la UI confirma y dispara la server action real. Regla 6.
  | {
      kind: 'confirm-transaction'
      label: string
      /** Texto legible para el ConfirmDialog. */
      summary: string
      proposal: {
        kind: 'income' | 'expense' | 'transfer'
        accountId: string
        transferAccountId?: string | null
        categoryId?: string | null
        date: string
        amount: string
        currency: string
        description: string
        merchant?: string | null
        notes?: string | null
      }
    }
  | {
      kind: 'confirm-budget'
      label: string
      summary: string
      proposal: {
        mode: 'create' | 'update'
        existingBudgetId?: string | null
        categoryId: string
        amount: string
        period: 'monthly' | 'weekly' | 'yearly'
        rollover: boolean
      }
    }

export type AnswerPayload = {
  intro?: string
  blocks: AnswerBlock[]
  followUps?: FollowUpChip[]
  actions?: ProposalAction[]
}
