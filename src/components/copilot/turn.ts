import type { AnswerPayload } from '@/lib/copilot/render/answer-ast'

/**
 * Turno del chat. El user aporta texto plano; el assistant aporta un
 * AnswerPayload (heurístico directo o LLM adaptado), o `pending` mientras
 * llega la respuesta. En pending llevamos `phase`: la etiqueta humana del
 * estado actual (derivada del stream en copilot-dialog). `idle` marca un
 * pending terminal: el stream acabó sin contenido renderable (Detener, error
 * o límite de pasos) → estado neutro, no seguimos "trabajando".
 */
export type Turn =
  | { id: string; role: 'user'; text: string }
  | { id: string; role: 'assistant'; payload: AnswerPayload }
  | { id: string; role: 'assistant'; pending: true; phase?: string; idle?: boolean }
