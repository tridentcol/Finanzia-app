import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { listTransactionsForUser } from '@/lib/db/queries/transactions'
import { listBudgetsWithProgress } from '@/lib/db/queries/budgets'
import { listUnreadInsights } from '@/lib/db/queries/insights'
import { getDebtsSummary } from '@/lib/db/queries/debts'
import { listRecurringForUser } from '@/lib/db/queries/recurring'
import { getRatesForPairs } from '@/lib/currency/rates'
import { projectCashFlow } from '@/lib/cash-flow/project'
import { getDailyVolatility } from '@/lib/cash-flow/volatility'
import { Amount } from '@/components/app/amount'
import { BudgetProgressCard } from '@/components/app/budget-progress'
import { CashFlowTeaser } from '@/components/app/cash-flow-teaser'
import { DebtsSummaryCard } from '@/components/app/debts-summary-card'
import { EmptyState } from '@/components/app/empty-state'
import { InsightCard } from '@/components/app/insight-card'
import { NewAccountTrigger } from '@/components/app/new-account-trigger'
import { NewTransactionTrigger } from '@/components/app/new-transaction-trigger'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Resumen',
}

const kindToTone = {
  income: 'positive',
  expense: 'negative',
  transfer: 'neutral',
} as const

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode
  const [
    accountsList,
    recent,
    budgets,
    unreadInsights,
    debtsSummary,
    recurringRules,
    volatility,
  ] = await Promise.all([
    listAccountsWithBalance(user.id),
    listTransactionsForUser(user.id, { limit: 5 }),
    listBudgetsWithProgress(user.id),
    listUnreadInsights(user.id, 3),
    getDebtsSummary(user.id, baseCurrency),
    listRecurringForUser(user.id),
    getDailyVolatility(user.id),
  ])

  // Una sola query para todas las tasas que el dashboard necesita: saldo
  // total + deuda de tarjetas comparten el mismo set de pares non-base→base.
  const today = new Date().toISOString().slice(0, 10)
  const ratePairs = accountsList
    .filter((a) => a.currency !== baseCurrency)
    .map((a) => ({ from: a.currency, to: baseCurrency }))
  const rates =
    ratePairs.length > 0
      ? await getRatesForPairs(ratePairs, today)
      : new Map<string, string>()

  let totalNum = 0
  let totalPartial = false
  for (const acc of accountsList) {
    const bal = Number.parseFloat(acc.currentBalance)
    if (acc.currency === baseCurrency) {
      totalNum += bal
      continue
    }
    const rate = rates.get(`${acc.currency}->${baseCurrency}`)
    if (rate === undefined) {
      totalPartial = true
      totalNum += bal
      continue
    }
    totalNum += bal * Number.parseFloat(rate)
  }
  const totalBase = totalNum.toFixed(2)
  const totalSnapshot = { total: totalBase, partial: totalPartial }

  let creditCardDebtInBase = 0
  for (const a of accountsList) {
    if (a.type !== 'credit_card') continue
    const balance = Number.parseFloat(a.currentBalance)
    if (balance >= 0) continue
    const owed = -balance
    if (a.currency === baseCurrency) {
      creditCardDebtInBase += owed
      continue
    }
    const rate = rates.get(`${a.currency}->${baseCurrency}`)
    creditCardDebtInBase += rate ? owed * Number.parseFloat(rate) : owed
  }

  // Presupuestos a destacar: primero exceeded, luego warning, luego safe por % desc.
  const featuredBudgets = [...budgets]
    .sort((a, b) => {
      const rank = (s: typeof a.status) =>
        s === 'exceeded' ? 0 : s === 'warning' ? 1 : 2
      const rd = rank(a.status) - rank(b.status)
      if (rd !== 0) return rd
      return b.percent - a.percent
    })
    .slice(0, 4)

  const hasAccounts = accountsList.length > 0

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary text-sm">Saldo total</p>
        <Amount
          value={totalBase}
          currency={baseCurrency}
          display
          kind={parseFloat(totalBase) < 0 ? 'negative' : 'neutral'}
          className="block truncate text-[28px] sm:text-4xl md:text-5xl lg:text-6xl"
        />
        <p className="text-text-tertiary text-xs">
          Suma de {accountsList.length}{' '}
          {accountsList.length === 1 ? 'cuenta' : 'cuentas'} · expresado en{' '}
          {baseCurrency}
          {totalSnapshot.partial && ' · conversión parcial'}
        </p>
      </header>

      {!hasAccounts ? (
        <EmptyState
          headline="Empieza por registrar tu primera cuenta."
          body="Una vez creada, podrás añadir movimientos manualmente o importarlos. Finanzia se ocupa del orden."
          action={<NewAccountTrigger />}
        />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <header className="flex items-baseline justify-between">
              <h2 className="text-text text-sm font-semibold">Tus cuentas</h2>
              <Link
                href="/mi-dinero/cuentas"
                className="text-text-secondary hover:text-text text-[13px] transition-colors"
              >
                Ver todas
              </Link>
            </header>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {accountsList.slice(0, 6).map((a) => (
                <li
                  key={a.id}
                  className="border-border-default bg-surface flex flex-col gap-1 rounded-[12px] border p-4"
                >
                  <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                    {a.name}
                  </span>
                  <Amount
                    value={a.currentBalance}
                    currency={a.currency}
                    kind={parseFloat(a.currentBalance) < 0 ? 'negative' : 'neutral'}
                    className="text-lg"
                  />
                </li>
              ))}
            </ul>
          </section>

          <DebtsSummaryCard
            summary={debtsSummary}
            creditCardDebtInBase={creditCardDebtInBase}
            currency={baseCurrency}
          />

          {recurringRules.filter((r) => r.active).length > 0 && (() => {
            const points = projectCashFlow(recurringRules, totalNum, 30, {
              volatility,
            })
            return (
              <CashFlowTeaser
                points={points}
                currency={baseCurrency}
                startingBalance={totalNum}
              />
            )
          })()}

          <section className="flex flex-col gap-4">
            <header className="flex items-center justify-between">
              <h2 className="text-text text-sm font-semibold">
                Últimos movimientos
              </h2>
              <div className="flex items-center gap-3">
                <Link
                  href="/mi-dinero/movimientos"
                  className="text-text-secondary hover:text-text text-[13px] transition-colors"
                >
                  Ver todos
                </Link>
                <NewTransactionTrigger variant="outline" label="Registrar" />
              </div>
            </header>

            {recent.length === 0 ? (
              <EmptyState
                headline="Aún no hay movimientos."
                body="Registra el primero — Finanzia comienza a construir tu bitácora desde el primer asiento."
                action={<NewTransactionTrigger label="Registrar transacción" />}
              />
            ) : (
              <ul className="border-border-default bg-surface flex flex-col rounded-[12px] border">
                {recent.map((tx, idx) => (
                  <li
                    key={tx.id}
                    className={`flex items-center justify-between gap-4 px-5 py-3 ${
                      idx !== recent.length - 1
                        ? 'border-border-default/60 border-b'
                        : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-text text-sm">{tx.description}</span>
                      <span className="text-text-tertiary text-[11px]">
                        {tx.account.name}
                        {tx.category && ` · ${tx.category.name}`}
                      </span>
                    </div>
                    <Amount
                      value={tx.amountOriginal}
                      currency={tx.currency}
                      kind={kindToTone[tx.kind]}
                      showPositiveSign={tx.kind === 'income'}
                      className="text-sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          {unreadInsights.length > 0 && (
            <section className="flex flex-col gap-4">
              <header className="flex items-baseline justify-between">
                <h2 className="text-text text-sm font-semibold">
                  Lecturas recientes
                </h2>
                <Link
                  href="/mi-historia/insights"
                  className="text-text-secondary hover:text-text text-[13px] transition-colors"
                >
                  Ver todas
                </Link>
              </header>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {unreadInsights.map((insight) => (
                  <li key={insight.id}>
                    <InsightCard insight={insight} compact />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {featuredBudgets.length > 0 && (
            <section className="flex flex-col gap-4">
              <header className="flex items-baseline justify-between">
                <h2 className="text-text text-sm font-semibold">
                  Presupuestos del período
                </h2>
                <Link
                  href="/mi-plan/presupuestos"
                  className="text-text-secondary hover:text-text text-[13px] transition-colors"
                >
                  Ver todos
                </Link>
              </header>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {featuredBudgets.map((b) => (
                  <li key={b.id}>
                    <BudgetProgressCard
                      budget={b}
                      currency={baseCurrency}
                      compact
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
