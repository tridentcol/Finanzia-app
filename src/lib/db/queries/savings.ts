import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { savingsPlans, savingsPeriods, transactions, users } from '@/lib/db/schema'
import { userDataTag } from '@/lib/cache/data'
import { listGoalsForUser } from '@/lib/db/queries/goals'

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

/**
 * Lecturas crudas de /mi-plan/ahorro: períodos cerrados, hero acumulado y las
 * metas (para la distribución del ahorro). El plan activo y el perfil se leen
 * en la page (fuera del cache). La key incluye `today` porque daysToTarget de
 * las metas depende de la fecha; el tag coarse `data:${userId}` lo bustea
 * cualquier Server Action que muta. `revalidate: 30` es un backstop.
 */
export function getAhorroData(userId: string, today: string) {
  return unstable_cache(
    async () => {
      const [periods, hero, goals] = await Promise.all([
        listSavingsPeriods(userId),
        getSavingsHeroData(userId),
        listGoalsForUser(userId),
      ])
      return { periods, hero, goals }
    },
    ['ahorro-data', userId, today],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
