import 'server-only'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import type { DetectedInsight, InsightContext } from './types'

/**
 * Forecast por presupuesto: proyecta el gasto del período al cierre asumiendo
 * el ritmo actual (gasto_hoy / días_transcurridos × días_totales). Si la
 * proyección supera al presupuesto por >10%, genera insight 'forecast' con
 * severity 'warning' (>30% over) o 'notice' (10-30%).
 *
 * Solo presupuestos monthly por ahora (los más comunes y donde el forecast
 * tiene sentido). Weekly: demasiado ruidoso. Yearly: rara vez relevante en
 * mitad de año.
 */
type Row = {
  budget_id: string
  category_id: string
  category_name: string
  amount: string
  period_start: string
  period_end: string
  spent: string
}

export const OVER_NOTICE = 0.1
export const OVER_WARNING = 0.3

export async function detectForecasts(ctx: InsightContext): Promise<DetectedInsight[]> {
  const rows = await db.execute<Row>(sql`
    WITH ranges AS (
      SELECT
        b.id AS budget_id,
        b.category_id,
        c.name AS category_name,
        b.amount::text AS amount,
        date_trunc('month', CURRENT_DATE)::date AS period_start,
        (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date AS period_end
      FROM budgets b
      JOIN categories c ON c.id = b.category_id
      WHERE b.user_id = ${ctx.userId}
        AND b.archived = false
        AND b.period = 'monthly'
    )
    SELECT
      r.*,
      COALESCE((
        SELECT SUM(t.amount_base)::text
        FROM transactions t
        WHERE t.user_id = ${ctx.userId}
          AND t.category_id = r.category_id
          AND t.kind = 'expense'
          AND t.deleted_at IS NULL
          AND t.date >= r.period_start
          AND t.date <= r.period_end
      ), '0') AS spent
    FROM ranges r
  `)

  const out: DetectedInsight[] = []
  for (const r of rows) {
    const amount = Number.parseFloat(r.amount)
    const spent = Number.parseFloat(r.spent)
    if (!(amount > 0)) continue

    const periodStart = new Date(`${r.period_start}T00:00:00Z`)
    const periodEnd = new Date(`${r.period_end}T00:00:00Z`)
    const todayDate = new Date(`${ctx.today}T00:00:00Z`)
    const totalDays = daysBetween(periodStart, periodEnd) + 1
    const elapsed = Math.max(
      1,
      Math.min(totalDays, daysBetween(periodStart, todayDate) + 1),
    )
    const projected = (spent / elapsed) * totalDays
    const overshoot = (projected - amount) / amount
    if (overshoot < OVER_NOTICE) continue
    if (elapsed < 5) continue // muy temprano para predecir

    const severity = overshoot >= OVER_WARNING ? 'warning' : 'notice'
    const overPct = Math.round(overshoot * 100)

    out.push({
      kind: 'forecast',
      severity,
      title: `Presupuesto ${r.category_name} en riesgo`,
      body:
        `Al ritmo actual cerrarías el mes en ${projected.toFixed(0)} ${ctx.baseCurrency} ` +
        `(presupuesto ${amount.toFixed(0)}). Estás ${overPct}% por encima.`,
      data: {
        signature: `forecast:${r.budget_id}:${r.period_start}`,
        budgetId: r.budget_id,
        categoryId: r.category_id,
        categoryName: r.category_name,
        amount: amount.toFixed(2),
        spent: spent.toFixed(2),
        projected: projected.toFixed(2),
        overshoot: Number(overshoot.toFixed(3)),
      },
      action: {
        type: 'view-budgets',
        params: {},
        label: 'Ajustar presupuesto',
      },
      status: 'unread',
      periodStart: r.period_start,
      periodEnd: r.period_end,
      generatedBy: 'forecast-detector',
      signature: `forecast:${r.budget_id}:${r.period_start}`,
    } as DetectedInsight)
  }
  return out
}

function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime()
  return Math.round(ms / 86_400_000)
}
