import { projectCashFlow } from '@/lib/cash-flow/project'
import { CashFlowChart } from '@/components/app/cash-flow-chart-lazy'
import { WhatIfPanel, type WhatIfGoal } from '@/components/app/what-if-panel'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import { InfoHint } from '@/components/app/info-hint'
import type { listRecurringForUser } from '@/lib/db/queries/recurring'
import type { CurrencyCode } from '@/lib/currency/currencies'

import { breakdownByCategory } from './breakdown'
import { BreakdownCard } from './breakdown-card'
import { KpiCell, HorizonStat } from './cash-flow-stats'
import { UpcomingEvents } from './upcoming-events'

type RuleListItem = Awaited<ReturnType<typeof listRecurringForUser>>[number]

/**
 * Bloque de proyección de cash flow: KPIs a 30 días, mini-stats por horizonte,
 * chart a 90 días, simulador what-if y breakdowns de recurrentes. Recibe los
 * inputs crudos (reglas, saldo, volatilidad, metas) y deriva todo aquí; la page
 * solo hace fetch + hero. Server Component.
 */
export function CashFlowProjection({
  rules,
  startingBalance,
  volatility,
  goals,
  baseCurrency,
}: {
  rules: RuleListItem[]
  startingBalance: number
  volatility: number
  goals: WhatIfGoal[]
  baseCurrency: CurrencyCode
}) {
  const activeRules = rules.filter((r) => r.active)

  if (activeRules.length === 0) {
    return (
      <EmptyState
        headline="Aún no hay reglas recurrentes activas."
        body="Configura ingresos y gastos programados desde Mi plan · Recurrentes y Finanzia proyectará el flujo de los próximos 90 días."
      />
    )
  }

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

  // Runway: días que duraría el saldo actual sin ingresos, manteniendo gastos.
  const dailyExpense = expenseNext30 / 30
  const runwayDays = dailyExpense > 0 ? Math.floor(startingBalance / dailyExpense) : null

  // Breakdown de gastos e ingresos recurrentes por categoría.
  const expensesBreakdown = breakdownByCategory(
    activeRules.filter((r) => r.kind === 'expense'),
    false,
  )
  const incomesBreakdown = breakdownByCategory(
    activeRules.filter((r) => r.kind === 'income'),
    true,
  )

  // Topes de las palancas del simulador.
  const maxCut = Math.max(50_000, Math.ceil((expensesBreakdown.sum || 0) / 50_000) * 50_000)
  const maxIncome = Math.max(maxCut, Math.ceil(incomeNext30 / 50_000) * 50_000)
  const maxOneOff = Math.max(500_000, Math.ceil(startingBalance / 100_000) * 100_000)

  // Próximos eventos para la lista de detalle.
  const upcoming = points
    .slice(1, 15)
    .flatMap((p) => p.events.map((e) => ({ ...e, date: p.date })))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 12)

  return (
    <>
      {/* Próximos 30 días — composición del flujo */}
      <section className="flex flex-col gap-3">
        <header className="flex items-baseline justify-between">
          <h2 className="text-text text-sm font-semibold">Próximos 30 días</h2>
          <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
            Esperado del recurrente
          </span>
        </header>
        <div className="border-border-default bg-surface grid grid-cols-2 divide-x divide-[color:var(--border-default)] overflow-hidden rounded-[12px] border sm:grid-cols-4">
          <KpiCell label="Ingresos" value={incomeNext30} currency={baseCurrency} tone="positive" />
          <KpiCell label="Gastos" value={expenseNext30} currency={baseCurrency} tone="negative" />
          <KpiCell
            label="Neto"
            value={netNext30}
            currency={baseCurrency}
            tone={netNext30 >= 0 ? 'positive' : 'negative'}
            showSign
          />
          <KpiCell
            label="Runway"
            value={runwayDays !== null ? `${runwayDays}d` : '∞'}
            hint={runwayDays !== null ? 'sin ingresos' : 'sin gastos recurrentes'}
            info="Cuántos días aguantarían tus saldos actuales si dejaras de recibir ingresos hoy, manteniendo solo los gastos recurrentes."
          />
        </div>
      </section>

      {/* Mini-stats por horizonte */}
      <section className="border-border-default bg-surface grid grid-cols-3 divide-x divide-[color:var(--border-default)] overflow-hidden rounded-[12px] border">
        <HorizonStat label="Hoy" value={startingBalance} currency={baseCurrency} />
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
          <h2 className="text-text text-sm font-semibold">Proyección a 90 días</h2>
          <span className="text-text-tertiary flex items-center gap-1 text-[11px] tracking-[0.08em] uppercase">
            {activeRules.length} {activeRules.length === 1 ? 'regla activa' : 'reglas activas'}
            {volatility > 0 && (
              <>
                {' · banda ±1σ'}
                <InfoHint label="La banda muestra la incertidumbre del gasto no recurrente. ±1σ significa que en condiciones normales tu saldo caería dentro de esa banda 7 de cada 10 días, según tu volatilidad histórica." />
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
          {volatility > 0 && <>{' · '}banda ±1σ del gasto discrecional histórico</>}
        </p>
      </section>

      {/* Escenarios what-if — palancas y su efecto en saldo, runway y metas. */}
      <WhatIfPanel
        startingBalance={startingBalance}
        monthlyIncome={incomeNext30}
        monthlyExpense={expenseNext30}
        balance90={balance90}
        goals={goals}
        maxCut={maxCut}
        maxIncome={maxIncome}
        maxOneOff={maxOneOff}
        baseCurrency={baseCurrency}
      />

      {/* Breakdowns paralelos: ingresos y gastos recurrentes */}
      {(incomesBreakdown.entries.length > 0 || expensesBreakdown.entries.length > 0) && (
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
      {upcoming.length > 0 && <UpcomingEvents events={upcoming} currency={baseCurrency} />}
    </>
  )
}
