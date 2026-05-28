import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { savingsPeriods } from '@/lib/db/schema'
import {
  listUsersWithActiveSavingsPlan,
  getNetCashFlowForPeriod,
} from '@/lib/db/queries/savings'
import { sql } from 'drizzle-orm'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function isAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  return header === `Bearer ${env.CRON_SECRET}`
}

/**
 * Cron mensual — día 1 de cada mes a las 3am UTC.
 * Cierra el período de ahorro del mes anterior para cada usuario activo.
 * Idempotente: usa upsert por (user_id, period_end).
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // El período a cerrar es el mes anterior.
  const now = new Date()
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const periodStart = lastMonthDate.toISOString().slice(0, 7) + '-01'
  // Último día del mes anterior
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
  const periodEnd = lastDay.toISOString().slice(0, 10)

  const users = await listUsersWithActiveSavingsPlan()

  let processed = 0
  let errors = 0

  for (const u of users) {
    try {
      const { income, net } = await getNetCashFlowForPeriod(u.userId, periodStart, periodEnd)

      let target = 0
      const params = u.params as Record<string, unknown> | null
      if (u.method === 'percentage_income' && typeof params?.percent === 'number') {
        target = (params.percent / 100) * income
      } else if (u.method === 'fixed_amount' && typeof params?.amount === 'string') {
        target = Number.parseFloat(params.amount)
      }

      // Upsert idempotente por (user_id, period_end).
      await db.execute(sql`
        INSERT INTO savings_periods (user_id, plan_id, period_start, period_end, target_amount, achieved_amount, computed_at)
        VALUES (
          ${u.userId}::uuid,
          ${u.planId}::uuid,
          ${periodStart}::date,
          ${periodEnd}::date,
          ${target.toFixed(2)}::numeric,
          ${net.toFixed(2)}::numeric,
          now()
        )
        ON CONFLICT (user_id, period_end)
        DO UPDATE SET
          target_amount  = EXCLUDED.target_amount,
          achieved_amount = EXCLUDED.achieved_amount,
          computed_at    = now()
      `)
      processed++
    } catch (err) {
      console.error(`[close-savings-period] error para ${u.userId}:`, err)
      errors++
    }
  }

  return NextResponse.json({ ok: true, processed, errors, periodEnd })
}
