/**
 * Tipos del score de Salud Financiera Explicada.
 *
 * El score es DETERMINISTA: se compone de 5 dimensiones, cada una con su
 * "porqué" en lenguaje claro (regla del producto: score explicado, no número
 * opaco). No hay LLM en el cálculo — la explicación por dimensión es honesta y
 * siempre disponible.
 */

export type HealthStatus = 'good' | 'watch' | 'risk'

/** Banda editorial del compuesto. */
export type HealthBand = 'solida' | 'estable' | 'atencion' | 'fragil'

export type HealthDimensionKey =
  | 'savings'
  | 'runway'
  | 'debt'
  | 'budgets'
  | 'stability'

export type HealthDimension = {
  key: HealthDimensionKey
  /** Etiqueta corta para la UI ("Ahorro", "Colchón"…). */
  label: string
  /** 0..100; `null` si no hay datos para evaluarla. */
  score: number | null
  /** Peso nominal en el compuesto (antes de re-normalizar por disponibilidad). */
  weight: number
  status: HealthStatus | 'na'
  /** True si la dimensión se pudo evaluar (entra al compuesto). */
  available: boolean
  /** Explicación en lenguaje claro — el "porqué". */
  detail: string
}

export type HealthScore = {
  /** 0..100 compuesto sobre las dimensiones disponibles; `null` si no hay nada que evaluar. */
  score: number | null
  band: HealthBand | null
  /** Resumen editorial determinista de una o dos oraciones. */
  summary: string
  dimensions: HealthDimension[]
  /** Cuántas dimensiones se pudieron evaluar (entraron al compuesto). */
  evaluatedCount: number
}

/**
 * Insumos del score, ya agregados (privacidad: nunca transacciones sueltas).
 * `getHealthData` los arma reusando las queries existentes; `computeHealthScore`
 * es una función pura sobre estos números → testeable y sin I/O.
 */
export type HealthInputs = {
  /** Mes calendario completo más reciente. */
  savings: { income: number; expense: number }
  /** Saldo líquido (cuentas propias) y gasto mensual promedio reciente. */
  runway: { liquidAssets: number; avgMonthlyExpense: number }
  /** Deuda total en base (formal + saldo adeudado de tarjetas) vs saldo líquido. */
  debt: { totalDebt: number; liquidAssets: number }
  /** Presupuestos mensuales con gasto PROYECTADO a fin de mes (pacing ya aplicado). */
  budgets: Array<{ amount: number; projected: number }>
  /** σ del net delta diario discrecional y gasto mensual promedio para normalizar. */
  stability: { dailyVolatility: number; avgMonthlyExpense: number }
}
