import 'server-only'
import { and, desc, eq, gte, inArray, isNotNull, isNull } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { accounts, categories, recurringRules, transactions } from '@/lib/db/schema'

export type RecurringRuleListItem = {
  id: string
  description: string
  amount: string
  currency: string
  kind: 'income' | 'expense' | 'transfer'
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  dayOfMonth: number | null
  dayOfWeek: number | null
  nextRun: string | null
  lastRun: string | null
  active: boolean
  autoCreate: boolean
  accountId: string
  accountName: string | null
  categoryId: string | null
  categoryName: string | null
}

export async function listRecurringForUser(
  userId: string,
): Promise<RecurringRuleListItem[]> {
  const rows = await db
    .select({
      id: recurringRules.id,
      description: recurringRules.description,
      amount: recurringRules.amount,
      currency: recurringRules.currency,
      kind: recurringRules.kind,
      frequency: recurringRules.frequency,
      dayOfMonth: recurringRules.dayOfMonth,
      dayOfWeek: recurringRules.dayOfWeek,
      nextRun: recurringRules.nextRun,
      lastRun: recurringRules.lastRun,
      active: recurringRules.active,
      autoCreate: recurringRules.autoCreate,
      accountId: recurringRules.accountId,
      accountName: accounts.name,
      categoryId: recurringRules.categoryId,
      categoryName: categories.name,
    })
    .from(recurringRules)
    .leftJoin(accounts, eq(accounts.id, recurringRules.accountId))
    .leftJoin(categories, eq(categories.id, recurringRules.categoryId))
    .where(and(eq(recurringRules.userId, userId)))
    .orderBy(desc(recurringRules.active), recurringRules.nextRun)

  return rows
}

export type RecurringDriftSnapshot = {
  ruleId: string
  expectedDay: number
  toleranceDays: number
  /** Última N ocurrencias reales (más recientes primero), con su día efectivo. */
  occurrences: Array<{ date: string; actualDay: number; delta: number }>
}

/**
 * Para cada regla activa con `dayOfMonth` definido, devuelve las últimas
 * `limit` transacciones reales vinculadas (recurring_rule_id) en los últimos
 * `windowDays` días. Esto alimenta el mini-timeline de drift en
 * `/ajustes/recurring` y permite ver si un cargo está derivando de su día
 * esperado sin esperar al detector nocturno.
 */
export async function getRecurringDriftSnapshots(
  userId: string,
  ruleIds: string[],
  options: { limit?: number; windowDays?: number } = {},
): Promise<RecurringDriftSnapshot[]> {
  const limit = options.limit ?? 6
  const windowDays = options.windowDays ?? 180

  if (ruleIds.length === 0) return []

  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const rules = await db
    .select({
      id: recurringRules.id,
      dayOfMonth: recurringRules.dayOfMonth,
      toleranceDays: recurringRules.toleranceDays,
    })
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, userId),
        inArray(recurringRules.id, ruleIds),
        isNotNull(recurringRules.dayOfMonth),
      ),
    )

  if (rules.length === 0) return []

  const txs = await db
    .select({
      date: transactions.date,
      recurringRuleId: transactions.recurringRuleId,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        inArray(
          transactions.recurringRuleId,
          rules.map((r) => r.id),
        ),
        isNull(transactions.deletedAt),
        gte(transactions.date, cutoffStr),
      ),
    )
    .orderBy(desc(transactions.date))

  const byRule = new Map<
    string,
    { expectedDay: number; toleranceDays: number; occurrences: RecurringDriftSnapshot['occurrences'] }
  >()
  for (const r of rules) {
    if (r.dayOfMonth === null) continue
    byRule.set(r.id, {
      expectedDay: r.dayOfMonth,
      toleranceDays: r.toleranceDays,
      occurrences: [],
    })
  }

  for (const tx of txs) {
    if (!tx.recurringRuleId) continue
    const slot = byRule.get(tx.recurringRuleId)
    if (!slot || slot.occurrences.length >= limit) continue
    const actualDay = new Date(tx.date + 'T12:00:00Z').getUTCDate()
    slot.occurrences.push({
      date: tx.date,
      actualDay,
      delta: actualDay - slot.expectedDay,
    })
  }

  return Array.from(byRule.entries()).map(([ruleId, v]) => ({
    ruleId,
    expectedDay: v.expectedDay,
    toleranceDays: v.toleranceDays,
    occurrences: v.occurrences,
  }))
}
