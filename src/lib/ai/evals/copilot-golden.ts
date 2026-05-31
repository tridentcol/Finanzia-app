/**
 * Golden set de tool-calls del copiloto LLM — pregunta → tool esperada.
 *
 * Mide si el modelo elige la herramienta correcta para cada intención. El
 * runner vive en `scripts`... no: en `/api/dev/eval-copilot` (necesita keys +
 * DB + correr el LLM real; src/lib/ai/* es server-only). Este archivo es el
 * dataset + los nombres de tools válidos para el test de buena-formación (CI).
 *
 * `expectedTool` debe ser una de las keys que arma `buildCopilotTools`.
 */

export type CopilotToolCase = {
  question: string
  expectedTool: string
}

/** Keys de las tools del copiloto (mirror de buildCopilotTools). */
export const COPILOT_TOOL_NAMES: readonly string[] = [
  'getBalance',
  'getAccounts',
  'listRecentTransactions',
  'searchTransactions',
  'semanticSearchTransactions',
  'queryTransactions',
  'getBudgetStatus',
  'getDebts',
  'listRecurring',
  'getSavings',
  'listGoals',
  'getTopMerchants',
  'getCashFlow',
  'listActiveInsights',
  'getAdvice',
  'proposeCreateTransaction',
  'proposeSetBudget',
  'proposeCardPurchase',
]

export const COPILOT_GOLDEN: CopilotToolCase[] = [
  // Lecturas directas
  { question: '¿cuál es mi saldo total?', expectedTool: 'getBalance' },
  { question: '¿cuánto tengo en cada cuenta?', expectedTool: 'getAccounts' },
  { question: 'muéstrame mis últimos movimientos', expectedTool: 'listRecentTransactions' },
  { question: 'busca mis pagos a Netflix', expectedTool: 'searchTransactions' },
  { question: 'muéstrame gastos relacionados con ocio y entretenimiento', expectedTool: 'semanticSearchTransactions' },
  { question: '¿cuánto gasté en restaurantes el mes pasado?', expectedTool: 'queryTransactions' },
  { question: '¿cómo van mis presupuestos?', expectedTool: 'getBudgetStatus' },
  { question: '¿cuánto debo en total?', expectedTool: 'getDebts' },
  { question: '¿qué pagos recurrentes tengo?', expectedTool: 'listRecurring' },
  { question: '¿cómo voy con mi ahorro?', expectedTool: 'getSavings' },
  { question: '¿cuáles son mis metas?', expectedTool: 'listGoals' },
  { question: '¿dónde gasté más este mes?', expectedTool: 'getTopMerchants' },
  { question: 'proyéctame el flujo de caja de los próximos días', expectedTool: 'getCashFlow' },
  { question: '¿qué anomalías detectaste en mis finanzas?', expectedTool: 'listActiveInsights' },
  { question: '¿qué me recomendás para ahorrar más?', expectedTool: 'getAdvice' },

  // Propuestas (regla 6: solo proponen, la UI confirma)
  { question: 'registra un gasto de 50000 en almuerzo con la débito', expectedTool: 'proposeCreateTransaction' },
  { question: 'ponme un presupuesto de 300000 en restaurantes', expectedTool: 'proposeSetBudget' },
  { question: '¿me conviene comprar un celular de 3 millones a 12 cuotas con la tarjeta?', expectedTool: 'proposeCardPurchase' },
]
