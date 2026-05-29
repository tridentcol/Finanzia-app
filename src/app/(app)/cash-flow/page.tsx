import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { eq } from 'drizzle-orm'
import { profiles } from '@/lib/db/schema'
import { listRecurringForUser } from '@/lib/db/queries/recurring'
import { listAccountsWithBalance, getTotalBalanceInBase } from '@/lib/db/queries/accounts'
import { projectCashFlow } from '@/lib/cash-flow/project'
import { getDailyVolatility } from '@/lib/cash-flow/volatility'
import { CashFlowChart } from '@/components/app/cash-flow-chart'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Cash Flow',
}

export default async function CashFlowPage() {
  const user = await requireCurrentUser()

  const [rules, accountsList, profile, volatility] = await Promise.all([
    listRecurringForUser(user.id),
    listAccountsWithBalance(user.id),
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
    getDailyVolatility(user.id),
  ])

  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const { total: totalBalanceStr } = await getTotalBalanceInBase(
    user.id,
    baseCurrency,
    accountsList,
  )
  const startingBalance = Number.parseFloat(totalBalanceStr)

  const activeRules = rules.filter((r) => r.active)
  const points = projectCashFlow(rules, startingBalance, 90, { volatility })

  const balance30 = points[30]?.balance ?? startingBalance
  const balance60 = points[60]?.balance ?? startingBalance
  const balance90 = points[90]?.balance ?? startingBalance
  const delta90 = balance90 - startingBalance

  const upcoming = points
    .slice(1, 15)
    .flatMap((p) => p.events.map((e) => ({ ...e, date: p.date })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12)

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary text-sm">Cash flow</p>
        <Amount
          value={String(balance90.toFixed(2))}
          currency={baseCurrency}
          display
          kind={balance90 < 0 ? 'negative' : 'neutral'}
          className="block truncate text-[28px] sm:text-4xl md:text-5xl lg:text-6xl"
        />
        <p className="text-text-tertiary text-xs">
          Saldo proyectado a 90 días ·{' '}
          <span className={delta90 >= 0 ? 'text-positive' : 'text-negative'}>
            {delta90 >= 0 ? '+' : ''}
            {Math.round(delta90).toLocaleString('es-CO')} {baseCurrency}
          </span>{' '}
          desde hoy
        </p>
      </header>

      {activeRules.length === 0 ? (
        <EmptyState
          headline="Aún no hay reglas recurrentes activas."
          body="Configura ingresos y gastos programados desde Ajustes → Reglas recurrentes y Finanzia proyectará el flujo de los próximos 90 días."
        />
      ) : (
        <>
          {/* Mini-stats secundarias por horizonte */}
          <section className="border-border-default bg-surface grid grid-cols-3 divide-x divide-[color:var(--border-default)] overflow-hidden rounded-[12px] border">
            <HorizonStat
              label="Hoy"
              value={startingBalance}
              currency={baseCurrency}
            />
            <HorizonStat
              label="En 30 días"
              value={balance30}
              currency={baseCurrency}
              delta={balance30 - startingBalance}
            />
            <HorizonStat
              label="En 60 días"
              value={balance60}
              currency={baseCurrency}
              delta={balance60 - startingBalance}
            />
          </section>

          {/* Chart */}
          <section className="flex flex-col gap-4">
            <header className="flex items-baseline justify-between">
              <h2 className="text-text text-sm font-semibold">Proyección</h2>
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                {activeRules.length} {activeRules.length === 1 ? 'regla activa' : 'reglas activas'}
                {volatility > 0 ? ' · banda ±1σ' : ''}
              </span>
            </header>
            <div className="border-border-default bg-surface rounded-[12px] border px-5 py-6">
              <CashFlowChart points={points} currency={baseCurrency} />
            </div>
            {volatility > 0 && (
              <p className="text-text-tertiary text-[11px] max-w-prose">
                La banda sombreada refleja la variabilidad histórica de tu gasto
                discrecional (lo no recurrente). Crece con la raíz cuadrada de
                los días — más lejos = más incertidumbre.
              </p>
            )}
          </section>

          {/* Próximos eventos */}
          {upcoming.length > 0 && (
            <section className="flex flex-col gap-4">
              <header className="flex items-baseline justify-between">
                <h2 className="text-text text-sm font-semibold">Próximos eventos</h2>
                <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                  Siguientes 14 días
                </span>
              </header>
              <ul className="border-border-default bg-surface flex flex-col rounded-[12px] border">
                {upcoming.map((e, i) => (
                  <li
                    key={`${e.date}-${i}`}
                    className={`flex items-center justify-between gap-4 px-5 py-3 ${
                      i !== upcoming.length - 1 ? 'border-border-default/60 border-b' : ''
                    }`}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-text truncate text-sm">{e.description}</span>
                      <span className="text-text-tertiary text-[11px]">
                        {new Date(e.date + 'T12:00:00Z').toLocaleDateString('es-CO', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'UTC',
                        })}
                      </span>
                    </div>
                    <Amount
                      value={String(e.amount)}
                      currency={baseCurrency}
                      kind={e.kind === 'income' ? 'positive' : 'negative'}
                      showPositiveSign={e.kind === 'income'}
                      className="shrink-0 text-sm"
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

function HorizonStat({
  label,
  value,
  currency,
  delta,
}: {
  label: string
  value: number
  currency: CurrencyCode
  delta?: number
}) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
        {label}
      </span>
      <Amount
        value={String(value.toFixed(2))}
        currency={currency}
        kind={value < 0 ? 'negative' : 'neutral'}
        className="text-base sm:text-lg"
      />
      {delta !== undefined && (
        <span
          className={`font-mono text-[11px] tabular-nums ${
            delta >= 0 ? 'text-positive' : 'text-negative'
          }`}
        >
          {delta >= 0 ? '+' : ''}
          {Math.round(delta).toLocaleString('es-CO')}
        </span>
      )}
    </div>
  )
}
