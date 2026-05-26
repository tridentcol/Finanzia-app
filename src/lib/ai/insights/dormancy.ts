import 'server-only'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import type { DetectedInsight, InsightContext } from './types'

/**
 * Cuentas dormidas: sin movimiento en los últimos 45 días pero con saldo no
 * trivial. Útil para flaggear plata olvidada en una cuenta que el usuario
 * podría querer mover.
 */
type Row = {
  account_id: string
  name: string
  currency: string
  balance: string
  days_since: number
}

const DORMANCY_DAYS = 45
const MIN_BALANCE_BASE = 50000 // ~ 50k en moneda base; arbitrario pero no trivial

export async function detectDormancy(
  ctx: InsightContext,
): Promise<DetectedInsight[]> {
  const rows = await db.execute<Row>(sql`
    WITH last_activity AS (
      SELECT
        a.id AS account_id,
        a.name,
        a.currency,
        a.initial_balance::text AS balance,
        COALESCE(
          MAX(t.date::date),
          a.created_at::date
        ) AS last_date
      FROM accounts a
      LEFT JOIN transactions t
        ON t.account_id = a.id
       AND t.user_id = ${ctx.userId}
       AND t.deleted_at IS NULL
      WHERE a.user_id = ${ctx.userId}
        AND a.archived = false
      GROUP BY a.id, a.name, a.currency, a.initial_balance, a.created_at
    )
    SELECT
      account_id,
      name,
      currency,
      balance,
      (CURRENT_DATE - last_date)::int AS days_since
    FROM last_activity
    WHERE last_date < CURRENT_DATE - INTERVAL '${sql.raw(String(DORMANCY_DAYS))} days'
  `)

  const out: DetectedInsight[] = []
  for (const r of rows) {
    const bal = Number.parseFloat(r.balance)
    if (!Number.isFinite(bal) || Math.abs(bal) < MIN_BALANCE_BASE) continue
    const signature = `dormancy:${r.account_id}:${ctx.today.slice(0, 7)}`
    out.push({
      kind: 'recommendation',
      severity: 'info',
      title: `Cuenta sin movimiento: ${r.name}`,
      body: `Lleva ${r.days_since} días sin movimientos. Saldo registrado: ${bal} ${r.currency}.`,
      data: {
        signature,
        accountId: r.account_id,
        accountName: r.name,
        balance: bal.toFixed(2),
        currency: r.currency,
        daysSince: r.days_since,
      },
      action: { type: 'view-transactions', params: { accountId: r.account_id }, label: 'Revisar cuenta' },
      status: 'unread',
      periodStart: ctx.today,
      periodEnd: ctx.today,
      generatedBy: 'dormancy-detector',
      signature,
    })
  }
  return out
}
