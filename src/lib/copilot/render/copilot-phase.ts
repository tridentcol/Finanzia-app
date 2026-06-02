import { toolNameOf, type LoosePart } from '../parts'

/**
 * Mapeo tool → etiqueta humana (es-CO) que se muestra mientras el copiloto
 * trabaja. Las claves son los nombres EXACTOS de `buildCopilotTools`
 * (`src/lib/ai/copilot/tools.ts`). Si un tool no está mapeado, cae a
 * `PHASE_WORKING`. Cero emojis — el mandato Noir aplica también aquí.
 */
export const TOOL_LABELS: Record<string, string> = {
  getBalance: 'Revisando tus cuentas…',
  getAccounts: 'Revisando tus cuentas…',
  listRecentTransactions: 'Revisando tus movimientos…',
  searchTransactions: 'Revisando tus movimientos…',
  queryTransactions: 'Revisando tus movimientos…',
  getBudgetStatus: 'Mirando tus presupuestos…',
  getDebts: 'Revisando tus deudas…',
  listRecurring: 'Revisando tus recurrentes…',
  getSavings: 'Mirando tu ahorro y tus metas…',
  listGoals: 'Mirando tu ahorro y tus metas…',
  getTopMerchants: 'Viendo dónde gastas…',
  getCashFlow: 'Analizando tu flujo…',
  getFinancialHealth: 'Evaluando tu salud financiera…',
  listActiveInsights: 'Buscando patrones…',
  getAdvice: 'Buscando patrones…',
  proposeCreateTransaction: 'Preparando el movimiento…',
  proposeCardPurchase: 'Preparando el movimiento…',
  proposeSetBudget: 'Preparando el presupuesto…',
}

/** Estado por defecto: razonando, todavía sin tools ni texto. */
export const PHASE_THINKING = 'Pensando…'
/** Tools resueltos, redactando la respuesta (aún sin texto). */
export const PHASE_DRAFTING = 'Preparando tu respuesta…'
/** Tool activo pero sin etiqueta conocida. */
export const PHASE_WORKING = 'Trabajando…'

/** Estados en los que un tool todavía está corriendo (no resuelto). */
const ACTIVE_TOOL_STATES = new Set(['input-streaming', 'input-available'])

/**
 * Deriva la fase humana de un turno pending a partir de los `parts` del stream.
 * Función pura y testeable. Jerarquía:
 *  1. Hay un tool activo (`input-streaming`/`input-available`) → su etiqueta;
 *     gana el ÚLTIMO del array (recorrido de atrás hacia delante).
 *  2. Hubo tools pero todos resueltos, sin texto aún → "Preparando tu respuesta…".
 *  3. Sin tools, sin texto → "Pensando…".
 *
 * El caso "llega texto" se maneja fuera: el turno deja de ser pending y esta
 * función ya no se invoca.
 */
export function derivePhase(parts: LoosePart[] | undefined): string {
  if (!parts || parts.length === 0) return PHASE_THINKING

  let sawTool = false
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    if (!part) continue
    const name = toolNameOf(part)
    if (name === null) continue
    sawTool = true
    if (part.state !== undefined && ACTIVE_TOOL_STATES.has(part.state)) {
      return TOOL_LABELS[name] ?? PHASE_WORKING
    }
  }

  return sawTool ? PHASE_DRAFTING : PHASE_THINKING
}
