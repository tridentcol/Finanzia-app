import type {
  HealthBand,
  HealthDimension,
  HealthInputs,
  HealthScore,
  HealthStatus,
} from './types'

/**
 * Scoring determinista de Salud Financiera. Cada dimensión devuelve un score
 * 0..100 con su explicación; el compuesto re-normaliza pesos sobre las
 * dimensiones que SÍ se pudieron evaluar (honesto: lo que falta no penaliza,
 * se marca "na"). Pura: sin I/O, totalmente testeable.
 */

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))
const pct = (n: number) => Math.round(n * 100)

function statusFor(score: number): HealthStatus {
  if (score >= 70) return 'good'
  if (score >= 40) return 'watch'
  return 'risk'
}

/** Pasa la primera letra a minúscula (para encadenar el detalle en una frase). */
function lowerFirst(s: string): string {
  return s.length > 0 ? s[0]!.toLowerCase() + s.slice(1) : s
}

// --- Dimensiones ---

/** Ahorro: tasa = (ingresos − gastos) / ingresos del mes pasado. */
function scoreSavings(income: number, expense: number): HealthDimension {
  const base = { key: 'savings' as const, label: 'Ahorro', weight: 0.3 }
  if (income <= 0) {
    return {
      ...base,
      score: null,
      status: 'na',
      available: false,
      detail: 'Sin ingresos registrados el mes pasado para medir tu ahorro.',
    }
  }
  const rate = (income - expense) / income
  let score: number
  if (rate >= 0.25) score = 100
  else if (rate >= 0) score = 40 + (rate / 0.25) * 60
  else if (rate >= -0.25) score = ((rate + 0.25) / 0.25) * 40
  else score = 0
  score = clamp(score)
  const detail =
    rate >= 0
      ? `Ahorraste el ${pct(rate)}% de tus ingresos el mes pasado.`
      : `Gastaste ${pct(-rate)}% más de lo que ingresaste el mes pasado.`
  return { ...base, score, status: statusFor(score), available: true, detail }
}

/** Colchón: meses de gastos que cubre tu saldo líquido. */
function scoreRunway(
  liquidAssets: number,
  avgMonthlyExpense: number,
): HealthDimension {
  const base = { key: 'runway' as const, label: 'Colchón', weight: 0.25 }
  if (avgMonthlyExpense <= 0) {
    if (liquidAssets > 0) {
      return {
        ...base,
        score: 100,
        status: 'good',
        available: true,
        detail: 'Tienes saldo y casi no registras gastos — buen colchón.',
      }
    }
    return {
      ...base,
      score: null,
      status: 'na',
      available: false,
      detail: 'Faltan datos de gasto para estimar tu colchón.',
    }
  }
  const months = Math.max(0, liquidAssets) / avgMonthlyExpense
  let score: number
  if (months >= 6) score = 100
  else if (months >= 3) score = 70 + ((months - 3) / 3) * 30
  else if (months >= 1) score = 35 + ((months - 1) / 2) * 35
  else score = months * 35
  score = clamp(score)
  const m = months.toFixed(1)
  const detail = `Tu saldo cubre ${m} ${m === '1.0' ? 'mes' : 'meses'} de gastos.`
  return { ...base, score, status: statusFor(score), available: true, detail }
}

/** Deuda: total adeudado (formal + tarjetas) frente a tu saldo líquido. */
function scoreDebt(totalDebt: number, liquidAssets: number): HealthDimension {
  const base = { key: 'debt' as const, label: 'Deuda', weight: 0.2 }
  if (totalDebt <= 0) {
    return {
      ...base,
      score: 100,
      status: 'good',
      available: true,
      detail: 'No tienes deudas registradas.',
    }
  }
  if (liquidAssets <= 0) {
    return {
      ...base,
      score: 0,
      status: 'risk',
      available: true,
      detail: 'Tienes deuda y no hay saldo líquido para cubrirla.',
    }
  }
  const ratio = totalDebt / liquidAssets
  const score = clamp(100 - ratio * 50)
  const detail = `Tus deudas equivalen al ${pct(ratio)}% de tu saldo disponible.`
  return { ...base, score, status: statusFor(score), available: true, detail }
}

/** Presupuestos: adherencia proyectada a fin de mes (pacing ya aplicado). */
function scoreBudgets(
  budgets: Array<{ amount: number; projected: number }>,
): HealthDimension {
  const base = { key: 'budgets' as const, label: 'Presupuestos', weight: 0.15 }
  const valid = budgets.filter((b) => b.amount > 0)
  if (valid.length === 0) {
    return {
      ...base,
      score: null,
      status: 'na',
      available: false,
      detail: 'Aún no defines presupuestos para medir tu disciplina.',
    }
  }
  let sum = 0
  let within = 0
  for (const b of valid) {
    const ratio = b.projected / b.amount
    if (ratio <= 1) within += 1
    let s: number
    if (ratio <= 0.85) s = 100
    else if (ratio <= 1) s = 100 - ((ratio - 0.85) / 0.15) * 30
    else if (ratio <= 2) s = 70 - ((ratio - 1) / 1) * 70
    else s = 0
    sum += clamp(s)
  }
  const score = clamp(sum / valid.length)
  const detail = `${within} de ${valid.length} ${
    valid.length === 1 ? 'presupuesto va' : 'presupuestos van'
  } camino a cerrar dentro del límite.`
  return { ...base, score, status: statusFor(score), available: true, detail }
}

/** Estabilidad: qué tan parejo es tu gasto discrecional día a día. */
function scoreStability(
  dailyVolatility: number,
  avgMonthlyExpense: number,
): HealthDimension {
  const base = { key: 'stability' as const, label: 'Estabilidad', weight: 0.1 }
  if (dailyVolatility <= 0 || avgMonthlyExpense <= 0) {
    return {
      ...base,
      score: null,
      status: 'na',
      available: false,
      detail: 'Faltan movimientos para medir qué tan parejo es tu gasto.',
    }
  }
  const avgDaily = avgMonthlyExpense / 30
  const coef = dailyVolatility / avgDaily
  let score: number
  if (coef <= 0.5) score = 100
  else if (coef >= 3) score = 0
  else score = 100 - ((coef - 0.5) / 2.5) * 100
  score = clamp(score)
  const detail =
    score >= 70
      ? 'Tu gasto del día a día es parejo y predecible.'
      : score >= 40
        ? 'Tu gasto varía algo de un día a otro.'
        : 'Tu gasto es bastante irregular día a día.'
  return { ...base, score, status: statusFor(score), available: true, detail }
}

// --- Compuesto ---

const BANDS: Array<{ min: number; band: HealthBand }> = [
  { min: 80, band: 'solida' },
  { min: 60, band: 'estable' },
  { min: 40, band: 'atencion' },
  { min: 0, band: 'fragil' },
]

function bandFor(score: number): HealthBand {
  return BANDS.find((b) => score >= b.min)!.band
}

export const BAND_LABEL: Record<HealthBand, string> = {
  solida: 'Sólida',
  estable: 'Estable',
  atencion: 'Atención',
  fragil: 'Frágil',
}

const BAND_OPENING: Record<HealthBand, string> = {
  solida: 'Tu salud financiera está sólida.',
  estable: 'Vas por buen camino.',
  atencion: 'Hay cosas por afinar.',
  fragil: 'Conviene poner atención pronto.',
}

/** Resumen editorial determinista: apertura por banda + fortaleza y punto débil. */
function buildSummary(band: HealthBand, evaluated: HealthDimension[]): string {
  const sorted = [...evaluated].sort(
    (a, b) => (a.score as number) - (b.score as number),
  )
  const weakest = sorted[0]!
  const strongest = sorted[sorted.length - 1]!

  const weakClause =
    weakest.status === 'good'
      ? `Está todo equilibrado: incluso lo más bajo, ${weakest.label.toLowerCase()}, va bien.`
      : `El punto a cuidar es ${weakest.label.toLowerCase()}: ${lowerFirst(weakest.detail)}`

  if (strongest.key !== weakest.key && strongest.status === 'good') {
    return `${BAND_OPENING[band]} Tu mayor fortaleza es ${strongest.label.toLowerCase()}. ${weakClause}`
  }
  return `${BAND_OPENING[band]} ${weakClause}`
}

/**
 * Compone el score de salud financiera a partir de insumos ya agregados.
 * Re-normaliza pesos sobre las dimensiones disponibles.
 */
export function computeHealthScore(inputs: HealthInputs): HealthScore {
  const dimensions: HealthDimension[] = [
    scoreSavings(inputs.savings.income, inputs.savings.expense),
    scoreRunway(inputs.runway.liquidAssets, inputs.runway.avgMonthlyExpense),
    scoreDebt(inputs.debt.totalDebt, inputs.debt.liquidAssets),
    scoreBudgets(inputs.budgets),
    scoreStability(
      inputs.stability.dailyVolatility,
      inputs.stability.avgMonthlyExpense,
    ),
  ]

  const evaluated = dimensions.filter(
    (d): d is HealthDimension & { score: number } =>
      d.available && d.score !== null,
  )
  if (evaluated.length === 0) {
    return {
      score: null,
      band: null,
      summary:
        'Aún no hay suficientes datos para evaluar tu salud financiera. Registra movimientos y vuelve pronto.',
      dimensions,
      evaluatedCount: 0,
    }
  }

  const totalWeight = evaluated.reduce((sum, d) => sum + d.weight, 0)
  const weighted = evaluated.reduce((sum, d) => sum + d.score * d.weight, 0)
  const score = Math.round(weighted / totalWeight)
  const band = bandFor(score)

  return {
    score,
    band,
    summary: buildSummary(band, evaluated),
    dimensions,
    evaluatedCount: evaluated.length,
  }
}
