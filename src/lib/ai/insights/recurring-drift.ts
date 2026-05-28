import 'server-only'
import { and, desc, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { recurringRules, transactions } from '@/lib/db/schema'
import type { DetectedInsight, InsightContext } from './types'

/**
 * Detecta cuando una regla recurrente conocida cobró en un día distinto al
 * esperado (dayOfMonth ± toleranceDays). Solo aplica a reglas con dayOfMonth
 * configurado y con transacciones reales vinculadas (recurring_rule_id).
 */
export async function detectRecurringDrift(ctx: InsightContext): Promise<DetectedInsight[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 45)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  const rules = await db
    .select({
      id: recurringRules.id,
      description: recurringRules.description,
      dayOfMonth: recurringRules.dayOfMonth,
      toleranceDays: sql<number>`COALESCE(${recurringRules}.tolerance_days, 2)`,
    })
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.userId, ctx.userId),
        eq(recurringRules.active, true),
        isNotNull(recurringRules.dayOfMonth),
      ),
    )

  if (rules.length === 0) return []

  const insights: DetectedInsight[] = []

  for (const rule of rules) {
    if (!rule.dayOfMonth) continue

    const recentTxs = await db
      .select({ date: transactions.date })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, ctx.userId),
          eq(transactions.recurringRuleId, rule.id),
          isNull(transactions.deletedAt),
          gte(transactions.date, cutoffStr),
        ),
      )
      .orderBy(desc(transactions.date))
      .limit(1)

    if (recentTxs.length === 0) continue

    const lastTx = recentTxs[0]!
    const actualDay = new Date(lastTx.date + 'T12:00:00Z').getUTCDate()
    const expectedDay = rule.dayOfMonth
    const tolerance = rule.toleranceDays ?? 2

    const delta = actualDay - expectedDay
    if (Math.abs(delta) <= tolerance) continue

    const monthStr = lastTx.date.slice(0, 7)
    const signature = `recurring-drift:${rule.id}:${monthStr}`

    const direction = delta > 0 ? `${delta} días después` : `${Math.abs(delta)} días antes`

    insights.push({
      kind: 'anomaly' as const,
      severity: 'notice' as const,
      title: `"${rule.description}" cobró fuera de lo usual`,
      body: `Lo esperabas el día ${expectedDay} pero llegó el día ${actualDay} (${direction} de lo habitual).`,
      data: { signature, ruleId: rule.id, expectedDay, actualDay, delta },
      action: { type: 'navigate', params: { href: '/ajustes/recurring' }, label: 'Ver recurrentes' },
      status: 'unread',
      periodStart: monthStr + '-01',
      periodEnd: lastTx.date,
      generatedBy: 'recurring-drift-detector',
      signature,
    })
  }

  return insights
}
