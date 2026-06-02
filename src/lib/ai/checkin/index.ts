import 'server-only'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { generateText } from 'ai'

import { db } from '@/lib/db/client'
import { profiles, weeklyCheckins } from '@/lib/db/schema'
import type { CheckinHighlights } from '@/lib/db/schema'
import { CLAUDE_MODEL_ID, getAnthropic } from '@/lib/ai/anthropic'
import { parsePersona, personaToToneHints, type Persona } from '@/lib/ai/copilot/persona'
import { listRecurringForUser } from '@/lib/db/queries/recurring'
import { listGoalsForUser } from '@/lib/db/queries/goals'
import { listInsightsForUser } from '@/lib/db/queries/insights'

/** Ventana de la semana: termina hoy (el domingo que corre el cron) y abarca
 *  los 7 días previos. Determinista a partir de `todayIso`. */
export function weekWindow(todayIso: string): { weekStart: string; weekEnd: string } {
  const today = new Date(`${todayIso}T12:00:00Z`)
  const start = new Date(today)
  start.setUTCDate(start.getUTCDate() - 6)
  return { weekStart: start.toISOString().slice(0, 10), weekEnd: todayIso }
}

type WeekAggRow = {
  income: string
  expense: string
  prev4_expense: string
  top_categories: Array<{ name: string; amount: string }>
}

/**
 * Junta SOLO agregados de la semana (privacidad: nunca transacciones sueltas):
 * totales, top categorías de gasto, gasto vs promedio de 4 semanas, recurrentes
 * próximos, metas en riesgo e insights destacados de la semana.
 */
async function gatherHighlights(
  userId: string,
  weekStart: string,
  weekEnd: string,
  todayIso: string,
): Promise<CheckinHighlights> {
  const prevStart = new Date(`${weekStart}T12:00:00Z`)
  prevStart.setUTCDate(prevStart.getUTCDate() - 28)
  const prevStartIso = prevStart.toISOString().slice(0, 10)

  const rows = await db.execute<WeekAggRow>(sql`
    WITH week AS (
      SELECT t.kind, t.amount_base::numeric AS amount,
             COALESCE(c.name, 'Sin categoría') AS category
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ${userId} AND t.deleted_at IS NULL
        AND t.date >= ${weekStart}::date AND t.date <= ${weekEnd}::date
    ),
    prev AS (
      SELECT SUM(t.amount_base::numeric) AS expense
      FROM transactions t
      WHERE t.user_id = ${userId} AND t.deleted_at IS NULL AND t.kind = 'expense'
        AND t.date >= ${prevStartIso}::date AND t.date < ${weekStart}::date
    ),
    cats AS (
      SELECT category, SUM(amount)::text AS amount
      FROM week WHERE kind = 'expense'
      GROUP BY category ORDER BY SUM(amount) DESC LIMIT 4
    )
    SELECT
      COALESCE((SELECT SUM(amount) FROM week WHERE kind = 'income'), 0)::text  AS income,
      COALESCE((SELECT SUM(amount) FROM week WHERE kind = 'expense'), 0)::text AS expense,
      COALESCE((SELECT expense FROM prev), 0)::text                            AS prev4_expense,
      COALESCE((SELECT json_agg(json_build_object('name', category, 'amount', amount)) FROM cats), '[]') AS top_categories
  `)

  const agg = rows[0]
  const income = agg?.income ?? '0'
  const expense = agg?.expense ?? '0'
  const expenseNum = Number.parseFloat(expense)
  const avgWeekExpense = (Number.parseFloat(agg?.prev4_expense ?? '0') / 4).toFixed(2)
  const avgNum = Number.parseFloat(avgWeekExpense)
  const vsAverage =
    avgNum > 0
      ? {
          weekExpense: expense,
          avgWeekExpense,
          deltaPct: Math.round(((expenseNum - avgNum) / avgNum) * 100),
        }
      : null

  // Recurrentes que vencen en los próximos 7 días.
  const horizon = new Date(`${todayIso}T12:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + 7)
  const horizonIso = horizon.toISOString().slice(0, 10)
  const rules = await listRecurringForUser(userId)
  const upcomingRecurring = rules
    .filter((r) => r.active && r.nextRun && r.nextRun >= todayIso && r.nextRun <= horizonIso)
    .sort((a, b) => (a.nextRun! < b.nextRun! ? -1 : 1))
    .slice(0, 5)
    .map((r) => ({
      description: r.description,
      amount: r.amount,
      currency: r.currency,
      date: r.nextRun!,
    }))

  // Metas activas en riesgo: fecha cercana y avance bajo.
  const goals = await listGoalsForUser(userId)
  const goalsAtRisk = goals
    .filter(
      (g) =>
        g.status === 'active' &&
        g.daysToTarget !== null &&
        g.daysToTarget > 0 &&
        g.daysToTarget <= 90 &&
        g.percent < 75,
    )
    .slice(0, 3)
    .map((g) => ({ name: g.name, percent: g.percent, daysToTarget: g.daysToTarget }))

  // Insights destacados generados esta semana.
  const insights = await listInsightsForUser(userId, { includeDismissed: false, limit: 20 })
  const insightTitles = insights
    .filter((i) => i.createdAt.toISOString().slice(0, 10) >= weekStart)
    .slice(0, 3)
    .map((i) => i.title)

  return {
    net: { income, expense, net: (Number.parseFloat(income) - expenseNum).toFixed(2) },
    vsAverage,
    topCategories: agg?.top_categories ?? [],
    upcomingRecurring,
    goalsAtRisk,
    insightTitles,
  }
}

/** Resumen determinista (fallback sin LLM o si el LLM falla). Editorial, sin emojis. */
function fallbackSummary(h: CheckinHighlights, baseCurrency: string): string {
  const fmt = (v: string) =>
    `${Math.round(Number.parseFloat(v)).toLocaleString('es-CO')} ${baseCurrency}`
  const parts: string[] = []
  parts.push(`Esta semana gastaste ${fmt(h.net.expense)}.`)
  if (h.vsAverage) {
    const d = h.vsAverage.deltaPct
    if (d >= 8) parts.push(`Es ${d}% más que tu promedio de las últimas semanas.`)
    else if (d <= -8) parts.push(`Es ${Math.abs(d)}% menos que tu promedio — buen ritmo.`)
    else parts.push('En línea con tu promedio reciente.')
  }
  if (h.upcomingRecurring.length > 0) {
    parts.push(
      `Vienen ${h.upcomingRecurring.length} ${h.upcomingRecurring.length === 1 ? 'cargo recurrente' : 'cargos recurrentes'} esta semana.`,
    )
  }
  if (h.goalsAtRisk.length > 0) {
    parts.push(
      `${h.goalsAtRisk.length} ${h.goalsAtRisk.length === 1 ? 'meta necesita' : 'metas necesitan'} atención para llegar a tiempo.`,
    )
  }
  return parts.join(' ')
}

/** Directiva de tono compacta derivada de la persona del usuario (reusa los
 *  hints del copiloto sin arrastrar todo el system prompt). */
function toneDirective(persona: Persona | null): string {
  if (!persona) return ''
  const h = personaToToneHints(persona)
  const bits: string[] = []
  if (h.verbosity === 'low') bits.push('muy conciso')
  else if (h.verbosity === 'high') bits.push('algo más explicativo')
  if (h.explainTerms) bits.push('sin jerga financiera (o explicándola)')
  if (h.moneyStyle === 'espontaneo') bits.push('sin tono de regaño')
  return bits.length ? `Tono del usuario: ${bits.join(', ')}.` : ''
}

async function buildNarrative(
  userId: string,
  highlights: CheckinHighlights,
  baseCurrency: string,
  persona: Persona | null,
): Promise<string> {
  const fallback = fallbackSummary(highlights, baseCurrency)
  let anthropic
  try {
    anthropic = await getAnthropic({ userId })
  } catch {
    return fallback
  }
  if (!anthropic) return fallback

  const fmt = (v: string) =>
    `${Math.round(Number.parseFloat(v)).toLocaleString('es-CO')} ${baseCurrency}`
  const cats = highlights.topCategories
    .map((c) => `${c.name}: ${fmt(c.amount)}`)
    .join(', ')
  const vs = highlights.vsAverage
    ? `${highlights.vsAverage.deltaPct >= 0 ? '+' : ''}${highlights.vsAverage.deltaPct}% vs promedio`
    : 'sin base de comparación'

  const prompt = `Eres el copiloto de Finanzia escribiendo el check-in semanal del usuario. Escribe un resumen breve (máximo 3 oraciones), en español, sin emojis, tono editorial cálido pero profesional. Habla en segunda persona ("tú"). No inventes datos fuera de los provistos. ${toneDirective(persona)}

Datos de la semana (moneda ${baseCurrency}):
- Ingresos: ${fmt(highlights.net.income)} | Gastos: ${fmt(highlights.net.expense)} | Neto: ${fmt(highlights.net.net)}
- Gasto ${vs}.
- Top categorías de gasto: ${cats || 'sin gastos categorizados'}.
- Recurrentes que vienen (7 días): ${highlights.upcomingRecurring.length}.
- Metas en riesgo: ${highlights.goalsAtRisk.map((g) => g.name).join(', ') || 'ninguna'}.
- Señales detectadas: ${highlights.insightTitles.join('; ') || 'ninguna'}.

Responde SOLO con el resumen, sin encabezados.`

  try {
    const { text } = await generateText({
      model: anthropic(CLAUDE_MODEL_ID),
      prompt,
      maxOutputTokens: 220,
    })
    const trimmed = text.trim()
    return trimmed.length > 0 ? trimmed : fallback
  } catch {
    return fallback
  }
}

/**
 * Genera (o regenera) el check-in semanal de un usuario y lo persiste. Idempotente
 * por (userId, weekStart): re-correr el cron el mismo domingo actualiza, no duplica.
 */
export async function generateWeeklyCheckin(
  userId: string,
): Promise<{ weekStart: string; generated: boolean }> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })
  const baseCurrency = profile?.baseCurrency ?? 'COP'
  const persona = parsePersona(
    (profile?.aiProfile as Record<string, unknown> | null)?.persona,
  )

  const todayIso = new Date().toISOString().slice(0, 10)
  const { weekStart, weekEnd } = weekWindow(todayIso)

  const highlights = await gatherHighlights(userId, weekStart, weekEnd, todayIso)
  const aiSummary = await buildNarrative(userId, highlights, baseCurrency, persona)

  await db
    .insert(weeklyCheckins)
    .values({ userId, weekStart, weekEnd, aiSummary, highlights, status: 'unread' })
    .onConflictDoUpdate({
      target: [weeklyCheckins.userId, weeklyCheckins.weekStart],
      set: { weekEnd, aiSummary, highlights, status: 'unread', generatedAt: new Date() },
    })

  return { weekStart, generated: true }
}
