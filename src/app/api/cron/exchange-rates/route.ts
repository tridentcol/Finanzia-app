import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { fetchDailyRates, upsertRates } from '@/lib/currency/rates'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron endpoint para refrescar `exchange_rates`.
 *
 * Vercel Cron invoca esta ruta con un header
 * `Authorization: Bearer ${CRON_SECRET}`. Si el header no coincide, devuelve
 * 401. En desarrollo puedes invocarlo manualmente con el mismo header.
 *
 * Frecuencia configurada en `vercel.json`: diaria a las 06:00 UTC (01:00
 * America/Bogota). El provider solo refresca una vez al día, así que llamadas
 * extra son idempotentes (upsert).
 */
function isAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!header) return false
  const expected = `Bearer ${env.CRON_SECRET}`
  return header === expected
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'Token inválido.' } },
      { status: 401 },
    )
  }

  const startedAt = Date.now()
  try {
    const rates = await fetchDailyRates()
    const inserted = await upsertRates(rates)
    return NextResponse.json({
      ok: true,
      data: {
        upserted: inserted,
        pairs: rates.length,
        durationMs: Date.now() - startedAt,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'fetch_failed', message },
      },
      { status: 502 },
    )
  }
}
