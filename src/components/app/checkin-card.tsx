'use client'

import { useTransition } from 'react'

import { icons } from '@/lib/design/icons'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import type { WeeklyCheckin } from '@/lib/db/schema'
import { runWeeklyCheckinNow } from '@/app/(app)/dashboard/actions'
import { cn } from '@/lib/utils'

const Sparkles = icons.sparkles
const RotateCcw = icons['rotate-ccw']

function rangeLabel(weekStart: string, weekEnd: string): string {
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    })
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`
}

/**
 * Card del check-in semanal proactivo — compacta y SIEMPRE presente (no se
 * despliega ni se oculta). Presencia de IA → acento lavanda (`accent-ai`) en el
 * sparkle. Muestra el resumen de la semana calendario en curso + una línea de
 * stats clave; el botón de refresco regenera. Si no hay check-in aún, ofrece
 * generarlo. Editorial, Noir: sin emojis, números tabulares.
 */
export function CheckinCard({
  checkin,
  baseCurrency,
}: {
  checkin: WeeklyCheckin | null
  baseCurrency: CurrencyCode
}) {
  const [pending, startTransition] = useTransition()

  function generate() {
    startTransition(async () => {
      await runWeeklyCheckinNow()
    })
  }

  if (!checkin) {
    return (
      <section className="border-border-default bg-surface flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--accent-ai)]/30">
            <Sparkles strokeWidth={1.5} className="h-3.5 w-3.5 text-[color:var(--accent-ai)]" />
          </span>
          <p className="text-text-secondary text-[13px]">
            Tu check-in semanal aparecerá aquí cada domingo.
          </p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="border-border-default hover:bg-surface-hover text-text-secondary hover:text-text shrink-0 rounded-[8px] border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50"
        >
          {pending ? 'Generando…' : 'Generar ahora'}
        </button>
      </section>
    )
  }

  const h = checkin.highlights
  const fmt = (v: string) => formatMoney(v, { currency: baseCurrency, compact: true })
  const isNew = checkin.status === 'unread'

  return (
    <section className="border-border-default bg-surface flex flex-col gap-3 rounded-[12px] border p-4 lg:p-5">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--accent-ai)]/30">
            <Sparkles strokeWidth={1.5} className="h-3.5 w-3.5 text-[color:var(--accent-ai)]" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-text text-sm font-semibold">Tu semana</span>
            <span className="text-text-tertiary tabular text-[11px]">
              {rangeLabel(checkin.weekStart, checkin.weekEnd)}
              {isNew && ' · nuevo'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          aria-label="Actualizar check-in"
          className="text-text-tertiary hover:text-text-secondary shrink-0 rounded-[8px] p-1 transition-colors disabled:opacity-50"
        >
          <RotateCcw strokeWidth={1.5} className={cn('size-3.5', pending && 'animate-spin')} />
        </button>
      </header>

      {checkin.aiSummary && (
        <p className="text-text-secondary line-clamp-3 max-w-prose text-[13px] leading-relaxed">
          {checkin.aiSummary}
        </p>
      )}

      <div className="text-text-tertiary flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
        <span>
          Gasto: <span className="text-text tabular">{fmt(h.net.expense)}</span>
        </span>
        {h.vsAverage && (
          <span
            className={cn('tabular', h.vsAverage.deltaPct > 0 ? 'text-negative' : 'text-positive')}
          >
            {h.vsAverage.deltaPct >= 0 ? '+' : ''}
            {h.vsAverage.deltaPct}% vs promedio
          </span>
        )}
        {h.goalsAtRisk.length > 0 && (
          <span className="text-warning">
            {h.goalsAtRisk.length}{' '}
            {h.goalsAtRisk.length === 1 ? 'meta en riesgo' : 'metas en riesgo'}
          </span>
        )}
      </div>
    </section>
  )
}
