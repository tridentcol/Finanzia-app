import 'server-only'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { accounts, goals } from '@/lib/db/schema'

export type GoalWithProgress = {
  id: string
  name: string
  targetAmount: string
  currentAmount: string
  currency: string
  targetDate: string | null
  linkedAccountId: string | null
  linkedAccountName: string | null
  status: 'active' | 'paused' | 'completed' | 'abandoned'
  /** 0..1+ — saturado a 1 en la UI. */
  percent: number
  /** Días restantes (negativo si pasada). null si no hay target_date. */
  daysToTarget: number | null
}

export async function listGoalsForUser(userId: string): Promise<GoalWithProgress[]> {
  const rows = await db
    .select({
      id: goals.id,
      name: goals.name,
      targetAmount: goals.targetAmount,
      currentAmount: goals.currentAmount,
      currency: goals.currency,
      targetDate: goals.targetDate,
      linkedAccountId: goals.linkedAccountId,
      linkedAccountName: accounts.name,
      status: goals.status,
    })
    .from(goals)
    .leftJoin(accounts, eq(accounts.id, goals.linkedAccountId))
    .where(and(eq(goals.userId, userId)))
    .orderBy(desc(goals.createdAt))

  const now = Date.now()
  return rows.map((r) => {
    const target = Number.parseFloat(r.targetAmount)
    const current = Number.parseFloat(r.currentAmount)
    const percent = target > 0 ? current / target : 0
    let daysToTarget: number | null = null
    if (r.targetDate) {
      const ts = new Date(`${r.targetDate}T00:00:00Z`).getTime()
      daysToTarget = Math.round((ts - now) / 86_400_000)
    }
    return {
      id: r.id,
      name: r.name,
      targetAmount: r.targetAmount,
      currentAmount: r.currentAmount,
      currency: r.currency,
      targetDate: r.targetDate,
      linkedAccountId: r.linkedAccountId,
      linkedAccountName: r.linkedAccountName,
      status: r.status,
      percent,
      daysToTarget,
    }
  })
}
