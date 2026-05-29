import 'server-only'

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { OVER_NOTICE, OVER_WARNING } from '@/lib/ai/insights/forecast'
import type { BudgetProgress } from '@/lib/db/queries/budgets'
import type { EngineContext, PeriodSlot } from '../intents/types'

export { OVER_NOTICE, OVER_WARNING }

/**
 * Métricas dirigidas para tejer consejo en un resolver puntual, con 1 query
 * cada una (más barato que correr todos los detectores). Reusan los mismos
 * umbrales que el motor de insights.
 */

export type CategoryDelta = {
  current: number
  avg: number
  deltaPct: number
  months: number
}

/**
 * Gasto de la categoría en el período vs promedio mensual de los 3 meses
 * completos previos. Devuelve null si no hay baseline suficiente (≥2 meses con
 * gasto). `deltaPct` es la variación relativa (0.4 = +40%).
 */
export async function categoryDeltaVsBaseline(
  ctx: EngineContext,
  categoryId: string,
  period: PeriodSlot,
): Promise<CategoryDelta | null> {
  const rows = await db.execute<{ current: string; avg: string; months: number }>(sql`
    WITH cur AS (
      SELECT COALESCE(SUM(amount_base), 0)::numeric AS total
      FROM transactions
      WHERE user_id = ${ctx.userId}
        AND deleted_at IS NULL
        AND kind = 'expense'
        AND category_id = ${categoryId}
        AND date >= ${period.from}
        AND date <= ${period.to}
    ),
    base AS (
      SELECT date_trunc('month', date::date) AS m, SUM(amount_base)::numeric AS total
      FROM transactions
      WHERE user_id = ${ctx.userId}
        AND deleted_at IS NULL
        AND kind = 'expense'
        AND category_id = ${categoryId}
        AND date >= (date_trunc('month', ${period.to}::date) - INTERVAL '3 months')
        AND date <  date_trunc('month', ${period.to}::date)
      GROUP BY 1
    )
    SELECT
      (SELECT total FROM cur)::text AS current,
      COALESCE(AVG(total), 0)::text AS avg,
      COUNT(*)::int AS months
    FROM base
  `)

  const row = rows[0]
  if (!row) return null
  const current = Number.parseFloat(row.current)
  const avg = Number.parseFloat(row.avg)
  const months = row.months
  if (months < 2 || avg <= 0 || !Number.isFinite(current)) return null

  return { current, avg, deltaPct: (current - avg) / avg, months }
}

export type BudgetForecast = {
  projected: number
  overPct: number
  daysElapsed: number
  daysTotal: number
  severity: 'notice' | 'warning'
}

/**
 * Proyección lineal del cierre de un presupuesto al ritmo actual. Pura (usa el
 * BudgetProgress ya cargado). Mismo cálculo y umbrales que forecast.ts.
 * Devuelve null si es muy temprano (<5 días) o no proyecta sobregiro.
 */
export function budgetForecast(b: BudgetProgress, todayIso: string): BudgetForecast | null {
  const start = new Date(`${b.periodStart}T00:00:00Z`)
  const end = new Date(`${b.periodEnd}T00:00:00Z`)
  const today = new Date(`${todayIso}T00:00:00Z`)
  const day = 86_400_000
  const daysTotal = Math.round((end.getTime() - start.getTime()) / day) + 1
  const daysElapsed = Math.max(
    1,
    Math.min(daysTotal, Math.round((today.getTime() - start.getTime()) / day) + 1),
  )
  if (daysElapsed < 5) return null

  const amount = Number.parseFloat(b.amount)
  const spent = Number.parseFloat(b.spent)
  if (amount <= 0) return null

  const projected = (spent / daysElapsed) * daysTotal
  const overPct = (projected - amount) / amount
  if (overPct < OVER_NOTICE) return null

  return {
    projected,
    overPct,
    daysElapsed,
    daysTotal,
    severity: overPct >= OVER_WARNING ? 'warning' : 'notice',
  }
}
