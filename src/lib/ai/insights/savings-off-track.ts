import 'server-only'
import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { savingsPeriods, savingsPlans } from '@/lib/db/schema'
import type { DetectedInsight, InsightContext } from './types'

/**
 * Detecta si el usuario lleva 2 meses consecutivos con achieved < target × 0.5.
 * Solo aplica cuando tiene plan activo de tipo percentage_income o fixed_amount.
 */
export async function detectSavingsOffTrack(ctx: InsightContext): Promise<DetectedInsight[]> {
  const periods = await db
    .select({
      periodEnd: savingsPeriods.periodEnd,
      targetAmount: savingsPeriods.targetAmount,
      achievedAmount: savingsPeriods.achievedAmount,
    })
    .from(savingsPeriods)
    .innerJoin(savingsPlans, eq(savingsPeriods.planId, savingsPlans.id))
    .where(eq(savingsPeriods.userId, ctx.userId))
    .orderBy(desc(savingsPeriods.periodEnd))
    .limit(3)

  if (periods.length < 2) return []

  // Necesitamos los 2 más recientes con target > 0
  const withTarget = periods.filter((p) => Number.parseFloat(p.targetAmount) > 0)
  if (withTarget.length < 2) return []

  const [last, prev] = [withTarget[0]!, withTarget[1]!]
  const lastMissed = Number.parseFloat(last.achievedAmount) < Number.parseFloat(last.targetAmount) * 0.5
  const prevMissed = Number.parseFloat(prev.achievedAmount) < Number.parseFloat(prev.targetAmount) * 0.5

  if (!lastMissed || !prevMissed) return []

  const signature = `savings-off-track:${last.periodEnd}`
  const lastPct = Math.round(
    (Number.parseFloat(last.achievedAmount) / Number.parseFloat(last.targetAmount)) * 100,
  )

  return [
    {
      kind: 'recommendation',
      severity: 'warning',
      title: 'Llevas 2 meses por debajo de tu meta de ahorro',
      body: `En los últimos 2 meses tu ahorro efectivo no superó el 50% de tu meta. El mes más reciente alcanzaste el ${lastPct}% del objetivo.`,
      data: {
        signature,
        lastPeriodEnd: last.periodEnd,
        lastAchieved: last.achievedAmount,
        lastTarget: last.targetAmount,
      },
      action: { type: 'navigate', params: { href: '/ahorro' }, label: 'Ver mi historial de ahorro' },
      status: 'unread',
      periodStart: prev.periodEnd,
      periodEnd: last.periodEnd,
      generatedBy: 'savings-off-track-detector',
      signature,
    },
  ]
}
