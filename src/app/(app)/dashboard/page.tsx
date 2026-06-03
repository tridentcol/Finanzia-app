import type { Metadata } from 'next'
import Link from 'next/link'

import { cookies } from 'next/headers'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import { getDashboardData } from '@/lib/db/queries/dashboard'
import { getLatestCheckin } from '@/lib/db/queries/checkin'
import { getHealthScore } from '@/lib/db/queries/health'
import { getNetWorthSeries } from '@/lib/db/queries/net-worth'
import { projectCashFlow } from '@/lib/cash-flow/project'
import { CheckinCard } from '@/components/app/checkin-card'
import { DashboardTiles, type DashboardNextThing } from '@/components/app/dashboard-tiles'
import { NetWorthSparkline } from '@/components/app/net-worth-sparkline'
import { Amount } from '@/components/app/amount'
import { PrivacyProvider, PRIVACY_COOKIE } from '@/components/app/privacy'
import { HideBalancesToggle } from '@/components/app/hide-balances-toggle'
import { EmptyState } from '@/components/app/empty-state'
import { NewAccountTrigger } from '@/components/app/new-account-trigger'
import { NewTransactionTrigger } from '@/components/app/new-transaction-trigger'
import { Button } from '@/components/ui/button'
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
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
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
  const [cookieStore, profile, checkin] = await Promise.all([
    cookies(),
    getProfile(user.id),
    getLatestCheckin(user.id),
  ])
  const balancesHidden = cookieStore.get(PRIVACY_COOKIE)?.value === '1'
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  // Datos cacheados cross-request (tag dashboard:${userId}, backstop 30s). Las
  // mutaciones de saldo bustean el tag → tras una acción tuya ves fresco. La
  // lógica derivada de fecha/hora (saludo, proyección) se computa abajo, fuera
  // del cache.
  const today = new Date().toISOString().slice(0, 10)
  const [
    { accountsList, recent, debtsSummary, recurringRules, volatility, ratesObj },
    health,
    netWorth,
  ] = await Promise.all([
    getDashboardData(user.id, baseCurrency, today),
    getHealthScore(user.id, baseCurrency, today),
    getNetWorthSeries(user.id, baseCurrency, today),
  ])
  const rates = new Map<string, string>(Object.entries(ratesObj))

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
  const activeRules = recurringRules.filter((r) => r.active)

  // Proyección a 30 días — alimenta tanto "Lo siguiente" (primer evento)
  // como el CashFlowTeaser que muestra el saldo proyectado.
  const cashFlowPoints =
    activeRules.length > 0 ? projectCashFlow(recurringRules, totalNum, 30, { volatility }) : null
  const nextRecurringEvent =
    cashFlowPoints?.slice(1).flatMap((p) => p.events.map((e) => ({ ...e, date: p.date })))[0] ??
    null

  const nextThing: DashboardNextThing | null = (() => {
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

  // Cifras para los tiles compactos.
  const projectedBalance =
    cashFlowPoints && cashFlowPoints.length > 0
      ? cashFlowPoints[cashFlowPoints.length - 1]!.balance
      : null
  // Saldo proyectado día a día → micro-sparkline del tile de flujo.
  const flowSeries = cashFlowPoints ? cashFlowPoints.map((p) => p.balance) : null
  const debtTotal = Number.parseFloat(debtsSummary.totalBalanceInBase) + creditCardDebtInBase

  // Patrimonio neto (héroe) + su trayectoria para el sparkline.
  const netNow = netWorth.now.net
  const netPoints = netWorth.points.map((p) => ({ date: p.date, net: p.net }))

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

  return (
    <PrivacyProvider initialHidden={balancesHidden}>
      <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
        {/* Hero — saludo + patrimonio neto con su trayectoria; el saldo en
          cuentas baja a la línea de contexto. Bloque editorial corto. */}
        <header className="flex min-w-0 flex-col gap-1.5">
          <p className="text-text-tertiary text-[11px] tracking-[0.12em] uppercase">{greeting}</p>
          <div className="flex items-center gap-2">
            <p className="text-text-secondary text-sm">Patrimonio neto</p>
            <HideBalancesToggle />
          </div>
          <Amount
            value={netNow.toFixed(2)}
            currency={baseCurrency}
            display
            kind={netNow < 0 ? 'negative' : 'neutral'}
            className="block truncate text-[28px] sm:text-4xl md:text-5xl lg:text-6xl"
          />
          {netPoints.length >= 2 && (
            <NetWorthSparkline points={netPoints} baseCurrency={baseCurrency} />
          )}
          <p className="text-text-tertiary text-xs">
            Saldo en cuentas{' '}
            <span className="tabular">
              {formatMoney(totalBase, { currency: baseCurrency, compact: true })}
            </span>{' '}
            · {ownedAccounts.length} {ownedAccounts.length === 1 ? 'cuenta' : 'cuentas'}
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
            {/* Tiles compactos: salud, lo siguiente, flujo, deuda. Cada uno
              enlaza a su sección dedicada (ahí vive el detalle). */}
            <DashboardTiles
              health={health}
              nextThing={nextThing}
              projectedBalance={projectedBalance}
              flowSeries={flowSeries}
              debtTotal={debtTotal}
              baseCurrency={baseCurrency}
            />

            {/* Check-in semanal proactivo — el copiloto te busca con la foto de
              tu semana (presencia de IA). */}
            <CheckinCard checkin={checkin} baseCurrency={baseCurrency} />

            {/* Últimos movimientos — lista corta; el detalle vive en /movimientos */}
            <section className="flex flex-col gap-4">
              <header className="flex items-center justify-between">
                <h2 className="text-text text-sm font-semibold">Últimos movimientos</h2>
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
                  {recent.slice(0, 3).map((tx, idx, arr) => (
                    <li
                      key={tx.id}
                      className={`flex items-center justify-between gap-4 px-5 py-3 ${
                        idx !== arr.length - 1 ? 'border-border-default/60 border-b' : ''
                      }`}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="text-text truncate text-sm">{tx.description}</span>
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
                            ≈{' '}
                            {formatMoney(tx.amountBase, { currency: baseCurrency, compact: true })}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </PrivacyProvider>
  )
}
