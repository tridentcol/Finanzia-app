import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { listRecurringForUser } from '@/lib/db/queries/recurring'
import {
  getTotalBalanceInBase,
  listAccountsWithBalance,
} from '@/lib/db/queries/accounts'
import { getDebtsSummary } from '@/lib/db/queries/debts'
import { getRatesForPairs } from '@/lib/currency/rates'
import { projectCashFlow } from '@/lib/cash-flow/project'
import { getDailyVolatility } from '@/lib/cash-flow/volatility'
import { CashFlowChart } from '@/components/app/cash-flow-chart'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import { InfoHint } from '@/components/app/info-hint'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Cash flow',
}

type RuleListItem = Awaited<ReturnType<typeof listRecurringForUser>>[number]

export default async function CashFlowPage() {
  const user = await requireCurrentUser()

  const [rules, accountsList, profile, volatility] = await Promise.all([
    listRecurringForUser(user.id),
    listAccountsWithBalance(user.id),
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
    getDailyVolatility(user.id),
  ])

  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  // ── Patrimonio neto ──────────────────────────────────────────────
  // Activos = cuentas no-crédito en base.
  // Pasivos = deuda en tarjetas + préstamos/hipotecas activas.
  const ownedAccounts = accountsList.filter((a) => a.type !== 'credit_card')
  const creditCards = accountsList.filter((a) => a.type === 'credit_card')

  const [{ total: assetsBase, partial: assetsPartial }, debtsSummary] =
    await Promise.all([
      getTotalBalanceInBase(user.id, baseCurrency, ownedAccounts),
      getDebtsSummary(user.id, baseCurrency),
    ])

  const today = new Date().toISOString().slice(0, 10)
  const ccNonBase = creditCards.filter((c) => c.currency !== baseCurrency)
  const ccRates =
    ccNonBase.length > 0
      ? await getRatesForPairs(
          ccNonBase.map((c) => ({ from: c.currency, to: baseCurrency })),
          today,
        )
      : new Map<string, string>()

  let ccDebtBase = 0
  let ccPartial = false
  for (const c of creditCards) {
    const balance = Number.parseFloat(c.currentBalance)
    if (balance >= 0) continue
    const used = -balance
    if (c.currency === baseCurrency) {
      ccDebtBase += used
      continue
    }
    const rate = ccRates.get(`${c.currency}->${baseCurrency}`)
    if (!rate) {
      ccPartial = true
      ccDebtBase += used
      continue
    }
    ccDebtBase += used * Number.parseFloat(rate)
  }

  const assets = Number.parseFloat(assetsBase)
  const debts = Number.parseFloat(debtsSummary.totalBalanceInBase)
  const netWorth = assets - ccDebtBase - debts
  const netWorthPartial = assetsPartial || ccPartial || debtsSummary.partial

  // ── Proyección ───────────────────────────────────────────────────
  const startingBalance = assets
  const activeRules = rules.filter((r) => r.active)
  const points = projectCashFlow(rules, startingBalance, 90, { volatility })

  const balance30 = points[30]?.balance ?? startingBalance
  const balance60 = points[60]?.balance ?? startingBalance
  const balance90 = points[90]?.balance ?? startingBalance
  const delta90 = balance90 - startingBalance

  // Eventos próximos 30 días, separados por kind.
  const next30Events = points
    .slice(1, 31)
    .flatMap((p) => p.events.map((e) => ({ ...e, date: p.date })))
  const incomeNext30 = next30Events
    .filter((e) => e.kind === 'income')
    .reduce((acc, e) => acc + e.amount, 0)
  const expenseNext30 = next30Events
    .filter((e) => e.kind === 'expense')
    .reduce((acc, e) => acc + e.amount, 0)
  const netNext30 = incomeNext30 - expenseNext30

  // Runway: cuántos días duraría el saldo actual si dejaran de entrar
  // ingresos pero los gastos recurrentes siguieran su ritmo. Si la app no
  // tiene gastos esperados, devuelve null (no aplica).
  const dailyExpense = expenseNext30 / 30
  const runwayDays =
    dailyExpense > 0 ? Math.floor(startingBalance / dailyExpense) : null

  // Breakdown de gastos e ingresos recurrentes activos por categoría.
  const expenseRules = activeRules.filter((r) => r.kind === 'expense')
  const incomeRules = activeRules.filter((r) => r.kind === 'income')

  const monthlyEquivalent = (r: RuleListItem): number => {
    const amt = Number.parseFloat(r.amount)
    switch (r.frequency) {
      case 'daily':
        return amt * 30
      case 'weekly':
        return amt * (30 / 7)
      case 'biweekly':
        return amt * 2
      case 'monthly':
        return amt
      case 'quarterly':
        return amt / 3
      case 'yearly':
        return amt / 12
    }
  }

  type Breakdown = {
    entries: Array<{ label: string; total: number; description?: string }>
    max: number
    sum: number
  }

  const breakdownByCategory = (
    rules: RuleListItem[],
    /** Si true, usa description individual cuando no hay category. Útil
     *  para income donde una sola regla suele ser "Salario" sin categoría. */
    fallbackToDescription = false,
  ): Breakdown => {
    const map = new Map<string, { label: string; total: number; description?: string }>()
    for (const r of rules) {
      const key =
        r.categoryName ??
        (fallbackToDescription ? r.description : 'Sin categoría')
      const entry = map.get(key) ?? { label: key, total: 0 }
      entry.total += monthlyEquivalent(r)
      map.set(key, entry)
    }
    const entries = Array.from(map.values()).sort((a, b) => b.total - a.total)
    return {
      entries,
      max: Math.max(1, ...entries.map((e) => e.total)),
      sum: entries.reduce((acc, e) => acc + e.total, 0),
    }
  }

  const expensesBreakdown = breakdownByCategory(expenseRules, false)
  const incomesBreakdown = breakdownByCategory(incomeRules, true)

  // Próximos eventos para la lista de detalle.
  const upcoming = points
    .slice(1, 15)
    .flatMap((p) => p.events.map((e) => ({ ...e, date: p.date })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12)

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      {/* Hero — patrimonio neto */}
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary flex items-center gap-1.5 text-sm">
          Patrimonio neto
          <InfoHint
            side="right"
            label="Suma de tus activos (cuentas + inversiones) menos las deudas que mantienes — tarjetas con saldo y préstamos. Es la foto de cuánto realmente te pertenece hoy."
          />
        </p>
        <Amount
          value={netWorth.toFixed(2)}
          currency={baseCurrency}
          display
          kind={netWorth < 0 ? 'negative' : 'neutral'}
          className="block truncate text-[28px] sm:text-4xl md:text-5xl"
        />
        <p className="text-text-tertiary text-xs">
          activos {formatMoney(assets, { currency: baseCurrency, compact: true })}{' '}
          − tarjetas {formatMoney(ccDebtBase, { currency: baseCurrency, compact: true })}{' '}
          − deudas {formatMoney(debts, { currency: baseCurrency, compact: true })}
          {netWorthPartial && ' · conversión parcial'}
        </p>
      </header>

      {activeRules.length === 0 ? (
        <EmptyState
          headline="Aún no hay reglas recurrentes activas."
          body="Configura ingresos y gastos programados desde Mi plan · Recurrentes y Finanzia proyectará el flujo de los próximos 90 días."
        />
      ) : (
        <>
          {/* Próximos 30 días — composición del flujo */}
          <section className="flex flex-col gap-3">
            <header className="flex items-baseline justify-between">
              <h2 className="text-text text-sm font-semibold">Próximos 30 días</h2>
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                Esperado del recurrente
              </span>
            </header>
            <div className="border-border-default bg-surface grid grid-cols-2 divide-x divide-[color:var(--border-default)] overflow-hidden rounded-[12px] border sm:grid-cols-4">
              <KpiCell
                label="Ingresos"
                value={incomeNext30}
                currency={baseCurrency}
                tone="positive"
              />
              <KpiCell
                label="Gastos"
                value={expenseNext30}
                currency={baseCurrency}
                tone="negative"
              />
              <KpiCell
                label="Neto"
                value={netNext30}
                currency={baseCurrency}
                tone={netNext30 >= 0 ? 'positive' : 'negative'}
                showSign
              />
              <KpiCell
                label="Runway"
                value={
                  runwayDays !== null
                    ? `${runwayDays}d`
                    : '∞'
                }
                hint={
                  runwayDays !== null
                    ? 'sin ingresos'
                    : 'sin gastos recurrentes'
                }
                info="Cuántos días aguantarían tus saldos actuales si dejaras de recibir ingresos hoy, manteniendo solo los gastos recurrentes."
              />
            </div>
          </section>

          {/* Mini-stats por horizonte */}
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
              <h2 className="text-text text-sm font-semibold">
                Proyección a 90 días
              </h2>
              <span className="text-text-tertiary flex items-center gap-1 text-[11px] uppercase tracking-[0.08em]">
                {activeRules.length}{' '}
                {activeRules.length === 1 ? 'regla activa' : 'reglas activas'}
                {volatility > 0 && (
                  <>
                    {' · banda ±1σ'}
                    <InfoHint
                      label="La banda muestra la incertidumbre del gasto no recurrente. ±1σ significa que en condiciones normales tu saldo caería dentro de esa banda 7 de cada 10 días, según tu volatilidad histórica."
                    />
                  </>
                )}
              </span>
            </header>
            <div className="border-border-default bg-surface rounded-[12px] border px-5 py-6">
              <CashFlowChart points={points} currency={baseCurrency} />
            </div>
            <p className="text-text-tertiary text-xs">
              Saldo proyectado a 90 días{' '}
              <Amount
                value={String(balance90.toFixed(2))}
                currency={baseCurrency}
                kind={balance90 < 0 ? 'negative' : 'neutral'}
                className="inline text-xs"
              />{' '}
              ·{' '}
              <span className={delta90 >= 0 ? 'text-positive' : 'text-negative'}>
                {delta90 >= 0 ? '+' : ''}
                {Math.round(delta90).toLocaleString('es-CO')} {baseCurrency}
              </span>{' '}
              vs hoy
              {volatility > 0 && (
                <>
                  {' · '}
                  banda ±1σ del gasto discrecional histórico
                </>
              )}
            </p>
          </section>

          {/* Breakdowns paralelos: ingresos y gastos recurrentes */}
          {(incomesBreakdown.entries.length > 0 ||
            expensesBreakdown.entries.length > 0) && (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {incomesBreakdown.entries.length > 0 && (
                <BreakdownCard
                  title="Ingresos recurrentes"
                  breakdown={incomesBreakdown}
                  currency={baseCurrency}
                  tone="positive"
                  emptyHint={null}
                />
              )}
              {expensesBreakdown.entries.length > 0 && (
                <BreakdownCard
                  title="Gastos recurrentes"
                  breakdown={expensesBreakdown}
                  currency={baseCurrency}
                  tone="brand"
                  emptyHint={null}
                />
              )}
            </section>
          )}

          {/* Próximos eventos */}
          {upcoming.length > 0 && (
            <UpcomingEvents events={upcoming} currency={baseCurrency} />
          )}
        </>
      )}
    </div>
  )
}

type BreakdownData = {
  entries: Array<{ label: string; total: number; description?: string }>
  max: number
  sum: number
}

function BreakdownCard({
  title,
  breakdown,
  currency,
  tone,
  emptyHint,
}: {
  title: string
  breakdown: BreakdownData
  currency: CurrencyCode
  tone: 'positive' | 'brand'
  emptyHint: string | null
}) {
  const barColor =
    tone === 'positive' ? 'var(--positive)' : 'var(--purple-base)'

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-text text-sm font-semibold">{title}</h2>
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Equiv. mensual
        </span>
      </header>
      <div className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-5">
        {breakdown.entries.length === 0 && emptyHint ? (
          <p className="text-text-tertiary text-[12px]">{emptyHint}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {breakdown.entries.map((c) => {
              const widthPct = Math.max(2, (c.total / breakdown.max) * 100)
              const sharePct =
                breakdown.sum > 0
                  ? Math.round((c.total / breakdown.sum) * 100)
                  : 0
              return (
                <li key={c.label} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-text truncate text-[13px]">
                      {c.label}
                    </span>
                    <span className="text-text-secondary tabular shrink-0 text-[12px]">
                      {formatMoney(c.total, { currency, compact: true })}
                      <span className="text-text-tertiary ml-2 text-[11px]">
                        {sharePct}%
                      </span>
                    </span>
                  </div>
                  <div className="bg-surface-hover h-1 overflow-hidden rounded-full">
                    <div
                      aria-hidden
                      className="h-full rounded-full"
                      style={{ width: `${widthPct}%`, background: barColor }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {breakdown.entries.length > 0 && (
          <p className="text-text-tertiary text-[11px]">
            Total mensual:{' '}
            <span className="text-text-secondary tabular">
              {formatMoney(breakdown.sum, { currency, compact: true })}
            </span>
          </p>
        )}
      </div>
    </section>
  )
}

function KpiCell({
  label,
  value,
  currency,
  tone,
  showSign,
  hint,
  info,
}: {
  label: string
  value: number | string
  currency?: CurrencyCode
  tone?: 'positive' | 'negative' | 'neutral'
  showSign?: boolean
  hint?: string
  info?: string
}) {
  const isNumber = typeof value === 'number'
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-text-tertiary flex items-center gap-1 text-[11px] uppercase tracking-[0.08em]">
        {label}
        {info && <InfoHint label={info} />}
      </span>
      {isNumber && currency ? (
        <Amount
          value={String(value.toFixed(2))}
          currency={currency}
          kind={tone ?? 'neutral'}
          showPositiveSign={showSign && value > 0}
          className="text-base sm:text-lg"
        />
      ) : (
        <span className="text-text amount text-base sm:text-lg">{value}</span>
      )}
      {hint && (
        <span className="text-text-tertiary text-[11px]">{hint}</span>
      )}
    </div>
  )
}

type UpcomingEvent = {
  date: string
  description: string
  amount: number
  kind: 'income' | 'expense'
}

function isoWeekStart(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00Z`)
  const day = d.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T12:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  return `${fmt(start)} – ${fmt(end)}`
}

function UpcomingEvents({
  events,
  currency,
}: {
  events: UpcomingEvent[]
  currency: CurrencyCode
}) {
  const groupByWeek = events.length > 6

  if (!groupByWeek) {
    return (
      <section className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-text text-sm font-semibold">Próximos eventos</h2>
          <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Siguientes 14 días
          </span>
        </header>
        <ul className="border-border-default bg-surface flex flex-col rounded-[12px] border">
          {events.map((e, i) => (
            <li
              key={`${e.date}-${i}`}
              className={`flex items-center justify-between gap-4 px-5 py-3 ${
                i !== events.length - 1
                  ? 'border-border-default/60 border-b'
                  : ''
              }`}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-text truncate text-sm">
                  {e.description}
                </span>
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
                currency={currency}
                kind={e.kind === 'income' ? 'positive' : 'negative'}
                showPositiveSign={e.kind === 'income'}
                className="shrink-0 text-sm"
              />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const weeks = new Map<string, UpcomingEvent[]>()
  for (const e of events) {
    const key = isoWeekStart(e.date)
    const arr = weeks.get(key) ?? []
    arr.push(e)
    weeks.set(key, arr)
  }
  const weekEntries = Array.from(weeks.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  )

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-text text-sm font-semibold">Próximos eventos</h2>
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Agrupados por semana
        </span>
      </header>
      <div className="border-border-default bg-surface flex flex-col rounded-[12px] border">
        {weekEntries.map(([weekStart, weekEvents], wi) => {
          const weekNet = weekEvents.reduce(
            (acc, e) => acc + (e.kind === 'income' ? e.amount : -e.amount),
            0,
          )
          return (
            <div
              key={weekStart}
              className={
                wi !== weekEntries.length - 1
                  ? 'border-border-default/60 border-b'
                  : ''
              }
            >
              <div className="bg-surface-hover/40 flex items-baseline justify-between gap-3 px-5 py-2">
                <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                  {formatWeekLabel(weekStart)}
                </span>
                <span
                  className={`tabular text-[12px] ${
                    weekNet >= 0 ? 'text-positive' : 'text-negative'
                  }`}
                >
                  {weekNet >= 0 ? '+' : ''}
                  {Math.round(weekNet).toLocaleString('es-CO')}
                </span>
              </div>
              <ul>
                {weekEvents.map((e, i) => (
                  <li
                    key={`${e.date}-${i}`}
                    className="flex items-center justify-between gap-4 px-5 py-2.5"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-text truncate text-sm">
                        {e.description}
                      </span>
                      <span className="text-text-tertiary text-[11px]">
                        {new Date(e.date + 'T12:00:00Z').toLocaleDateString(
                          'es-CO',
                          {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            timeZone: 'UTC',
                          },
                        )}
                      </span>
                    </div>
                    <Amount
                      value={String(e.amount)}
                      currency={currency}
                      kind={e.kind === 'income' ? 'positive' : 'negative'}
                      showPositiveSign={e.kind === 'income'}
                      className="shrink-0 text-sm"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
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
