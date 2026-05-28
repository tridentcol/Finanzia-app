import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { savingsPlans, savingsPeriods, transactions, users } from '@/lib/db/schema'

export type SavingsPeriodRow = {
  id: string
  periodStart: string
  periodEnd: string
  targetAmount: string
  achievedAmount: string
  planMethod: 'percentage_income' | 'fixed_amount' | 'none' | 'other'
  planParams: unknown
}

export async function listSavingsPeriods(userId: string): Promise<SavingsPeriodRow[]> {
  const rows = await db
    .select({
      id: savingsPeriods.id,
      periodStart: savingsPeriods.periodStart,
      periodEnd: savingsPeriods.periodEnd,
      targetAmount: savingsPeriods.targetAmount,
      achievedAmount: savingsPeriods.achievedAmount,
      planMethod: savingsPlans.method,
      planParams: savingsPlans.params,
    })
    .from(savingsPeriods)
    .innerJoin(savingsPlans, eq(savingsPeriods.planId, savingsPlans.id))
    .where(eq(savingsPeriods.userId, userId))
    .orderBy(desc(savingsPeriods.periodEnd))

  return rows as SavingsPeriodRow[]
}

export async function getSavingsHeroData(userId: string): Promise<{
  totalAchieved: number
  periodsCount: number
  lastPeriod: SavingsPeriodRow | null
}> {
  const rows = await listSavingsPeriods(userId)
  const totalAchieved = rows.reduce((sum, r) => {
    const v = Number.parseFloat(r.achievedAmount)
    return sum + (v > 0 ? v : 0)
  }, 0)
  return {
    totalAchieved,
    periodsCount: rows.length,
    lastPeriod: rows[0] ?? null,
  }
}

/** Usuarios activos con plan de ahorro vigente — para el cron mensual. */
export async function listUsersWithActiveSavingsPlan(): Promise<
  Array<{ userId: string; planId: string; method: string; params: unknown }>
> {
  const rows = await db
    .select({
      userId: savingsPlans.userId,
      planId: savingsPlans.id,
      method: savingsPlans.method,
      params: savingsPlans.params,
    })
    .from(savingsPlans)
    .where(isNull(savingsPlans.activeTo))

  return rows
}

/** Net cash flow de un período para un usuario (income − expense), en base currency. */
export async function getNetCashFlowForPeriod(
  userId: string,
  periodStart: string,
  periodEnd: string,
): Promise<{ income: number; expense: number; net: number }> {
  const result = await db.execute<{ income: string; expense: string }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN kind = 'income'  THEN amount_base ELSE 0 END), 0)::text AS income,
      COALESCE(SUM(CASE WHEN kind = 'expense' THEN amount_base ELSE 0 END), 0)::text AS expense
    FROM transactions
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
      AND kind IN ('income', 'expense')
      AND date >= ${periodStart}::date
      AND date <= ${periodEnd}::date
  `)

  const row = result[0]
  const income = Number.parseFloat(row?.income ?? '0')
  const expense = Number.parseFloat(row?.expense ?? '0')
  return { income, expense, net: income - expense }
}
