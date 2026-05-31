'use client'

import Link from 'next/link'
import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'
import {
  dismissInsight,
  markInsightActed,
} from '@/app/(app)/mi-historia/insights/actions'

type InsightCardData = {
  id: string
  kind: 'anomaly' | 'trend' | 'forecast' | 'recommendation' | 'achievement'
  severity: 'info' | 'notice' | 'warning'
  title: string
  body: string
  data: Record<string, unknown> | null
  action: Record<string, unknown> | null
  status: 'unread' | 'read' | 'dismissed' | 'acted'
  createdAt: Date
  generatedBy: string | null
}

const kindLabel: Record<InsightCardData['kind'], string> = {
  anomaly: 'Anomalía',
  trend: 'Tendencia',
  forecast: 'Proyección',
  recommendation: 'Recomendación',
  achievement: 'Logro',
}

const severityTone: Record<
  InsightCardData['severity'],
  { dot: string; chip: string }
> = {
  info: { dot: 'bg-text-tertiary', chip: 'text-text-secondary' },
  notice: { dot: 'bg-warning', chip: 'text-warning' },
  warning: { dot: 'bg-negative', chip: 'text-negative' },
}

type ActionPayload = {
  type?: string
  params?: Record<string, string>
  label?: string
}

function actionHref(action: ActionPayload): string | null {
  if (!action.type) return null
  if (action.type === 'view-transactions') {
    const params = new URLSearchParams()
    if (action.params?.categoryId) params.set('categoryId', action.params.categoryId)
    if (action.params?.from) params.set('from', action.params.from)
    if (action.params?.to) params.set('to', action.params.to)
    const qs = params.toString()
    return qs ? `/mi-dinero/movimientos?${qs}` : '/mi-dinero/movimientos'
  }
  if (action.type === 'view-budgets') return '/mi-plan/presupuestos'
  return null
}

export function InsightCard({
  insight,
  compact = false,
}: {
  insight: InsightCardData
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const tone = severityTone[insight.severity]
  const action: ActionPayload = (insight.action as ActionPayload) ?? {}
  const href = actionHref(action)
  const aiGenerated = insight.kind === 'recommendation' || insight.generatedBy?.startsWith('claude')
  const Spark = icons.sparkles
  const X = icons.x

  function onDismiss() {
    startTransition(async () => {
      const res = await dismissInsight(insight.id)
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      router.refresh()
    })
  }

  function onActed() {
    startTransition(async () => {
      const res = await markInsightActed(insight.id)
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      router.refresh()
    })
  }

  return (
    <article
      className={cn(
        'border-border-default bg-surface relative flex flex-col gap-3 rounded-[12px] border p-4',
        compact ? 'p-3.5' : 'p-4',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn('size-1.5 rounded-full', tone.dot)} aria-hidden />
          <span
            className={cn(
              'text-[11px] uppercase tracking-[0.08em]',
              tone.chip,
            )}
          >
            {kindLabel[insight.kind]}
          </span>
          {aiGenerated && (
            <Spark
              strokeWidth={1.5}
              className="size-3"
              style={{ color: 'var(--accent-ai)' }}
              aria-label="Generado por IA"
            />
          )}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          disabled={pending}
          aria-label="Descartar"
          className="text-text-tertiary hover:text-text -m-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] p-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40 sm:min-h-0 sm:min-w-0"
        >
          <X strokeWidth={1.5} className="size-3.5" />
        </button>
      </div>

      {/* data-insight-text: el modo privacidad del dashboard difumina esta prosa
          porque puede contener montos crudos interpolados (no son `.amount`). */}
      <div className="flex flex-col gap-1.5" data-insight-text>
        <h3 className={cn('text-text font-semibold', compact ? 'text-sm' : 'text-base')}>
          {insight.title}
        </h3>
        <p className={cn('text-text-secondary', compact ? 'text-[13px]' : 'text-sm')}>
          {insight.body}
        </p>
      </div>

      {(href || !compact) && (
        <div className="flex items-center justify-end gap-2">
          {href && (
            <Button asChild variant="outline" size="sm">
              <Link href={href} onClick={onActed}>
                {action.label ?? 'Abrir'}
              </Link>
            </Button>
          )}
        </div>
      )}
    </article>
  )
}
