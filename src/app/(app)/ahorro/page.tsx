import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { listSavingsPeriods, getSavingsHeroData } from '@/lib/db/queries/savings'
import { getActiveSavingsPlan } from '@/app/(app)/ajustes/perfil-financiero/actions'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { EmptyState } from '@/components/app/empty-state'
import { SavingsBarChart } from '@/components/app/savings-bar-chart'
import { SavingsForecastChart } from '@/components/app/savings-forecast-chart'
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

function PeriodRow({ period, baseCurrency }: { period: SavingsPeriodRow; baseCurrency: string }) {
  const achieved = Number.parseFloat(period.achievedAmount)
  const target = Number.parseFloat(period.targetAmount)
  const { text, positive } = deltaLabel(achieved, target)

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[--border] last:border-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm font-medium text-[--text] truncate">{periodLabel(period.periodEnd)}</p>
        {target > 0 && (
          <p className="text-xs text-[--text-tertiary]">
            Meta: {formatMoney(target, { currency: baseCurrency as CurrencyCode })}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        <p className="font-mono text-sm font-medium text-[--text]">
          {formatMoney(achieved, { currency: baseCurrency as CurrencyCode })}
        </p>
        <p
          className={`text-xs font-medium ${positive ? 'text-[--positive]' : 'text-[--negative]'}`}
        >
          {text}
        </p>
      </div>
    </div>
  )
}

export default async function AhorroPage() {
  const user = await requireCurrentUser()

  const [periods, hero, profile, activePlan] = await Promise.all([
    listSavingsPeriods(user.id),
    getSavingsHeroData(user.id),
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
    getActiveSavingsPlan(user.id),
  ])

  const baseCurrency = profile?.baseCurrency ?? 'COP'
  const hasPlan = !!activePlan && activePlan.method !== 'none' && activePlan.method !== 'other'

  if (periods.length === 0) {
    return (
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-[--text] sm:text-2xl">Ahorro</h1>
          {activePlan && (
            <p className="text-sm text-[--text-secondary]">
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
                href="/ajustes/perfil-financiero"
                className="text-sm font-medium text-[--text] hover:text-[--text-secondary] underline underline-offset-4 transition-colors"
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
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-[--text] sm:text-2xl">Ahorro</h1>
        {activePlan && activePlan.method !== 'none' && activePlan.method !== 'other' && (
          <p className="text-sm text-[--text-secondary]">
            Plan activo:{' '}
            {activePlan.method === 'percentage_income'
              ? `${(activePlan.params as { percent?: number } | null)?.percent ?? 10}% del ingreso`
              : `${formatMoney(Number.parseFloat((activePlan.params as { amount?: string } | null)?.amount ?? '0'), { currency: baseCurrency as CurrencyCode })} mensual`}
          </p>
        )}
      </header>

      {/* Hero */}
      <section className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.06em] text-[--text-tertiary]">
          Total acumulado ({hero.periodsCount} {hero.periodsCount === 1 ? 'mes' : 'meses'})
        </p>
        <p className="font-mono text-4xl font-semibold tabular-nums text-[--text] sm:text-5xl tracking-tight">
          {formatMoney(hero.totalAchieved, { currency: baseCurrency as CurrencyCode })}
        </p>
      </section>

      {/* Bar chart histórico */}
      <section className="flex flex-col gap-3 rounded-[12px] border border-[--border] bg-[--surface] p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-[0.06em] text-[--text-tertiary]">
            Ahorro por mes
          </p>
          <div className="flex items-center gap-3 text-[10px] text-[--text-tertiary]">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[#7FB89F]" />
              Meta cumplida
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[#D4938A]" />
              Por debajo
            </span>
          </div>
        </div>
        <SavingsBarChart periods={periods} />
      </section>

      {/* Proyección */}
      {hasPlan && (
        <section className="flex flex-col gap-3 rounded-[12px] border border-[--border] bg-[--surface] p-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-xs uppercase tracking-[0.06em] text-[--text-tertiary]">
              Proyección — próximos 12 meses
            </p>
            <p className="text-[11px] text-[--text-tertiary]">
              Basada en tu promedio reciente. La banda muestra variabilidad histórica.
            </p>
          </div>
          <SavingsForecastChart periods={periods} />
        </section>
      )}

      {/* Lista editorial */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-[0.06em] text-[--text-tertiary]">
          Historial de períodos
        </h2>
        <div className="rounded-[12px] border border-[--border] bg-[--surface] px-4">
          {periods.map((p) => (
            <PeriodRow key={p.id} period={p} baseCurrency={baseCurrency} />
          ))}
        </div>
      </section>

      <div className="text-xs text-[--text-tertiary]">
        <Link
          href="/ajustes/perfil-financiero"
          className="underline underline-offset-4 hover:text-[--text-secondary] transition-colors"
        >
          Cambiar plan de ahorro
        </Link>
      </div>
    </div>
  )
}
