import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { and, eq, gte, sql } from 'drizzle-orm'
import { z } from 'zod'

import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { insights, profiles, transactions, users } from '@/lib/db/schema'
import { CLAUDE_MODEL_ID, getAnthropic } from '@/lib/ai/anthropic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

function isAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  return header === `Bearer ${env.CRON_SECRET}`
}

const habitSchema = z.object({
  habits: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        body: z.string().min(1).max(300),
        action_label: z.string().max(50),
        action_href: z.string().max(100),
      }),
    )
    .max(3),
})

async function getActiveUserIds(): Promise<string[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 60)
  const rows = await db
    .selectDistinct({ id: users.id })
    .from(users)
    .innerJoin(transactions, eq(transactions.userId, users.id))
    .where(gte(transactions.date, cutoff.toISOString().slice(0, 10)))
  return rows.map((r) => r.id)
}

async function buildMonthlySnapshot(
  userId: string,
  monthStart: string,
  monthEnd: string,
): Promise<Record<string, unknown>> {
  type Row = { income: string; expense: string; net: string; top_cats: string }
  const rows = await db.execute<Row>(sql`
    WITH monthly AS (
      SELECT
        COALESCE(SUM(CASE WHEN kind='income'  THEN amount_base ELSE 0 END), 0)::text AS income,
        COALESCE(SUM(CASE WHEN kind='expense' THEN amount_base ELSE 0 END), 0)::text AS expense
      FROM transactions
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
        AND date BETWEEN ${monthStart}::date AND ${monthEnd}::date
    ),
    cats AS (
      SELECT
        COALESCE(c.name, 'Sin categoría') AS cat,
        SUM(t.amount_base)::text AS total
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.kind = 'expense'
        AND t.date BETWEEN ${monthStart}::date AND ${monthEnd}::date
      GROUP BY c.name
      ORDER BY SUM(t.amount_base) DESC
      LIMIT 5
    )
    SELECT
      monthly.income,
      monthly.expense,
      (monthly.income::numeric - monthly.expense::numeric)::text AS net,
      json_agg(cats)::text AS top_cats
    FROM monthly, cats
    GROUP BY monthly.income, monthly.expense
  `)
  const row = rows[0]
  return {
    income: row?.income ?? '0',
    expense: row?.expense ?? '0',
    net: row?.net ?? '0',
    topCategories: row?.top_cats ? JSON.parse(row.top_cats) : [],
    period: `${monthStart} al ${monthEnd}`,
  }
}

/**
 * Cron mensual — día 1 de cada mes a las 5am UTC (después del cierre de ahorro).
 * Genera hasta 3 recomendaciones de hábitos para el mes anterior con Claude Sonnet 4.6.
 * Si no hay API key, no-op silencioso.
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const monthStart = lastMonth.toISOString().slice(0, 7) + '-01'
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
  const monthEnd = lastDay.toISOString().slice(0, 10)

  const userIds = await getActiveUserIds()
  let generated = 0
  let skipped = 0

  for (const userId of userIds) {
    try {
      const anthropic = await getAnthropic({ userId })
      if (!anthropic) { skipped++; continue }

      const profile = await db.query.profiles.findFirst({
        where: eq(profiles.userId, userId),
      })

      const snapshot = await buildMonthlySnapshot(userId, monthStart, monthEnd)

      const { object } = await generateObject({
        model: anthropic(CLAUDE_MODEL_ID),
        schema: habitSchema,
        prompt: `Eres un asesor financiero personal para un usuario de ${profile?.baseCurrency ?? 'COP'}.
Basándote en este resumen del mes ${monthStart} al ${monthEnd}:
${JSON.stringify(snapshot, null, 2)}

Genera hasta 3 recomendaciones de hábitos financieros específicas y accionables.
- Sé directo y concreto. Nada genérico.
- Menciona montos o categorías reales del snapshot.
- Cada recomendación debe tener una acción clara.
- Tono: asesor cercano, no condescendiente.
- Idioma: español.`,
      })

      for (const habit of object.habits) {
        const signature = `monthly-review:${habit.title}:${monthStart}`

        const existing = await db
          .select({ id: insights.id })
          .from(insights)
          .where(
            and(
              eq(insights.userId, userId),
              sql`(${insights.data}->>'signature')::text = ${signature}`,
            ),
          )
          .limit(1)

        if (existing.length > 0) continue

        await db.insert(insights).values({
          userId,
          kind: 'recommendation',
          severity: 'notice',
          title: habit.title,
          body: habit.body,
          data: { signature },
          action: { type: 'navigate', params: { href: habit.action_href }, label: habit.action_label },
          status: 'unread',
          periodStart: monthStart,
          periodEnd: monthEnd,
          generatedBy: 'monthly-review-cron',
        })
        generated++
      }
    } catch (err) {
      console.error(`[monthly-review] error para ${userId}:`, err)
      skipped++
    }
  }

  return NextResponse.json({ ok: true, generated, skipped, period: monthEnd })
}
