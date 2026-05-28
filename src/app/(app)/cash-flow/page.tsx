import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { eq } from 'drizzle-orm'
import { profiles } from '@/lib/db/schema'
import { listRecurringForUser } from '@/lib/db/queries/recurring'
import { listAccountsWithBalance, getTotalBalanceInBase } from '@/lib/db/queries/accounts'
import { projectCashFlow } from '@/lib/cash-flow/project'
import { CashFlowChart } from '@/components/app/cash-flow-chart'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Cash Flow',
}

export default async function CashFlowPage() {
  const user = await requireCurrentUser()

  const [rules, accountsList, profile] = await Promise.all([
    listRecurringForUser(user.id),
    listAccountsWithBalance(user.id),
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
  ])

  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const { total: totalBalanceStr } = await getTotalBalanceInBase(
    user.id,
    baseCurrency,
    accountsList,
  )
  const startingBalance = Number.parseFloat(totalBalanceStr)

  const points = projectCashFlow(rules, startingBalance, 90)

  const balance30 = points[30]?.balance ?? startingBalance
  const balance60 = points[60]?.balance ?? startingBalance
  const balance90 = points[90]?.balance ?? startingBalance

  const delta30 = balance30 - startingBalance
  const delta60 = balance60 - startingBalance
  const delta90 = balance90 - startingBalance

  const upcoming = points
    .slice(1, 14)
    .flatMap((p) => p.events.map((e) => ({ ...e, date: p.date })))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="text-text-secondary text-sm">Cash Flow</p>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Flujo de caja proyectado
        </h1>
        <p className="text-text-tertiary text-[13px]">
          Basado en tus reglas recurrentes activas — ingresos y gastos programados.
        </p>
      </header>

      {/* Hero saldo actual */}
      <div className="border-border-default bg-surface flex flex-col gap-1 rounded-[12px] border p-5">
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Saldo actual
        </span>
        <span className="text-text font-mono text-3xl font-semibold tabular">
          {formatMoney(startingBalance, { currency: baseCurrency })}
        </span>
      </div>

      {/* Proyecciones 30/60/90 */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '30 días', balance: balance30, delta: delta30 },
          { label: '60 días', balance: balance60, delta: delta60 },
          { label: '90 días', balance: balance90, delta: delta90 },
        ].map((p) => (
          <div
            key={p.label}
            className="border-border-default bg-surface flex flex-col gap-1 rounded-[12px] border p-4"
          >
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              {p.label}
            </span>
            <span className="text-text font-mono text-lg font-semibold tabular sm:text-xl">
              {formatMoney(p.balance, { currency: baseCurrency, compact: true })}
            </span>
            <span
              className={`font-mono text-[11px] tabular ${
                p.delta >= 0 ? 'text-positive' : 'text-negative'
              }`}
            >
              {p.delta >= 0 ? '+' : ''}
              {formatMoney(p.delta, { currency: baseCurrency, compact: true })}
            </span>
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div className="border-border-default bg-surface rounded-[12px] border p-5">
        <CashFlowChart points={points} currency={baseCurrency} />
      </div>

      {/* Próximos 14 días — eventos */}
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-text text-sm font-semibold">Próximos 14 días</h2>
          <ul className="border-border-default bg-surface flex flex-col divide-y divide-[color:var(--border-default)] rounded-[12px] border">
            {upcoming.map((e, i) => (
              <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-text text-[13px] truncate">{e.description}</span>
                  <span className="text-text-tertiary text-[11px]">
                    {new Date(e.date + 'T12:00:00Z').toLocaleDateString('es-CO', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      timeZone: 'UTC',
                    })}
                  </span>
                </div>
                <span
                  className={`font-mono text-[13px] tabular shrink-0 ${
                    e.kind === 'income' ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {e.kind === 'income' ? '+' : '-'}
                  {formatMoney(e.amount, { currency: baseCurrency, compact: true })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {rules.filter((r) => r.active).length === 0 && (
        <div className="border-border-default bg-surface rounded-[12px] border p-6 text-center">
          <p className="editorial text-text-secondary text-base italic">
            Sin reglas recurrentes activas.
          </p>
          <p className="text-text-tertiary mt-1 text-[13px]">
            Configura ingresos y gastos programados en Ajustes → Reglas recurrentes para ver la proyección.
          </p>
        </div>
      )}
    </div>
  )
}
