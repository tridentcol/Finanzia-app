import 'server-only'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import type { DetectedInsight, InsightContext } from './types'

/**
 * Tasa de ahorro (savings rate) por mes = (income - expense) / income.
 * Compara el mes pasado completo con los 3 anteriores. Si la tasa cae más de
 * 15 puntos porcentuales, emite insight 'recommendation' tonal 'notice';
 * si sube más de 10 puntos, emite achievement.
 */
type Row = { month_start: string; income: string; expense: string }

export async function detectSavingsRate(
  ctx: InsightContext,
): Promise<DetectedInsight[]> {
  const rows = await db.execute<Row>(sql`
    SELECT
      date_trunc('month', date::date)::date AS month_start,
      COALESCE(SUM(CASE WHEN kind='income'  THEN amount_base ELSE 0 END), 0)::text AS income,
      COALESCE(SUM(CASE WHEN kind='expense' THEN amount_base ELSE 0 END), 0)::text AS expense
    FROM transactions
    WHERE user_id = ${ctx.userId}
      AND deleted_at IS NULL
      AND date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '4 months')::date
      AND date <  date_trunc('month', CURRENT_DATE)::date
    GROUP BY month_start
    ORDER BY month_start
  `)
  if (rows.length < 2) return []

  const rates = rows.map((r) => {
    const inc = Number.parseFloat(r.income)
    const exp = Number.parseFloat(r.expense)
    return {
      month: r.month_start,
      rate: inc > 0 ? (inc - exp) / inc : null,
      income: inc,
      expense: exp,
    }
  })
  const last = rates[rates.length - 1]!
  if (last.rate === null) return []
  const priorRates = rates.slice(0, -1).map((r) => r.rate).filter((r): r is number => r !== null)
  if (priorRates.length === 0) return []
  const baseline = priorRates.reduce((a, b) => a + b, 0) / priorRates.length
  const delta = last.rate - baseline
  const deltaPts = delta * 100

  const signature = `savings-rate:${last.month}`
  if (deltaPts <= -15) {
    return [
      {
        kind: 'recommendation',
        severity: 'notice',
        title: 'Tu tasa de ahorro cayó',
        body: `En ${last.month} ahorraste ${Math.round(last.rate * 100)}% vs ${Math.round(baseline * 100)}% promedio reciente. ${Math.round(-deltaPts)} puntos por debajo.`,
        data: {
          signature,
          lastRate: Number(last.rate.toFixed(3)),
          baselineRate: Number(baseline.toFixed(3)),
          deltaPts: Number(deltaPts.toFixed(1)),
        },
        action: { type: 'view-transactions', params: {}, label: 'Revisar gastos' },
        status: 'unread',
        periodStart: last.month,
        periodEnd: last.month,
        generatedBy: 'savings-rate-detector',
        signature,
      },
    ]
  }
  if (deltaPts >= 10) {
    return [
      {
        kind: 'achievement',
        severity: 'info',
        title: 'Mejoraste tu tasa de ahorro',
        body: `En ${last.month} ahorraste ${Math.round(last.rate * 100)}% vs ${Math.round(baseline * 100)}% promedio reciente. ${Math.round(deltaPts)} puntos arriba.`,
        data: {
          signature,
          lastRate: Number(last.rate.toFixed(3)),
          baselineRate: Number(baseline.toFixed(3)),
          deltaPts: Number(deltaPts.toFixed(1)),
        },
        action: null,
        status: 'unread',
        periodStart: last.month,
        periodEnd: last.month,
        generatedBy: 'savings-rate-detector',
        signature,
      },
    ]
  }
  return []
}
