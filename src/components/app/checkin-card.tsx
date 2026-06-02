'use client'

import { useState, useTransition } from 'react'

import { icons } from '@/lib/design/icons'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import type { WeeklyCheckin } from '@/lib/db/schema'
import { runWeeklyCheckinNow, markCheckinRead } from '@/app/(app)/dashboard/actions'
import { cn } from '@/lib/utils'

const Sparkles = icons.sparkles

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
 * Card del check-in semanal proactivo. Presencia de IA → acento lavanda
 * (`accent-ai`) en el sparkle, uso canónico. Si no hay check-in aún, ofrece
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
  // Optimismo local para ocultar al archivar sin esperar el round-trip. El
  // estado real lo manda el server (`checkin.status`); al generar lo reseteamos.
  const [dismissed, setDismissed] = useState(false)

  function generate() {
    setDismissed(false)
    startTransition(async () => {
      await runWeeklyCheckinNow()
    })
  }

  const archived = (checkin != null && checkin.status === 'read') || dismissed

  if (!checkin || archived) {
    return (
      <section className="border-border-default bg-surface flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--accent-ai)]/30">
            <Sparkles strokeWidth={1.5} className="h-4 w-4 text-[color:var(--accent-ai)]" />
          </span>
          <p className="text-text-secondary text-sm">
            {archived ? 'Check-in archivado.' : 'Tu check-in semanal aparecerá aquí cada domingo.'}
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
  const fmt = (v: string) =>
    formatMoney(v, { currency: baseCurrency, compact: true })

  return (
    <section className="border-border-default bg-surface flex flex-col gap-5 rounded-[12px] border p-5 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--accent-ai)]/30">
            <Sparkles strokeWidth={1.5} className="h-4 w-4 text-[color:var(--accent-ai)]" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-text text-sm font-semibold">Tu semana</span>
            <span className="text-text-tertiary text-[11px] tabular">
              {rangeLabel(checkin.weekStart, checkin.weekEnd)}
              {checkin.status === 'unread' && ' · nuevo'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setDismissed(true)
            void markCheckinRead(checkin.id)
          }}
          className="text-text-tertiary hover:text-text-secondary shrink-0 text-[12px] transition-colors"
        >
          Archivar
        </button>
      </header>

      {checkin.aiSummary && (
        <p className="text-text-secondary editorial max-w-prose text-[15px] leading-relaxed italic">
          {checkin.aiSummary}
        </p>
      )}

      <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {/* Gasto vs promedio */}
        <Stat
          label="Gasto de la semana"
          value={fmt(h.net.expense)}
          hint={
            h.vsAverage
              ? `${h.vsAverage.deltaPct >= 0 ? '+' : ''}${h.vsAverage.deltaPct}% vs promedio`
              : undefined
          }
          hintTone={h.vsAverage ? (h.vsAverage.deltaPct > 0 ? 'negative' : 'positive') : 'neutral'}
        />

        {/* Top categorías */}
        {h.topCategories.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Dónde se fue
            </span>
            <ul className="flex flex-col gap-1">
              {h.topCategories.slice(0, 3).map((c) => (
                <li key={c.name} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-text-secondary truncate">{c.name}</span>
                  <span className="text-text tabular shrink-0">{fmt(c.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recurrentes próximos */}
        {h.upcomingRecurring.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Viene esta semana
            </span>
            <ul className="flex flex-col gap-1">
              {h.upcomingRecurring.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-text-secondary truncate">{r.description}</span>
                  <span className="text-text tabular shrink-0">
                    {formatMoney(r.amount, { currency: r.currency as CurrencyCode, compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Metas en riesgo */}
        {h.goalsAtRisk.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Metas que necesitan atención
            </span>
            <ul className="flex flex-col gap-1">
              {h.goalsAtRisk.map((g) => (
                <li key={g.name} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="text-text-secondary truncate">{g.name}</span>
                  <span className="text-warning tabular shrink-0">{Math.round(g.percent * 100)}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {h.insightTitles.length > 0 && (
        <div className="border-border-default/60 flex flex-col gap-1.5 border-t pt-4">
          <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Señales que notamos
          </span>
          <ul className="flex flex-col gap-1">
            {h.insightTitles.map((t, i) => (
              <li key={i} className="text-text-secondary text-[13px]">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
  hintTone = 'neutral',
}: {
  label: string
  value: string
  hint?: string
  hintTone?: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="text-text amount text-2xl">{value}</span>
      {hint && (
        <span
          className={cn(
            'text-[12px] tabular',
            hintTone === 'negative' && 'text-negative',
            hintTone === 'positive' && 'text-positive',
            hintTone === 'neutral' && 'text-text-tertiary',
          )}
        >
          {hint}
        </span>
      )}
    </div>
  )
}
