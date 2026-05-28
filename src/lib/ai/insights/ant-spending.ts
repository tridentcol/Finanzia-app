import 'server-only'
import { and, eq, gte, isNull, lt, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import type { DetectedInsight, InsightContext } from './types'

/**
 * Detecta gastos hormiga: merchants con 4+ compras en el mes actual,
 * donde el monto individual es < 5% del ingreso mensual.
 * Emite insight por cada merchant problemático (cap 3 insights).
 */
export async function detectAntSpending(ctx: InsightContext): Promise<DetectedInsight[]> {
  const monthStart = new Date()
  monthStart.setDate(1)
  const monthStartStr = monthStart.toISOString().slice(0, 10)

  type Row = {
    merchant: string
    total: string
    tx_count: string
    avg_amount: string
  }

  const rows = await db.execute<Row>(sql`
    WITH monthly_income AS (
      SELECT COALESCE(SUM(amount_base), 0) AS income
      FROM transactions
      WHERE user_id = ${ctx.userId}
        AND deleted_at IS NULL
        AND kind = 'income'
        AND date >= ${monthStartStr}::date
    ),
    merchant_stats AS (
      SELECT
        COALESCE(merchant, description) AS merchant,
        SUM(amount_base)::text  AS total,
        COUNT(*)::text          AS tx_count,
        AVG(amount_base)::text  AS avg_amount
      FROM transactions, monthly_income
      WHERE user_id = ${ctx.userId}
        AND deleted_at IS NULL
        AND kind = 'expense'
        AND date >= ${monthStartStr}::date
        AND merchant IS NOT NULL
        AND amount_base < GREATEST(monthly_income.income * 0.05, 1)
      GROUP BY COALESCE(merchant, description)
      HAVING COUNT(*) >= 4
    )
    SELECT * FROM merchant_stats
    ORDER BY (total::numeric) DESC
    LIMIT 3
  `)

  if (rows.length === 0) return []

  const monthLabel = monthStartStr.slice(0, 7)

  return rows.map((row) => {
    const signature = `ant-spending:${row.merchant}:${monthLabel}`
    const total = Number.parseFloat(row.total)
    const count = Number.parseInt(row.tx_count)
    const totalFmt = total.toLocaleString('es-CO', { maximumFractionDigits: 0 })

    return {
      kind: 'anomaly' as const,
      severity: 'notice' as const,
      title: `Gasto hormiga: "${row.merchant}"`,
      body: `Hiciste ${count} compras por un total de $${totalFmt} ${ctx.baseCurrency} este mes. Pequeñas, pero suman.`,
      data: { signature, merchant: row.merchant, total: row.total, count },
      action: {
        type: 'view-transactions',
        params: {},
        label: `Ver gastos en ${row.merchant}`,
      },
      status: 'unread',
      periodStart: monthStartStr,
      periodEnd: ctx.today,
      generatedBy: 'ant-spending-detector',
      signature,
    }
  })
}
