import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { alerts } from '@/lib/db/schema'

export type AlertListItem = {
  id: string
  kind: 'unusual_spend' | 'budget_exceeded' | 'recurring_due' | 'low_balance' | 'goal_at_risk'
  message: string
  refId: string | null
  read: boolean
  createdAt: Date
}

export async function listAlertsForUser(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
): Promise<AlertListItem[]> {
  const conditions = [eq(alerts.userId, userId)]
  if (options.unreadOnly) conditions.push(eq(alerts.read, false))
  const rows = await db
    .select({
      id: alerts.id,
      kind: alerts.kind,
      message: alerts.message,
      refId: alerts.refId,
      read: alerts.read,
      createdAt: alerts.createdAt,
    })
    .from(alerts)
    .where(and(...conditions))
    .orderBy(desc(alerts.createdAt))
    .limit(options.limit ?? 30)
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    message: r.message,
    refId: r.refId,
    read: r.read,
    createdAt: r.createdAt,
  }))
}

export async function countUnreadAlerts(userId: string): Promise<number> {
  const rows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(alerts)
    .where(and(eq(alerts.userId, userId), eq(alerts.read, false)))
  return rows[0]?.c ?? 0
}
