import type { RecurringRuleListItem } from '@/lib/db/queries/recurring'

export type CashFlowPoint = {
  date: string
  balance: number
  delta: number
  events: Array<{ description: string; amount: number; kind: 'income' | 'expense' }>
  /** Banda inferior (conservador). Sólo presente si se pasó `volatility`. */
  lower?: number
  /** Banda superior (optimista). Sólo presente si se pasó `volatility`. */
  upper?: number
}

/**
 * Día del mes resuelto: usa `dayOfMonth` si está seteado, sino cae al día
 * extraído de `nextRun`. Las reglas creadas por el form viejo guardaban
 * dayOfMonth=null aunque el usuario eligiera 15 de junio — caían siempre
 * el día 1 porque acá había un fallback hardcoded a 1.
 */
function resolveDayOfMonth(rule: RecurringRuleListItem): number {
  if (rule.dayOfMonth !== null && rule.dayOfMonth !== undefined) return rule.dayOfMonth
  if (rule.nextRun && /^\d{4}-\d{2}-\d{2}$/.test(rule.nextRun)) {
    const day = Number.parseInt(rule.nextRun.slice(8, 10), 10)
    if (!Number.isNaN(day) && day >= 1 && day <= 31) return day
  }
  return 1
}

function resolveDayOfWeek(rule: RecurringRuleListItem): number {
  if (rule.dayOfWeek !== null && rule.dayOfWeek !== undefined) return rule.dayOfWeek
  if (rule.nextRun && /^\d{4}-\d{2}-\d{2}$/.test(rule.nextRun)) {
    const d = new Date(`${rule.nextRun}T00:00:00Z`)
    return d.getUTCDay()
  }
  return 1
}

function wouldFireOnDate(
  rule: RecurringRuleListItem,
  date: Date,
  dayOfMonth: number,
  dayOfWeek: number,
): boolean {
  const { frequency } = rule

  if (frequency === 'daily') return true

  if (frequency === 'weekly') {
    return dayOfWeek === resolveDayOfWeek(rule)
  }

  if (frequency === 'biweekly') {
    if (dayOfWeek !== resolveDayOfWeek(rule)) return false
    const weekNum = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000))
    return weekNum % 2 === 0
  }

  if (frequency === 'monthly') {
    return dayOfMonth === resolveDayOfMonth(rule)
  }

  if (frequency === 'quarterly') {
    const month = date.getUTCMonth()
    return dayOfMonth === resolveDayOfMonth(rule) && month % 3 === 0
  }

  if (frequency === 'yearly') {
    return dayOfMonth === resolveDayOfMonth(rule) && date.getUTCMonth() === 0
  }

  return false
}

export type ProjectionOptions = {
  /**
   * Desviación estándar (σ) del net delta diario histórico, expresada en
   * la moneda base. Si se pasa, el output incluye bandas `lower`/`upper`
   * basadas en random walk: la varianza acumulada en el día N es σ × √N,
   * lo que representa la incertidumbre creciente conforme se proyecta más
   * lejos. La banda cubre ±1σ (~68% de probabilidad).
   */
  volatility?: number
}

export function projectCashFlow(
  rules: RecurringRuleListItem[],
  startingBalance: number,
  horizonDays: number,
  options: ProjectionOptions = {},
): CashFlowPoint[] {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const activeRules = rules.filter(
    (r) => r.active && (r.kind === 'income' || r.kind === 'expense'),
  )

  const points: CashFlowPoint[] = []
  let balance = startingBalance

  for (let i = 0; i <= horizonDays; i++) {
    const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000)
    const dayOfMonth = date.getUTCDate()
    const dayOfWeek = date.getUTCDay()
    const dateStr = date.toISOString().slice(0, 10)

    const events: CashFlowPoint['events'] = []
    let delta = 0

    for (const rule of activeRules) {
      if (!wouldFireOnDate(rule, date, dayOfMonth, dayOfWeek)) continue

      const amount = Number.parseFloat(rule.amount)
      if (Number.isNaN(amount)) continue

      if (rule.kind === 'income') {
        delta += amount
        events.push({ description: rule.description, amount, kind: 'income' })
      } else {
        delta -= amount
        events.push({ description: rule.description, amount, kind: 'expense' })
      }
    }

    balance += delta

    const point: CashFlowPoint = { date: dateStr, balance, delta, events }

    if (options.volatility !== undefined && options.volatility > 0) {
      // Random walk: σ acumulado en día N = σ × √N.
      // Día 0 no tiene incertidumbre (es el saldo actual).
      const cumulativeSigma = options.volatility * Math.sqrt(i)
      point.lower = balance - cumulativeSigma
      point.upper = balance + cumulativeSigma
    }

    points.push(point)
  }

  return points
}
