import 'server-only'
import { and, eq, isNull } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { profiles, savingsPlans } from '@/lib/db/schema'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import {
  getTotalBalanceInBase,
  listAccountsWithBalance,
} from '@/lib/db/queries/accounts'
import { getNetCashFlowForPeriod } from '@/lib/db/queries/savings'
import { listBudgetsWithProgress } from '@/lib/db/queries/budgets'
import { getDebtsSummary } from '@/lib/db/queries/debts'
import { listGoalsForUser } from '@/lib/db/queries/goals'
import { executeQuery } from '@/lib/copilot/query/execute'
import type { Query } from '@/lib/copilot/query/types'
import { parsePersona, personaToSnapshotLines } from './persona'

export type SnapshotContext = {
  userId: string
  baseCurrency: string
  /** ISO YYYY-MM-DD del "hoy" del request. */
  todayIso: string
}

/** Rango de ingreso declarado (aiProfile.incomeRange) → etiqueta legible. */
const INCOME_LABEL: Record<string, string> = {
  under_2m: 'menos de 2M/mes',
  '2m_5m': '2–5M/mes',
  '5m_10m': '5–10M/mes',
  '10m_20m': '10–20M/mes',
  over_20m: 'más de 20M/mes',
}

function savingsPlanLabel(method: string, params: unknown): string {
  const p = (params ?? {}) as { percent?: number; amount?: string }
  if (method === 'percentage_income' && typeof p.percent === 'number') {
    return `ahorrar ${p.percent}% del ingreso`
  }
  if (method === 'fixed_amount' && p.amount) {
    return `ahorrar un monto fijo (${p.amount}) al mes`
  }
  if (method === 'none') return 'sin plan de ahorro definido'
  return 'plan de ahorro personalizado'
}

/** Rango del mes calendario en curso (UTC) a partir de `todayIso`. */
function thisMonth(todayIso: string): { from: string; to: string } {
  const today = new Date(`${todayIso}T00:00:00Z`)
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) }
}

/**
 * Snapshot compacto del perfil financiero del usuario para inyectar en el
 * system prompt. Da contexto para personalizar SIN reemplazar a los tools: las
 * cifras aquí son aproximadas (compactas) y orientativas; para montos exactos
 * el LLM debe consultar los tools. Reusa queries existentes (todas baratas) y
 * tolera fallos por sección (Promise.allSettled). Objetivo: ≤ ~600 tokens.
 */
export async function buildProfileSnapshot(ctx: SnapshotContext): Promise<string> {
  const currency = ctx.baseCurrency as CurrencyCode
  const money = (v: number | string) =>
    formatMoney(v, { currency, compact: true })
  const month = thisMonth(ctx.todayIso)

  const topCatQuery: Query = {
    metric: 'sum',
    subject: 'expense',
    groupBy: 'category',
    filters: {},
    period: { from: month.from, to: month.to, label: 'este mes', granularity: 'month' },
    order: { by: 'value', dir: 'desc' },
    limit: 3,
  }

  const [
    profileR,
    planR,
    accountsR,
    cashR,
    topCatR,
    budgetsR,
    debtsR,
    goalsR,
  ] = await Promise.allSettled([
    db.query.profiles.findFirst({ where: eq(profiles.userId, ctx.userId) }),
    db.query.savingsPlans.findFirst({
      where: and(eq(savingsPlans.userId, ctx.userId), isNull(savingsPlans.activeTo)),
      orderBy: (t, { desc }) => [desc(t.activeFrom)],
    }),
    listAccountsWithBalance(ctx.userId),
    getNetCashFlowForPeriod(ctx.userId, month.from, month.to),
    executeQuery(
      topCatQuery,
      { userId: ctx.userId, baseCurrency: ctx.baseCurrency, todayIso: ctx.todayIso },
    ),
    listBudgetsWithProgress(ctx.userId),
    getDebtsSummary(ctx.userId, currency),
    listGoalsForUser(ctx.userId),
  ])

  const lines: string[] = []

  // Identidad + ingreso declarado.
  const profile = profileR.status === 'fulfilled' ? profileR.value : undefined
  const locale = profile?.locale ?? 'es-CO'
  const tz = profile?.timezone ?? 'America/Bogota'
  lines.push(`- Moneda base ${ctx.baseCurrency} · locale ${locale} · zona ${tz}.`)
  const ai = profile?.aiProfile as
    | { incomeRange?: string; mainGoal?: string; riskTolerance?: string; persona?: unknown }
    | null
  if (ai?.incomeRange && INCOME_LABEL[ai.incomeRange]) {
    lines.push(`- Ingreso declarado: ${INCOME_LABEL[ai.incomeRange]} (${ctx.baseCurrency}).`)
  }
  if (ai?.mainGoal && ai.mainGoal.trim()) {
    lines.push(`- Meta financiera principal: ${ai.mainGoal.trim()}.`)
  }
  if (ai?.riskTolerance) {
    lines.push(`- Tolerancia al riesgo: ${ai.riskTolerance}.`)
  }
  // Persona de personalización (literacy/commStyle/moneyStyle/horizon/focus).
  // Ausente ⇒ cero líneas extra (cero ruptura para usuarios sin persona).
  const persona = parsePersona(ai?.persona)
  if (persona) lines.push(...personaToSnapshotLines(persona))

  // Cuentas + saldo total.
  if (accountsR.status === 'fulfilled') {
    const accs = accountsR.value.filter((a) => !a.archived)
    if (accs.length > 0) {
      const byType = new Map<string, number>()
      for (const a of accs) byType.set(a.type, (byType.get(a.type) ?? 0) + 1)
      const typeStr = Array.from(byType.entries())
        .map(([t, n]) => `${t}×${n}`)
        .join(', ')
      const total = await getTotalBalanceInBase(ctx.userId, ctx.baseCurrency, accountsR.value)
      lines.push(
        `- Cuentas: ${accs.length} (${typeStr}). Saldo total ≈ ${money(total.total)}${total.partial ? ' (parcial)' : ''}.`,
      )
    } else {
      lines.push('- Cuentas: ninguna registrada aún.')
    }
  }

  // Flujo del mes.
  if (cashR.status === 'fulfilled') {
    const c = cashR.value
    const rate = c.income > 0 ? Math.round((c.net / c.income) * 100) : null
    lines.push(
      `- Este mes: ingresos ≈ ${money(c.income)}, gastos ≈ ${money(c.expense)}, neto ≈ ${money(c.net)}${rate !== null ? ` (tasa de ahorro ${rate}%)` : ''}.`,
    )
  }

  // Top categorías de gasto.
  if (topCatR.status === 'fulfilled' && topCatR.value.rows.length > 0) {
    const top = topCatR.value.rows
      .map((r) => `${r.label} ≈ ${money(r.value)}`)
      .join(', ')
    lines.push(`- Top gasto este mes: ${top}.`)
  }

  // Presupuestos.
  if (budgetsR.status === 'fulfilled') {
    const b = budgetsR.value
    if (b.length > 0) {
      const exceeded = b.filter((x) => x.status === 'exceeded').length
      lines.push(`- Presupuestos: ${b.length}${exceeded > 0 ? ` (${exceeded} excedido${exceeded > 1 ? 's' : ''})` : ''}.`)
    } else {
      lines.push('- Presupuestos: ninguno definido.')
    }
  }

  // Deudas.
  if (debtsR.status === 'fulfilled') {
    const d = debtsR.value
    if (d.activeCount > 0) {
      const next = d.nextPayment
        ? ` Próximo pago: ${d.nextPayment.debtName} el ${d.nextPayment.date}.`
        : ''
      lines.push(
        `- Deudas: ${d.activeCount} activa(s), saldo ≈ ${money(d.totalBalanceInBase)}${d.partial ? ' (parcial)' : ''}.${next}`,
      )
    }
  }

  // Metas.
  if (goalsR.status === 'fulfilled') {
    const active = goalsR.value.filter((g) => g.status === 'active')
    if (active.length > 0) {
      const nearest = [...active].sort((a, b) => b.percent - a.percent)[0]!
      lines.push(
        `- Metas: ${active.length} activa(s) — ${nearest.name} (${Math.round(nearest.percent * 100)}%).`,
      )
    }
  }

  // Plan de ahorro.
  if (planR.status === 'fulfilled' && planR.value) {
    lines.push(`- Plan de ahorro: ${savingsPlanLabel(planR.value.method, planR.value.params)}.`)
  }

  if (lines.length <= 1) {
    return 'PERFIL FINANCIERO DEL USUARIO: usuario nuevo, sin datos suficientes aún. Sé acogedor y ayúdalo a empezar (registrar cuentas/movimientos).'
  }

  return [
    'PERFIL FINANCIERO DEL USUARIO (datos reales y aproximados — úsalos para personalizar el consejo; para montos exactos consulta los tools):',
    ...lines,
  ].join('\n')
}
