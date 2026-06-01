import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import { getAhorroData } from '@/lib/db/queries/savings'
import { getActiveSavingsPlan } from '@/app/(app)/ajustes/perfil-financiero/actions'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import { SavingsBarChart } from '@/components/app/savings-bar-chart-lazy'
import { SavingsForecastChart } from '@/components/app/savings-forecast-chart-lazy'
import type { SavingsPeriodRow } from '@/lib/db/queries/savings'

export const metadata: Metadata = {
  title: 'Ahorro',
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
}

function periodLabel(periodEnd: string): string {
  const parts = periodEnd.split('-')
  const month = parts[1] ?? ''
  const year = parts[0] ?? ''
  return `${MONTH_LABELS[month] ?? month} ${year}`
}

function deltaLabel(achieved: number, target: number): { text: string; positive: boolean } {
  if (target === 0) return { text: formatMoney(achieved, { currency: 'COP' }), positive: achieved >= 0 }
  const pct = Math.round((achieved / target) * 100)
  return {
    text: `${pct}% de la meta`,
    positive: pct >= 100,
  }
}

function PeriodRow({
  period,
  baseCurrency,
  isLast,
}: {
  period: SavingsPeriodRow
  baseCurrency: string
  isLast: boolean
}) {
  const achieved = Number.parseFloat(period.achievedAmount)
  const target = Number.parseFloat(period.targetAmount)
  const { text, positive } = deltaLabel(achieved, target)

  return (
    <div
      className={`flex items-center justify-between gap-4 px-5 py-3.5 ${
        !isLast ? 'border-border-default/60 border-b' : ''
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-text truncate text-sm capitalize">{periodLabel(period.periodEnd)}</p>
        {target > 0 && (
          <p className="text-text-tertiary text-[11px]">
            Meta: {formatMoney(target, { currency: baseCurrency as CurrencyCode, compact: true })}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <Amount
          value={String(achieved.toFixed(2))}
          currency={baseCurrency as CurrencyCode}
          kind={positive ? 'positive' : achieved < 0 ? 'negative' : 'neutral'}
          className="text-sm"
        />
        <p
          className={`text-[11px] ${
            positive ? 'text-positive' : 'text-text-tertiary'
          }`}
        >
          {text}
        </p>
      </div>
    </div>
  )
}

export default async function AhorroPage() {
  const user = await requireCurrentUser()

  const today = new Date().toISOString().slice(0, 10)
  const [{ periods, hero, goals }, profile, activePlan] = await Promise.all([
    getAhorroData(user.id, today),
    getProfile(user.id),
    getActiveSavingsPlan(user.id),
  ])

  const baseCurrency = profile?.baseCurrency ?? 'COP'
  const hasPlan = !!activePlan && activePlan.method !== 'none' && activePlan.method !== 'other'

  // Allocation visual: metas activas con fecha futura y ritmo mensual necesario.
  // El "ahorro mensual disponible" es el promedio de los últimos períodos
  // cerrados (proxy razonable de capacidad mensual).
  const monthlySavingsAvg =
    periods.length > 0
      ? periods.slice(0, 3).reduce((acc, p) => acc + Number.parseFloat(p.achievedAmount), 0) /
        Math.min(3, periods.length)
      : 0

  const allocations = goals
    .filter((g) => g.status === 'active' && g.daysToTarget !== null && g.daysToTarget > 0)
    .map((g) => {
      const remaining =
        Number.parseFloat(g.targetAmount) - Number.parseFloat(g.currentAmount)
      const monthsLeft = Math.max(1, (g.daysToTarget ?? 30) / 30)
      const requiredMonthly = remaining > 0 ? remaining / monthsLeft : 0
      const allocPct = monthlySavingsAvg > 0 ? requiredMonthly / monthlySavingsAvg : 0
      return {
        id: g.id,
        name: g.name,
        currency: g.currency as CurrencyCode,
        requiredMonthly,
        allocPct,
      }
    })
    .filter((a) => a.requiredMonthly > 0)

  const totalAllocPct = allocations.reduce((acc, a) => acc + a.allocPct, 0)

  if (periods.length === 0) {
    return (
      <div className="flex flex-col gap-10 lg:gap-12">
        <header className="flex min-w-0 flex-col gap-1">
          <p className="text-text-secondary text-sm">Ahorro</p>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Tu progreso, mes a mes
          </h1>
          {activePlan && (
            <p className="text-text-tertiary text-xs">
              Plan:{' '}
              {activePlan.method === 'percentage_income'
                ? `${(activePlan.params as { percent?: number } | null)?.percent ?? 10}% del ingreso`
                : activePlan.method === 'fixed_amount'
                  ? `${formatMoney(Number.parseFloat((activePlan.params as { amount?: string } | null)?.amount ?? '0'), { currency: baseCurrency as CurrencyCode })} mensual`
                  : 'Personalizado'}
            </p>
          )}
        </header>

        <EmptyState
          headline="Aún no hay períodos cerrados."
          body={
            hasPlan
              ? 'El primer corte se calculará al inicio del mes que viene. Mientras tanto, registra tus ingresos y gastos para que el motor tenga datos.'
              : 'Configura tu plan de ahorro para que Finanzia calcule automáticamente cuánto ahorraste cada mes.'
          }
          action={
            !hasPlan ? (
              <Link
                href="/ajustes#perfil"
                className="text-sm font-medium text-text hover:text-text-secondary underline underline-offset-4 transition-colors"
              >
                Configurar plan
              </Link>
            ) : undefined
          }
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary text-sm">Ahorro</p>
        <Amount
          value={String(hero.totalAchieved.toFixed(2))}
          currency={baseCurrency as CurrencyCode}
          display
          kind={hero.totalAchieved >= 0 ? 'neutral' : 'negative'}
          className="block truncate text-[28px] sm:text-4xl md:text-5xl lg:text-6xl"
        />
        <p className="text-text-tertiary text-xs">
          Acumulado en {hero.periodsCount} {hero.periodsCount === 1 ? 'mes' : 'meses'}
          {activePlan && activePlan.method !== 'none' && activePlan.method !== 'other' && (
            <>
              {' · '}Plan:{' '}
              {activePlan.method === 'percentage_income'
                ? `${(activePlan.params as { percent?: number } | null)?.percent ?? 10}% del ingreso`
                : `${formatMoney(Number.parseFloat((activePlan.params as { amount?: string } | null)?.amount ?? '0'), { currency: baseCurrency as CurrencyCode })} mensual`}
            </>
          )}
        </p>
      </header>

      {/* Bar chart histórico */}
      <section className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-text text-sm font-semibold">Ahorro por mes</h2>
          <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[#7FB89F]" />
              Meta cumplida
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[#D4938A]" />
              Por debajo
            </span>
          </div>
        </header>
        <div className="border-border-default bg-surface rounded-[12px] border px-5 py-6">
          <SavingsBarChart periods={periods} />
        </div>
      </section>

      {/* Proyección */}
      {hasPlan && (
        <section className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between gap-3">
            <h2 className="text-text text-sm font-semibold">Proyección a 12 meses</h2>
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Promedio reciente ±1σ
            </span>
          </header>
          <div className="border-border-default bg-surface rounded-[12px] border px-5 py-6">
            <SavingsForecastChart periods={periods} />
          </div>
        </section>
      )}

      {/* Allocation a metas */}
      {allocations.length > 0 && monthlySavingsAvg > 0 && (
        <section className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between gap-3">
            <h2 className="text-text text-sm font-semibold">Hacia tus metas</h2>
            <Link
              href="/mi-plan/metas"
              className="text-text-secondary hover:text-text text-[13px] transition-colors"
            >
              Ver metas
            </Link>
          </header>
          <div className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-5">
            <p className="text-text-tertiary text-[12px] leading-relaxed">
              Con un promedio de{' '}
              <span className="text-text-secondary tabular">
                {formatMoney(monthlySavingsAvg, {
                  currency: baseCurrency as CurrencyCode,
                  compact: true,
                })}
              </span>{' '}
              ahorrados al mes, así se reparte el esfuerzo entre tus metas activas.
            </p>
            <ul className="flex flex-col gap-3">
              {allocations.map((a) => {
                const widthPct = Math.min(100, a.allocPct * 100)
                return (
                  <li key={a.id} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-text truncate text-[13px]">{a.name}</span>
                      <span className="text-text-secondary tabular shrink-0 text-[12px]">
                        {formatMoney(a.requiredMonthly, {
                          currency: a.currency,
                          compact: true,
                        })}
                        <span className="text-text-tertiary ml-2 text-[11px]">
                          {Math.round(a.allocPct * 100)}%
                        </span>
                      </span>
                    </div>
                    <div className="bg-surface-hover h-1 overflow-hidden rounded-full">
                      <div
                        aria-hidden
                        className="h-full rounded-full"
                        style={{
                          width: `${widthPct}%`,
                          background: 'var(--brand-purple-strong)',
                        }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
            {totalAllocPct > 1 && (
              <p className="text-warning text-[11px]">
                Sumadas, las metas requieren {Math.round(totalAllocPct * 100)}% de tu
                ahorro mensual promedio. Considera alargar una fecha o ajustar el monto.
              </p>
            )}
            {totalAllocPct < 1 && totalAllocPct > 0 && (
              <p className="text-text-tertiary text-[11px]">
                Te queda {Math.round((1 - totalAllocPct) * 100)}% del ahorro mensual
                sin asignar a metas.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Lista editorial */}
      <section className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between gap-3">
          <h2 className="text-text text-sm font-semibold">Historial de períodos</h2>
          <Link
            href="/ajustes#perfil"
            className="text-text-secondary hover:text-text text-[13px] transition-colors"
          >
            Cambiar plan
          </Link>
        </header>
        <div className="border-border-default bg-surface rounded-[12px] border">
          {periods.map((p, i) => (
            <PeriodRow
              key={p.id}
              period={p}
              baseCurrency={baseCurrency}
              isLast={i === periods.length - 1}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
