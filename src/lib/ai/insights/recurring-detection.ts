import 'server-only'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import type { DetectedInsight, InsightContext } from './types'

/**
 * Detecta gastos recurrentes no registrados como `recurring_rule`. Heurística:
 *  - Mismo merchant (case-insensitive) con >= 3 ocurrencias en los últimos
 *    90 días, espaciadas ~mensualmente (intervalo medio entre 25 y 35 días),
 *    sin asociación a recurring_rule existente.
 *
 * Sirve para que el usuario convierta esos pagos en reglas formales (mejor
 * forecasting + reduce sorpresa).
 */
type Row = {
  merchant: string
  count: number
  total_base: string
  avg_interval_days: number
}

const MIN_OCCURRENCES = 3

export async function detectRecurring(
  ctx: InsightContext,
): Promise<DetectedInsight[]> {
  const rows = await db.execute<Row>(sql`
    WITH txs AS (
      SELECT
        LOWER(TRIM(COALESCE(merchant, description))) AS merchant_norm,
        date::date AS date,
        amount_base
      FROM transactions
      WHERE user_id = ${ctx.userId}
        AND deleted_at IS NULL
        AND kind = 'expense'
        AND recurring_rule_id IS NULL
        AND date >= (CURRENT_DATE - INTERVAL '90 days')
    ),
    grouped AS (
      SELECT
        merchant_norm AS merchant,
        COUNT(*)::int AS count,
        SUM(amount_base)::text AS total_base,
        /* date - date retorna integer (días) en Postgres, no interval. */
        (MAX(date) - MIN(date))::numeric / NULLIF(COUNT(*) - 1, 0) AS avg_interval_days
      FROM txs
      WHERE LENGTH(merchant_norm) >= 4
      GROUP BY merchant_norm
    )
    SELECT *
    FROM grouped
    WHERE count >= ${MIN_OCCURRENCES}
      AND avg_interval_days BETWEEN 22 AND 38
    ORDER BY count DESC
    LIMIT 5
  `)

  return rows.map((r) => {
    const signature = `recurring:${r.merchant}:${ctx.today.slice(0, 7)}`
    return {
      kind: 'recommendation',
      severity: 'info',
      title: `Detecté un pago recurrente`,
      body: `"${r.merchant}" aparece ${r.count} veces en los últimos 90 días, espaciado cada ${Math.round(r.avg_interval_days)} días. Considera registrarlo como recurring para mejor forecast.`,
      data: {
        signature,
        merchant: r.merchant,
        occurrences: r.count,
        avgIntervalDays: Math.round(r.avg_interval_days),
        totalBase: Number.parseFloat(r.total_base).toFixed(2),
      },
      action: { type: 'view-recurring', params: {}, label: 'Crear recurring' },
      status: 'unread',
      periodStart: ctx.today,
      periodEnd: ctx.today,
      generatedBy: 'recurring-detector',
      signature,
    }
  })
}
