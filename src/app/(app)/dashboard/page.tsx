import type { Metadata } from 'next'
import Link from 'next/link'

import { cookies } from 'next/headers'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { listTransactionsForUser } from '@/lib/db/queries/transactions'
import { listUnreadInsights } from '@/lib/db/queries/insights'
import { getDebtsSummary } from '@/lib/db/queries/debts'
import { listRecurringForUser } from '@/lib/db/queries/recurring'
import { getRatesForPairs } from '@/lib/currency/rates'
import { projectCashFlow } from '@/lib/cash-flow/project'
import { getDailyVolatility } from '@/lib/cash-flow/volatility'
import { Amount } from '@/components/app/amount'
import { PrivacyProvider, PRIVACY_COOKIE } from '@/components/app/privacy'
import { HideBalancesToggle } from '@/components/app/hide-balances-toggle'
import { CashFlowTeaser } from '@/components/app/cash-flow-teaser-lazy'
import { DebtsSummaryCard } from '@/components/app/debts-summary-card'
import { EmptyState } from '@/components/app/empty-state'
import { InsightCard } from '@/components/app/insight-card'
import { NewAccountTrigger } from '@/components/app/new-account-trigger'
import { NewTransactionTrigger } from '@/components/app/new-transaction-trigger'
import { Button } from '@/components/ui/button'
import { icons } from '@/lib/design/icons'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Hoy',
}

const kindToTone = {
  income: 'positive',
  expense: 'negative',
  transfer: 'neutral',
} as const

function relativeDateLabel(iso: string): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(`${iso}T00:00:00`)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diff < 0) return 'vencido'
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  if (diff < 7) return `en ${diff} días`
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

export default async function DashboardPage() {
  const user = await requireCurrentUser()
  // cookies() (modo privacidad, evita el flash de saldos) y el perfil son
  // independientes entre sí: se resuelven en paralelo. `getProfile` está
  // memoizado por request, así que comparte el fetch con el layout `(app)`.
  const [cookieStore, profile] = await Promise.all([cookies(), getProfile(user.id)])
  const balancesHidden = cookieStore.get(PRIVACY_COOKIE)?.value === '1'
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const [
    accountsList,
    recent,
    unreadInsights,
    debtsSummary,
    recurringRules,
    volatility,
  ] = await Promise.all([
    listAccountsWithBalance(user.id),
    listTransactionsForUser(user.id, { limit: 5 }),
    listUnreadInsights(user.id, 1),
    getDebtsSummary(user.id, baseCurrency),
    listRecurringForUser(user.id),
    getDailyVolatility(user.id),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const ratePairs = accountsList
    .filter((a) => a.currency !== baseCurrency)
    .map((a) => ({ from: a.currency, to: baseCurrency }))
  const rates =
    ratePairs.length > 0
      ? await getRatesForPairs(ratePairs, today)
      : new Map<string, string>()

  const ownedAccounts = accountsList.filter((a) => a.type !== 'credit_card')
  let totalNum = 0
  let totalPartial = false
  for (const acc of ownedAccounts) {
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

  const hasAccounts = accountsList.length > 0
  const featuredInsight = unreadInsights[0] ?? null
  const activeRules = recurringRules.filter((r) => r.active)

  // Proyección a 30 días — alimenta tanto "Lo siguiente" (primer evento)
  // como el CashFlowTeaser que muestra el saldo proyectado.
  const cashFlowPoints =
    activeRules.length > 0
      ? projectCashFlow(recurringRules, totalNum, 30, { volatility })
      : null
  const nextRecurringEvent = cashFlowPoints
    ?.slice(1)
    .flatMap((p) => p.events.map((e) => ({ ...e, date: p.date })))[0] ?? null

  type NextThing = {
    kind: 'debt' | 'recurring'
    title: string
    when: string
    amount?: string
    currency?: CurrencyCode
    href: string
  }
  const nextThing: NextThing | null = (() => {
    if (debtsSummary.nextPayment) {
      return {
        kind: 'debt',
        title: debtsSummary.nextPayment.debtName,
        when: relativeDateLabel(debtsSummary.nextPayment.date),
        amount: debtsSummary.nextPayment.amount ?? undefined,
        currency: (debtsSummary.nextPayment.currency as CurrencyCode) ?? undefined,
        href: '/mi-dinero/deudas',
      }
    }
    if (nextRecurringEvent) {
      return {
        kind: 'recurring',
        title: nextRecurringEvent.description,
        when: relativeDateLabel(nextRecurringEvent.date),
        amount: String(nextRecurringEvent.amount),
        currency: baseCurrency,
        href: '/mi-dinero/cash-flow',
      }
    }
    return null
  })()

  // Saludo contextual.
  const userTz = profile?.timezone ?? undefined
  const hourFmt = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: userTz,
  })
  const hour = Number.parseInt(hourFmt.format(new Date()), 10)
  const greeting =
    hour >= 5 && hour < 12
      ? 'Buenos días'
      : hour >= 12 && hour < 19
        ? 'Buenas tardes'
        : 'Buenas noches'

  const ArrowRight = icons['arrow-right']
  const Bell = icons.bell

  return (
    <PrivacyProvider initialHidden={balancesHidden}>
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      {/* Hero — saludo + saldo + lo siguiente, todo junto en un bloque
          editorial corto */}
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-tertiary text-[11px] uppercase tracking-[0.12em]">
          {greeting}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-text-secondary text-sm">Saldo en cuentas</p>
          <HideBalancesToggle />
        </div>
        <Amount
          value={totalBase}
          currency={baseCurrency}
          display
          kind={parseFloat(totalBase) < 0 ? 'negative' : 'neutral'}
          className="block truncate text-[28px] sm:text-4xl md:text-5xl lg:text-6xl"
        />
        <p className="text-text-tertiary text-xs">
          {ownedAccounts.length}{' '}
          {ownedAccounts.length === 1 ? 'cuenta' : 'cuentas'} · {baseCurrency}
          {totalPartial && ' · conversión parcial'}
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
          {/* Insight destacado primero — si Finanzia notó algo, es lo
              primero que ves. */}
          {featuredInsight && (
            <section className="flex flex-col gap-3">
              <header className="flex items-baseline justify-between">
                <h2 className="text-text text-sm font-semibold">
                  Lo que Finanzia notó
                </h2>
                <Link
                  href="/mi-historia/insights"
                  className="text-text-secondary hover:text-text text-[13px] transition-colors"
                >
                  Ver todas
                </Link>
              </header>
              <InsightCard insight={featuredInsight} />
            </section>
          )}

          {/* Lo siguiente — un solo widget con el próximo pago o recurrente */}
          {nextThing && (
            <section className="flex flex-col gap-3">
              <h2 className="text-text text-sm font-semibold">Lo siguiente</h2>
              <Link
                href={nextThing.href}
                className="border-border-default bg-surface hover:bg-surface-hover/60 group flex items-center justify-between gap-4 rounded-[12px] border p-4 transition-colors"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="border-border-default flex h-9 w-9 shrink-0 items-center justify-center rounded-md border">
                    <Bell strokeWidth={1.5} className="text-text-tertiary size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-text truncate text-sm font-medium">
                      {nextThing.title}
                    </span>
                    <span className="text-text-tertiary text-[12px]">
                      {nextThing.kind === 'debt' ? 'Próximo pago' : 'Próximo movimiento'}{' '}
                      · {nextThing.when}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {nextThing.amount && nextThing.currency && (
                    <span className="text-text amount tabular text-sm">
                      {formatMoney(nextThing.amount, {
                        currency: nextThing.currency,
                        compact: true,
                      })}
                    </span>
                  )}
                  <ArrowRight
                    strokeWidth={1.5}
                    className="text-text-tertiary group-hover:text-text size-4 transition-colors"
                  />
                </div>
              </Link>
            </section>
          )}

          {/* Cash flow teaser solo si hay reglas activas */}
          {activeRules.length > 0 && cashFlowPoints && (
            <CashFlowTeaser
              points={cashFlowPoints}
              currency={baseCurrency}
              startingBalance={totalNum}
            />
          )}

          {/* Últimos movimientos */}
          <section className="flex flex-col gap-4">
            <header className="flex items-center justify-between">
              <h2 className="text-text text-sm font-semibold">
                Últimos movimientos
              </h2>
              <Link
                href="/mi-dinero/movimientos"
                className="text-text-secondary hover:text-text text-[13px] transition-colors"
              >
                Ver todos
              </Link>
            </header>

            {recent.length === 0 ? (
              <EmptyState
                headline="Aún no hay movimientos."
                body="Registra el primero a mano, o importa un extracto y Finanzia construye tu bitácora de una."
                action={
                  <div className="flex flex-wrap items-center gap-2">
                    <NewTransactionTrigger label="Registrar movimiento" />
                    <Button variant="outline" size="sm" asChild>
                      <Link href="/mi-dinero/movimientos?import=open">Importar CSV</Link>
                    </Button>
                  </div>
                }
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
                    <div className="flex min-w-0 flex-col">
                      <span className="text-text truncate text-sm">
                        {tx.description}
                      </span>
                      <span className="text-text-tertiary text-[11px]">
                        {tx.account.name}
                        {tx.category && ` · ${tx.category.name}`}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-col items-end">
                      <Amount
                        value={tx.amountOriginal}
                        currency={tx.currency}
                        kind={kindToTone[tx.kind]}
                        showPositiveSign={tx.kind === 'income'}
                        className="text-sm"
                      />
                      {tx.currency !== baseCurrency && (
                        <span className="text-text-tertiary tabular text-[11px]">
                          ≈ {formatMoney(tx.amountBase, { currency: baseCurrency, compact: true })}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Deuda — solo si hay algo que reportar */}
          <DebtsSummaryCard
            summary={debtsSummary}
            creditCardDebtInBase={creditCardDebtInBase}
            currency={baseCurrency}
          />
        </>
      )}
    </div>
    </PrivacyProvider>
  )
}
