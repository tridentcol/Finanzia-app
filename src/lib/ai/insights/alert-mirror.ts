import 'server-only'
import { and, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { alerts } from '@/lib/db/schema'
import type { DetectedInsight } from './types'

/**
 * A partir de los insights generados, derivamos alerts equivalentes para el
 * canal de notificaciones. Sólo escalan severidades:
 *  - kind=anomaly severity in (notice|warning) → alert.kind=unusual_spend
 *  - kind=forecast severity warning            → alert.kind=budget_exceeded
 *  - kind=recommendation severity warning      → alert.kind=low_balance
 *
 * Dedupe por mensaje en ventana 24h (mismo userId + mismo message).
 */
export async function mirrorAlertsForInsights(
  userId: string,
  insights: DetectedInsight[],
): Promise<number> {
  const candidates: Array<{
    kind: 'unusual_spend' | 'budget_exceeded' | 'recurring_due' | 'low_balance' | 'goal_at_risk'
    refId: string | null
    message: string
  }> = []

  for (const ins of insights) {
    if (ins.kind === 'anomaly' && (ins.severity === 'notice' || ins.severity === 'warning')) {
      candidates.push({
        kind: 'unusual_spend',
        refId: null,
        message: ins.title,
      })
    }
    if (ins.kind === 'forecast' && ins.severity === 'warning') {
      candidates.push({
        kind: 'budget_exceeded',
        refId: null,
        message: ins.title,
      })
    }
  }

  if (candidates.length === 0) return 0

  const messages = candidates.map((c) => c.message)
  const existing = await db
    .select({ message: alerts.message })
    .from(alerts)
    .where(
      and(
        eq(alerts.userId, userId),
        gte(alerts.createdAt, new Date(Date.now() - 24 * 3600 * 1000)),
        sql`${alerts.message} = ANY(${messages})`,
      ),
    )
  const existingSet = new Set(existing.map((r) => r.message))
  const toInsert = candidates.filter((c) => !existingSet.has(c.message))
  if (toInsert.length === 0) return 0
  await db.insert(alerts).values(
    toInsert.map((c) => ({
      userId,
      kind: c.kind,
      refId: c.refId,
      message: c.message,
    })),
  )
  return toInsert.length
}
