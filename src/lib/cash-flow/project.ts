import type { RecurringRuleListItem } from '@/lib/db/queries/recurring'

export type CashFlowPoint = {
  date: string
  balance: number
  delta: number
  events: Array<{ description: string; amount: number; kind: 'income' | 'expense' }>
}

type FrequencyDays = {
  daily: 1
  weekly: 7
  biweekly: 14
  monthly: null
  quarterly: null
  yearly: null
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
    return dayOfWeek === (rule.dayOfWeek ?? 1)
  }

  if (frequency === 'biweekly') {
    if (dayOfWeek !== (rule.dayOfWeek ?? 1)) return false
    // Check even/odd week relative to epoch
    const weekNum = Math.floor(date.getTime() / (7 * 24 * 60 * 60 * 1000))
    return weekNum % 2 === 0
  }

  if (frequency === 'monthly') {
    return dayOfMonth === (rule.dayOfMonth ?? 1)
  }

  if (frequency === 'quarterly') {
    const month = date.getUTCMonth()
    return dayOfMonth === (rule.dayOfMonth ?? 1) && month % 3 === 0
  }

  if (frequency === 'yearly') {
    return dayOfMonth === (rule.dayOfMonth ?? 1) && date.getUTCMonth() === 0
  }

  return false
}

export function projectCashFlow(
  rules: RecurringRuleListItem[],
  startingBalance: number,
  horizonDays: number,
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
    points.push({ date: dateStr, balance, delta, events })
  }

  return points
}
