import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'

import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { getActiveUserIds } from '@/lib/ai/insights'
import { backfillNetWorth, captureNetWorthSnapshot } from '@/lib/db/queries/net-worth'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  return header === `Bearer ${env.CRON_SECRET}`
}

/**
 * Snapshot mensual de patrimonio neto: para cada usuario activo captura el
 * punto de hoy (con composición) y rellena el histórico que falte desde el
 * ledger (idempotente). Tolerante a fallos por usuario.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userIds = await getActiveUserIds()
  const today = new Date().toISOString().slice(0, 10)
  let processed = 0

  for (const userId of userIds) {
    try {
      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
      })
      const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode
      await backfillNetWorth(userId, baseCurrency, today)
      await captureNetWorthSnapshot(userId, baseCurrency, today)
      processed++
    } catch (err) {
      console.error('[net-worth] falló para', userId, err)
    }
  }

  return NextResponse.json({ ok: true, processed })
}
