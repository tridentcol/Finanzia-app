import { NextResponse } from 'next/server'

import { env } from '@/lib/env'
import { getActiveUserIds } from '@/lib/ai/insights'
import { generateWeeklyCheckin } from '@/lib/ai/checkin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  return header === `Bearer ${env.CRON_SECRET}`
}

/**
 * Check-in semanal proactivo: para cada usuario activo, compone el digest de la
 * semana (agregados + narrativa LLM con su persona) y lo persiste. Idempotente
 * por semana; tolerante a fallos por usuario.
 */
export async function GET(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const userIds = await getActiveUserIds()
  let processed = 0
  for (const userId of userIds) {
    try {
      await generateWeeklyCheckin(userId)
      processed++
    } catch (err) {
      console.error('[weekly-checkin] falló para', userId, err)
    }
  }

  return NextResponse.json({ ok: true, processed })
}
