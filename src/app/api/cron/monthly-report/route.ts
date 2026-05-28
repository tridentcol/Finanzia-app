import { NextResponse } from 'next/server'
import { generateText } from 'ai'
import { sql } from 'drizzle-orm'
import { z } from 'zod'

import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { monthlyReports, users } from '@/lib/db/schema'
import { CLAUDE_MODEL_ID, getAnthropic } from '@/lib/ai/anthropic'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isAuthorized(req: Request): boolean {
  const header = req.headers.get('authorization') ?? req.headers.get('Authorization')
  return header === `Bearer ${env.CRON_SECRET}`
}

type CategoryStat = { name: string; amount: string; count: number }
type MerchantStat = { name: string; amount: string; count: number }

type UserReportRow = {
  user_id: string
  total_income: string
  total_expense: string
  top_categories: CategoryStat[]
  top_merchants: MerchantStat[]
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  // Report for the previous month
  const year = now.getUTCMonth() === 0 ? now.getUTCFullYear() - 1 : now.getUTCFullYear()
  const month = now.getUTCMonth() === 0 ? 12 : now.getUTCMonth()
  const period = `${year}-${String(month).padStart(2, '0')}`
  const periodStart = `${period}-01`
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const periodEnd = `${period}-${String(lastDay).padStart(2, '0')}`

  const rows = await db.execute<UserReportRow>(sql`
    WITH base AS (
      SELECT
        t.user_id,
        t.kind,
        t.amount_base::numeric AS amount,
        COALESCE(c.name, 'Sin categoría') AS category,
        COALESCE(t.merchant, t.description) AS merchant
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.deleted_at IS NULL
        AND t.date >= ${periodStart}::date
        AND t.date <= ${periodEnd}::date
    ),
    agg AS (
      SELECT
        user_id,
        SUM(CASE WHEN kind = 'income' THEN amount ELSE 0 END)::text   AS total_income,
        SUM(CASE WHEN kind = 'expense' THEN amount ELSE 0 END)::text  AS total_expense
      FROM base
      GROUP BY user_id
    ),
    cats AS (
      SELECT
        user_id,
        category,
        SUM(amount)::text AS amount,
        COUNT(*)::int     AS cnt
      FROM base
      WHERE kind = 'expense'
      GROUP BY user_id, category
    ),
    mers AS (
      SELECT
        user_id,
        merchant,
        SUM(amount)::text AS amount,
        COUNT(*)::int     AS cnt
      FROM base
      WHERE kind = 'expense'
      GROUP BY user_id, merchant
    )
    SELECT
      agg.user_id,
      agg.total_income,
      agg.total_expense,
      COALESCE(
        (SELECT json_agg(r ORDER BY r.amount::numeric DESC) FROM (
          SELECT category AS name, amount, cnt AS count FROM cats c2
          WHERE c2.user_id = agg.user_id ORDER BY amount::numeric DESC LIMIT 5
        ) r), '[]'
      ) AS top_categories,
      COALESCE(
        (SELECT json_agg(r ORDER BY r.amount::numeric DESC) FROM (
          SELECT merchant AS name, amount, cnt AS count FROM mers m2
          WHERE m2.user_id = agg.user_id ORDER BY amount::numeric DESC LIMIT 5
        ) r), '[]'
      ) AS top_merchants
    FROM agg
  `)

  let processed = 0

  for (const row of rows) {
    const income = Number.parseFloat(row.total_income ?? '0')
    const expense = Number.parseFloat(row.total_expense ?? '0')
    const netSavings = income - expense

    let aiSummary: string | null = null
    let aiHabits: Array<{ title: string; body: string; kind: 'positive' | 'negative' | 'neutral' }> = []

    try {
      const anthropic = await getAnthropic({ userId: row.user_id })
      if (anthropic) {
        const topCats = (row.top_categories ?? [])
          .slice(0, 3)
          .map((c) => `${c.name}: $${Number.parseFloat(c.amount).toLocaleString('es-CO', { maximumFractionDigits: 0 })}`)
          .join(', ')

        const prompt = `Eres el analizador financiero de Finanzia. Resume el mes ${period} del usuario en máximo 2 oraciones en español, sin emojis, tono editorial profesional.
Ingresos: $${income.toLocaleString('es-CO', { maximumFractionDigits: 0 })} | Gastos: $${expense.toLocaleString('es-CO', { maximumFractionDigits: 0 })} | Ahorro neto: $${netSavings.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
Top categorías de gasto: ${topCats || 'sin datos'}.
Identifica 1-2 hábitos financieros en formato JSON: [{"title":"...","body":"...","kind":"positive|negative|neutral"}]
Responde con: SUMMARY: <resumen>\nHABITS: <json>`

        const { text } = await generateText({
          model: anthropic(CLAUDE_MODEL_ID),
          prompt,
          maxOutputTokens: 400,
        })

        const summaryMatch = /SUMMARY:\s*(.+?)(?:\n|HABITS:)/s.exec(text)
        const habitsMatch = /HABITS:\s*(\[.+?\])/s.exec(text)

        if (summaryMatch?.[1]) aiSummary = summaryMatch[1].trim()
        if (habitsMatch?.[1]) {
          try {
            const parsed = z
              .array(
                z.object({
                  title: z.string(),
                  body: z.string(),
                  kind: z.enum(['positive', 'negative', 'neutral']),
                }),
              )
              .safeParse(JSON.parse(habitsMatch[1]))
            if (parsed.success) aiHabits = parsed.data
          } catch {
            // skip habits if parse fails
          }
        }
      }
    } catch {
      // AI optional
    }

    await db
      .insert(monthlyReports)
      .values({
        userId: row.user_id,
        period,
        totalIncome: row.total_income ?? '0',
        totalExpense: row.total_expense ?? '0',
        netSavings: netSavings.toFixed(2),
        topCategories: row.top_categories ?? [],
        topMerchants: row.top_merchants ?? [],
        aiSummary,
        aiHabits,
      })
      .onConflictDoUpdate({
        target: [monthlyReports.userId, monthlyReports.period],
        set: {
          totalIncome: row.total_income ?? '0',
          totalExpense: row.total_expense ?? '0',
          netSavings: netSavings.toFixed(2),
          topCategories: row.top_categories ?? [],
          topMerchants: row.top_merchants ?? [],
          aiSummary,
          aiHabits,
          generatedAt: new Date(),
        },
      })

    processed++
  }

  return NextResponse.json({ ok: true, period, processed })
}
