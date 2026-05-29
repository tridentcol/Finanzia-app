export type PurchaseAnalysisInput = {
  /** Monto de la compra en la moneda de la tarjeta. */
  amount: number
  /** Número de cuotas (1 = pago contado en el siguiente corte). */
  installments: number
  /** Día del mes en que corta la tarjeta. Null = sin corte configurado. */
  statementDay: number | null
  /** Cupo total de la tarjeta. Null/0 = sin cupo. */
  creditLimit: number | null
  /** Saldo actual de la tarjeta (negativo = deuda). */
  currentBalance: number
  /** Tasa mensual como decimal (0.025 = 2.5%). Null = sin tasa configurada. */
  interestRateMonthly: number | null
}

export type PurchaseAnalysisResult = {
  daysToStatement: number | null
  /** Total a pagar (monto + intereses). En 1 cuota o tasa 0 = monto. */
  totalWithInterest: number
  /** Intereses totales. 0 si paga en 1 cuota o sin tasa. */
  totalInterest: number
  /** Cuota mensual (sólo relevante si installments > 1). */
  monthlyInstallment: number
  /** Utilización del cupo tras la compra (0..1). 0 si sin cupo. */
  utilizationAfter: number
  /** Tono cualitativo de la utilización resultante. */
  utilizationTone: 'safe' | 'warning' | 'danger' | 'unknown'
  /** Líneas humanas que la UI o el copiloto pueden renderizar verbatim. */
  highlights: string[]
}

/**
 * Análisis determinístico (sin LLM) del costo real de una compra a cuotas
 * con tarjeta de crédito. Misma lógica que el widget `PurchaseAnalyzer` —
 * extraída a módulo compartido para que el copiloto pueda llamarla via tool.
 */
export function analyzePurchase(input: PurchaseAnalysisInput): PurchaseAnalysisResult {
  const { amount, installments, statementDay, creditLimit, currentBalance } = input
  const n = Math.max(1, Math.floor(installments))
  const r = input.interestRateMonthly ?? 0

  // Días al próximo corte (rollover de 30 días si ya pasó).
  let daysToStatement: number | null = null
  if (statementDay) {
    const today = new Date().getUTCDate()
    daysToStatement = statementDay >= today ? statementDay - today : 30 - today + statementDay
  }

  // Cuota fija francesa: M = monto × r × (1+r)^n / ((1+r)^n − 1)
  let monthlyInstallment: number
  let totalWithInterest: number
  if (n === 1 || r === 0) {
    monthlyInstallment = amount / n
    totalWithInterest = amount
  } else {
    monthlyInstallment = (amount * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
    totalWithInterest = monthlyInstallment * n
  }
  const totalInterest = totalWithInterest - amount

  // Utilización resultante.
  const limit = creditLimit ?? 0
  const usedNow = currentBalance < 0 ? -currentBalance : 0
  const utilizationAfter = limit > 0 ? Math.min(1, (usedNow + amount) / limit) : 0
  const utilizationTone: PurchaseAnalysisResult['utilizationTone'] =
    limit === 0
      ? 'unknown'
      : utilizationAfter >= 0.9
        ? 'danger'
        : utilizationAfter >= 0.6
          ? 'warning'
          : 'safe'

  // Highlights humanos. Estos son las frases que el copiloto puede repetir.
  const highlights: string[] = []
  if (daysToStatement !== null) {
    highlights.push(
      `Faltan ${daysToStatement} días al corte. Esta compra entra al ciclo que se paga ese mes.`,
    )
  }
  if (n === 1 || r === 0) {
    highlights.push(`Pagando contado: ${formatNumber(amount)} sin intereses.`)
  } else {
    highlights.push(
      `${n} cuotas de ${formatNumber(monthlyInstallment)} → total ${formatNumber(totalWithInterest)} (${formatNumber(totalInterest)} de intereses).`,
    )
  }
  if (limit > 0) {
    const pct = Math.round(utilizationAfter * 100)
    if (utilizationTone === 'danger') {
      highlights.push(
        `Esta compra deja tu utilización en ${pct}% — zona de peligro. Tu score de crédito se afectará.`,
      )
    } else if (utilizationTone === 'warning') {
      highlights.push(
        `Esta compra deja tu utilización en ${pct}%. Empieza a ser visible para tu score.`,
      )
    } else {
      highlights.push(`Utilización resultante: ${pct}% (zona segura).`)
    }
  }

  return {
    daysToStatement,
    totalWithInterest,
    totalInterest,
    monthlyInstallment,
    utilizationAfter,
    utilizationTone,
    highlights,
  }
}

function formatNumber(v: number): string {
  return v.toLocaleString('es-CO', { maximumFractionDigits: 0 })
}
