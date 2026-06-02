import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import {
  getInsightsData,
  type InsightListItem,
} from '@/lib/db/queries/insights'
import { getHealthScore } from '@/lib/db/queries/health'
import { getProfile } from '@/lib/db/queries/profile'
import { EmptyState } from '@/components/app/empty-state'
import { HealthCard } from '@/components/app/health-card'
import { InsightCard } from '@/components/app/insight-card'
import { RunInsightsButton } from '@/components/app/run-insights-button'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Insights',
}

type SearchParams = Promise<{ kind?: string }>

const kindFilters: Array<{
  value: InsightListItem['kind'] | null
  label: string
}> = [
  { value: null, label: 'Todas' },
  { value: 'anomaly', label: 'Anomalías' },
  { value: 'trend', label: 'Tendencias' },
  { value: 'forecast', label: 'Proyecciones' },
  { value: 'recommendation', label: 'Recomendaciones' },
]

function kindParam(value: InsightListItem['kind'] | null): string {
  if (!value) return ''
  return `?kind=${value}`
}

function isInsightKind(v: string | undefined): v is InsightListItem['kind'] {
  return (
    v === 'anomaly' ||
    v === 'trend' ||
    v === 'forecast' ||
    v === 'recommendation' ||
    v === 'achievement'
  )
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
}

/** Mes (YYYY-MM) al que pertenece un insight: usamos `periodEnd` si existe,
 *  si no `createdAt`. Insights sin contexto temporal van a "Sin fecha". */
function bucketFor(insight: InsightListItem): string {
  const dateStr = insight.periodEnd ?? insight.createdAt.toISOString().slice(0, 10)
  return dateStr.slice(0, 7)
}

function monthLabel(period: string): string {
  if (period === 'Sin fecha') return period
  const [year, month] = period.split('-')
  const label = MONTH_LABELS[month ?? ''] ?? period
  return `${label} ${year ?? ''}`.trim()
}

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  const params = await searchParams
  const kind = isInsightKind(params.kind) ? params.kind : undefined
  const today = new Date().toISOString().slice(0, 10)

  const [{ list, reportPeriods: reportPeriodsList }, profile] = await Promise.all([
    getInsightsData(user.id, kind, today),
    getProfile(user.id),
  ])
  const reportPeriods = new Set(reportPeriodsList)
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode
  // El score de salud es la síntesis de las señales; encabeza la página. Solo
  // se muestra en la vista sin filtro (es global, no por tipo de insight).
  const health = kind ? null : await getHealthScore(user.id, baseCurrency, today)

  // Agrupar por mes preservando orden de la query (más reciente primero).
  const groups = new Map<string, InsightListItem[]>()
  for (const ins of list) {
    const key = bucketFor(ins)
    const arr = groups.get(key) ?? []
    arr.push(ins)
    groups.set(key, arr)
  }
  const orderedGroups = Array.from(groups.entries()).sort(([a], [b]) =>
    b.localeCompare(a),
  )

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-text-secondary text-sm">Insights</p>
          <h1 className="editorial text-text text-3xl italic tracking-tight sm:text-4xl">
            Lo que Finanzia notó por ti
          </h1>
          <p className="text-text-tertiary mt-1 max-w-prose text-[13px]">
            Anomalías, tendencias y proyecciones que el motor destila cada noche
            de tu historial. Agrupadas por mes para que veas el pulso.
          </p>
        </div>
        <RunInsightsButton />
      </header>

      {health && <HealthCard health={health} />}

      <nav
        aria-label="Filtros"
        className="border-border-default flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-[8px] border p-0.5"
      >
        {kindFilters.map((f) => {
          const selected = (f.value ?? null) === (kind ?? null)
          return (
            <Link
              key={f.label}
              href={`/mi-historia/insights${kindParam(f.value)}`}
              className={cn(
                'shrink-0 rounded-[6px] px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors',
                selected
                  ? 'bg-surface-hover text-text'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover/60',
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </nav>

      {list.length === 0 ? (
        <EmptyState
          headline={
            kind ? 'No hay lecturas en este filtro.' : 'Sin lecturas todavía.'
          }
          body="Cada noche Finanzia revisa tu historial y destila patrones, anomalías y proyecciones. También puedes correr el análisis ahora."
          action={<RunInsightsButton />}
        />
      ) : (
        <div className="flex flex-col gap-10 lg:gap-12">
          {orderedGroups.map(([period, items]) => {
            const hasReport = reportPeriods.has(period)
            return (
              <section key={period} className="flex flex-col gap-4">
                <header className="border-border-default/60 flex flex-wrap items-baseline justify-between gap-3 border-b pb-2">
                  <h2 className="editorial text-text text-xl italic capitalize sm:text-2xl">
                    {monthLabel(period)}
                  </h2>
                  <div className="flex items-center gap-3 text-[12px]">
                    <span className="text-text-tertiary tabular">
                      {items.length} {items.length === 1 ? 'lectura' : 'lecturas'}
                    </span>
                    {hasReport && (
                      <Link
                        href={`/mi-historia/informes/${period}`}
                        className="text-text-secondary hover:text-text underline-offset-2 transition-colors hover:underline"
                      >
                        Ver informe del mes →
                      </Link>
                    )}
                  </div>
                </header>
                <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {items.map((insight) => (
                    <li key={insight.id}>
                      <InsightCard insight={insight} />
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
