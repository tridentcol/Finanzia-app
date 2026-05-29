import type { DetectedInsight } from '@/lib/ai/insights/types'
import type { AnswerBlock, ProposalAction, Tone } from '../render/answer-ast'

/**
 * Mapea un insight detectado localmente a un bloque de consejo + acción
 * opcional. PURO (sin DB, sin server-only): `DetectedInsight` se importa solo
 * como tipo, así el módulo es testeable. La acción se deriva de la action que
 * el propio detector ya declaró (reuso de su metadata), nunca muta sola.
 */

type AdviceBlock = Extract<AnswerBlock, { type: 'advice' }>

const HREF_BY_ACTION: Record<string, string> = {
  'view-transactions': '/mi-dinero/movimientos',
  'view-budgets': '/mi-plan/presupuestos',
  'view-recurring': '/mi-plan/recurrentes',
}

function toneFor(i: DetectedInsight): Tone {
  if (i.kind === 'achievement') return 'positive'
  if (i.severity === 'warning') return 'warning'
  return 'neutral'
}

function mapAction(raw: DetectedInsight['action']): ProposalAction | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const a = raw as { type?: string; label?: string; params?: { href?: string } }
  const label = a.label ?? 'Abrir'
  if (a.type === 'navigate' && a.params?.href) {
    return { kind: 'navigate', label, href: a.params.href }
  }
  if (a.type && HREF_BY_ACTION[a.type]) {
    return { kind: 'navigate', label, href: HREF_BY_ACTION[a.type] as string }
  }
  return undefined
}

export function insightToAdvice(i: DetectedInsight): {
  block: AdviceBlock
  action?: ProposalAction
} {
  const block: AdviceBlock = {
    type: 'advice',
    tone: toneFor(i),
    title: i.title,
    body: i.body,
  }
  const action = mapAction(i.action)
  return action ? { block, action } : { block }
}
