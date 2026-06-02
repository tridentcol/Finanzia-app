import 'server-only'
import { sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { userDataTag } from '@/lib/cache/data'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { listBudgetsWithProgress } from '@/lib/db/queries/budgets'
import { getDebtsSummary } from '@/lib/db/queries/debts'
import { getDailyVolatility } from '@/lib/cash-flow/volatility'
import { getRatesForPairs } from '@/lib/currency/rates'
import { computeHealthScore } from '@/lib/health/score'
import type { HealthScore } from '@/lib/health/types'
import type { CurrencyCode } from '@/lib/currency/currencies'

type MonthRow = { month_start: string; income: string; expense: string }

const dayMs = 86_400_000

/** Días (inclusive) entre dos fechas ISO 'YYYY-MM-DD'. */
function daysInclusive(startIso: string, endIso: string): number {
  const a = new Date(`${startIso}T00:00:00Z`).getTime()
  const b = new Date(`${endIso}T00:00:00Z`).getTime()
  return Math.round((b - a) / dayMs) + 1
}

/**
 * Arma los insumos AGREGADOS del score de salud (nunca transacciones sueltas)
 * reusando las queries existentes y los compone con `computeHealthScore`.
 *
 * - Ahorro: ingresos/gastos del último mes calendario completo.
 * - Colchón / estabilidad: gasto mensual promedio de los 3 meses previos.
 * - Saldo líquido: cuentas propias (no tarjetas) convertidas a base.
 * - Deuda: deuda formal + saldo adeudado de tarjetas, en base.
 * - Presupuestos: solo mensuales, proyectados a fin de mes (pacing).
 */
async function loadHealthScore(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
): Promise<HealthScore> {
  const [accountsList, budgets, debtsSummary, volatility, monthRows] =
    await Promise.all([
      listAccountsWithBalance(userId),
      listBudgetsWithProgress(userId),
      getDebtsSummary(userId, baseCurrency),
      getDailyVolatility(userId),
      db.execute<MonthRow>(sql`
        SELECT
          date_trunc('month', date::date)::date AS month_start,
          COALESCE(SUM(CASE WHEN kind='income'  THEN amount_base ELSE 0 END), 0)::text AS income,
          COALESCE(SUM(CASE WHEN kind='expense' THEN amount_base ELSE 0 END), 0)::text AS expense
        FROM transactions
        WHERE user_id = ${userId}
          AND deleted_at IS NULL
          AND date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '3 months')::date
          AND date <  date_trunc('month', CURRENT_DATE)::date
        GROUP BY month_start
        ORDER BY month_start
      `),
    ])

  // Tasas para convertir cuentas en moneda no-base a la base del usuario.
  const ratePairs = accountsList
    .filter((a) => a.currency !== baseCurrency)
    .map((a) => ({ from: a.currency, to: baseCurrency }))
  const rates =
    ratePairs.length > 0
      ? await getRatesForPairs(ratePairs, today)
      : new Map<string, string>()
  const toBase = (amount: number, currency: CurrencyCode): number => {
    if (currency === baseCurrency) return amount
    const rate = rates.get(`${currency}->${baseCurrency}`)
    return rate ? amount * Number.parseFloat(rate) : amount
  }

  // Saldo líquido: cuentas propias (no tarjetas), saldo positivo neto en base.
  let liquidAssets = 0
  let creditCardOwed = 0
  for (const a of accountsList) {
    const bal = Number.parseFloat(a.currentBalance)
    if (a.type === 'credit_card') {
      if (bal < 0) creditCardOwed += toBase(-bal, a.currency)
      continue
    }
    liquidAssets += toBase(bal, a.currency)
  }

  // Ahorro (último mes completo) y gasto mensual promedio (meses devueltos).
  const lastMonth = monthRows[monthRows.length - 1]
  const savings = {
    income: Number.parseFloat(lastMonth?.income ?? '0'),
    expense: Number.parseFloat(lastMonth?.expense ?? '0'),
  }
  const avgMonthlyExpense =
    monthRows.length > 0
      ? monthRows.reduce((sum, r) => sum + Number.parseFloat(r.expense), 0) /
        monthRows.length
      : 0

  // Deuda total en base: formal + tarjetas.
  const totalDebt =
    Number.parseFloat(debtsSummary.totalBalanceInBase) + creditCardOwed

  // Presupuestos mensuales proyectados a fin de mes (mismo pacing que el
  // detector de forecast: gasto_hoy / días_transcurridos × días_totales).
  const projectedBudgets = budgets
    .filter((b) => b.period === 'monthly')
    .map((b) => {
      const total = daysInclusive(b.periodStart, b.periodEnd)
      const elapsed = Math.max(
        1,
        Math.min(total, daysInclusive(b.periodStart, today)),
      )
      const spent = Number.parseFloat(b.spent)
      return { amount: Number.parseFloat(b.amount), projected: (spent / elapsed) * total }
    })

  return computeHealthScore({
    savings,
    runway: { liquidAssets, avgMonthlyExpense },
    debt: { totalDebt, liquidAssets },
    budgets: projectedBudgets,
    stability: { dailyVolatility: volatility, avgMonthlyExpense },
  })
}

/**
 * Score de salud financiera cacheado cross-request (unstable_cache). La key
 * incluye userId/baseCurrency/today (today porque ahorro/colchón/pacing
 * dependen del calendario); el tag coarse `data:${userId}` lo bustea cualquier
 * Server Action que muta. `revalidate: 30` es un backstop.
 */
export function getHealthScore(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
): Promise<HealthScore> {
  return unstable_cache(
    () => loadHealthScore(userId, baseCurrency, today),
    ['health-score', userId, baseCurrency, today],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
