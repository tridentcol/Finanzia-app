import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { listInsightsForUser, type InsightListItem } from '@/lib/db/queries/insights'
import { EmptyState } from '@/components/app/empty-state'
import { InsightCard } from '@/components/app/insight-card'
import { RunInsightsButton } from '@/components/app/run-insights-button'
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

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  const params = await searchParams
  const kind = isInsightKind(params.kind) ? params.kind : undefined

  const list = await listInsightsForUser(user.id, { kind, limit: 80 })

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-text-secondary text-sm">Insights</p>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Lecturas
          </h1>
        </div>
        <RunInsightsButton />
      </header>

      <nav
        aria-label="Filtros"
        className="border-border-default -mx-1 flex items-center gap-1 self-start overflow-x-auto rounded-[8px] border p-0.5"
      >
        {kindFilters.map((f) => {
          const selected = (f.value ?? null) === (kind ?? null)
          return (
            <Link
              key={f.label}
              href={`/insights${kindParam(f.value)}`}
              className={cn(
                'rounded-[6px] px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors',
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
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {list.map((insight) => (
            <li key={insight.id}>
              <InsightCard insight={insight} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
