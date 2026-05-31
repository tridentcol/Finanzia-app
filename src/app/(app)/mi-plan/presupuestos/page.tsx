import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import { listBudgetsWithProgress } from '@/lib/db/queries/budgets'
import { EmptyState } from '@/components/app/empty-state'
import { BudgetProgressCard } from '@/components/app/budget-progress'
import { NewBudgetTrigger } from '@/components/app/new-budget-trigger'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Presupuestos',
}

/**
 * Devuelve el ritmo del mes actual: % de días transcurridos vs % del gasto
 * presupuestado consumido. Compara dos números entre 0..1+; si gastas más
 * rápido de lo que avanza el mes, vas adelantado.
 */
function computeMonthRhythm(
  budgets: ReturnType<typeof normalizeBudgetTotals>,
): {
  daysElapsedPct: number
  spendPct: number
  totalBudgeted: number
  totalSpent: number
} {
  const today = new Date()
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const daysInMonth = Math.round(
    (nextMonthStart.getTime() - monthStart.getTime()) / (1000 * 60 * 60 * 24),
  )
  const daysElapsed = Math.min(daysInMonth, today.getDate())

  return {
    daysElapsedPct: daysElapsed / daysInMonth,
    spendPct: budgets.totalBudgeted > 0 ? budgets.totalSpent / budgets.totalBudgeted : 0,
    totalBudgeted: budgets.totalBudgeted,
    totalSpent: budgets.totalSpent,
  }
}

function normalizeBudgetTotals(
  budgets: Awaited<ReturnType<typeof listBudgetsWithProgress>>,
) {
  // Para el ritmo del mes, solo cuentan presupuestos monthly. Weekly/yearly
  // tienen otra cadencia y no son comparables al ritmo del día del mes.
  const monthly = budgets.filter((b) => b.period === 'monthly')
  const totalBudgeted = monthly.reduce((acc, b) => acc + Number.parseFloat(b.amount), 0)
  const totalSpent = monthly.reduce((acc, b) => acc + Number.parseFloat(b.spent), 0)
  return { monthly, totalBudgeted, totalSpent }
}

export default async function PresupuestosPage() {
  const user = await requireCurrentUser()
  const [profile, budgets] = await Promise.all([
    getProfile(user.id),
    listBudgetsWithProgress(user.id),
  ])
  const currency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const totals = normalizeBudgetTotals(budgets)
  const rhythm = computeMonthRhythm(totals)
  const showRhythm = totals.monthly.length > 0 && totals.totalBudgeted > 0

  // Diferencia spend% vs days% — positivo significa que vas adelantado en
  // gasto vs el mes (mal); negativo significa que vas debajo del ritmo (bien).
  const delta = rhythm.spendPct - rhythm.daysElapsedPct
  const status: 'safe' | 'warning' | 'over' =
    delta > 0.1 ? 'over' : delta > 0 ? 'warning' : 'safe'
  const statusCopy: Record<typeof status, string> = {
    safe: 'Vas por debajo del ritmo del mes',
    warning: 'Vas levemente adelantado',
    over: 'Vas por encima del ritmo del mes',
  }
  const statusTone: Record<typeof status, string> = {
    safe: 'text-positive',
    warning: 'text-warning',
    over: 'text-negative',
  }

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-text-secondary text-sm">Presupuestos</p>
          {showRhythm ? (
            <>
              <p className="amount text-text block truncate text-[28px] sm:text-4xl md:text-5xl">
                {Math.round(rhythm.spendPct * 100)}%
              </p>
              <p className={`text-xs ${statusTone[status]}`}>
                {statusCopy[status]} ·{' '}
                <span className="text-text-tertiary">
                  {Math.round(rhythm.daysElapsedPct * 100)}% de los días
                </span>
              </p>
            </>
          ) : (
            <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
              Topes por categoría
            </h1>
          )}
        </div>
        <NewBudgetTrigger />
      </header>

      {budgets.length === 0 ? (
        <EmptyState
          headline="Un presupuesto es la pista que le pones a una categoría."
          body="Sin pistas, el dinero se va por donde quiera. Asigna un tope mensual y Finanzia avisa cuando te acerques al límite — sin sermones."
          action={<NewBudgetTrigger />}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {budgets.map((b) => (
            <li key={b.id}>
              <BudgetProgressCard budget={b} currency={currency} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
