'use client'

import { useMemo, useState } from 'react'

import { Amount } from '@/components/app/amount'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { cn } from '@/lib/utils'

export type SparkPoint = { date: string; net: number }

const PERIODS = [
  { key: '3m', label: '3m', months: 3 },
  { key: '6m', label: '6m', months: 6 },
  { key: 'año', label: 'Año', months: 12 },
] as const
type PeriodKey = (typeof PERIODS)[number]['key']

function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`)
}

/** Recorta la serie a los últimos `months` meses; garantiza ≥2 puntos. */
function sliceByMonths(points: SparkPoint[], months: number): SparkPoint[] {
  if (points.length <= 2) return points
  const last = toDate(points[points.length - 1]!.date)
  const cutoff = new Date(last)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  const sliced = points.filter((p) => toDate(p.date) >= cutoff)
  return sliced.length >= 2 ? sliced : points.slice(-2)
}

function periodLabel(key: PeriodKey): string {
  return key === '3m' ? 'últimos 3 meses' : key === '6m' ? 'últimos 6 meses' : 'último año'
}

/**
 * Sparkline de patrimonio neto del hero. SVG puro estirado al contenedor; el
 * punto y la guía de hover se superponen como HTML (porcentajes) para que no se
 * deformen con el escalado no-uniforme. Interacción Noir y discreta:
 * - Toggle de período (3m/6m/Año) recorta la serie en cliente, sin refetch.
 * - Al pasar el cursor, el chip de delta se intercambia por la lectura del punto
 *   (fecha + valor enmascarable), y aparece una guía vertical + punto.
 */
export function NetWorthSparkline({
  points,
  baseCurrency,
}: {
  points: SparkPoint[]
  baseCurrency: CurrencyCode
}) {
  const defaultPeriod = useMemo<PeriodKey>(() => {
    for (const p of PERIODS) {
      if (sliceByMonths(points, p.months).length >= 2) return p.key
    }
    return 'año'
  }, [points])

  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod)
  const [hover, setHover] = useState<number | null>(null)

  const months = PERIODS.find((p) => p.key === period)!.months
  const sliced = useMemo(() => sliceByMonths(points, months), [points, months])

  const coords = useMemo(() => {
    const W = 100
    const H = 100
    const pad = 10
    const vals = sliced.map((p) => p.net)
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const last = sliced.length - 1
    return sliced.map((p, i) => ({
      x: (i / last) * W,
      y: pad + (1 - (p.net - min) / range) * (H - pad * 2),
    }))
  }, [sliced])

  const linePts = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ')
  const areaPts = `${linePts} 100,100 0,100`

  const first = sliced[0]!.net
  const last = sliced[sliced.length - 1]!.net
  const diff = last - first
  const rising = diff >= 0
  const stroke = rising ? 'var(--positive)' : 'var(--negative)'
  const toneText = rising ? 'text-positive' : 'text-negative'

  const pct = first !== 0 ? (diff / Math.abs(first)) * 100 : null

  const hovered = hover !== null ? sliced[hover] : null

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    if (rect.width === 0) return
    const ratio = (e.clientX - rect.left) / rect.width
    const idx = Math.round(ratio * (sliced.length - 1))
    setHover(Math.max(0, Math.min(sliced.length - 1, idx)))
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Lectura: delta del período, o el punto bajo el cursor */}
      <div className="flex items-center justify-between gap-3">
        {hovered ? (
          <p className="text-text-secondary flex items-baseline gap-1.5 text-xs">
            <span className="text-text-tertiary tabular">
              {toDate(hovered.date).toLocaleDateString('es-CO', {
                month: 'short',
                year: '2-digit',
                timeZone: 'UTC',
              })}
            </span>
            <Amount value={hovered.net.toFixed(2)} currency={baseCurrency} compact className="text-text-secondary text-xs" />
          </p>
        ) : (
          <p className="text-text-tertiary text-xs">
            <span className={cn('tabular', toneText)}>
              {rising ? '+' : '−'}
              {pct !== null
                ? `${Math.abs(pct).toFixed(1)}%`
                : formatMoney(Math.abs(diff), { currency: baseCurrency, compact: true })}
            </span>{' '}
            · {periodLabel(period)}
          </p>
        )}

        <div className="flex items-center gap-0.5" role="group" aria-label="Período del patrimonio">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setPeriod(p.key)
                setHover(null)
              }}
              aria-pressed={p.key === period}
              className={cn(
                'rounded-[6px] px-2 py-0.5 text-[11px] transition-colors',
                p.key === period
                  ? 'bg-surface-hover text-text'
                  : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sparkline */}
      <div
        className="relative h-16 w-full touch-none"
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          className="block h-full w-full"
        >
          <polygon points={areaPts} fill={stroke} fillOpacity={0.06} />
          <polyline
            points={linePts}
            fill="none"
            stroke={stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {hover !== null && coords[hover] && (
          <>
            <span
              aria-hidden
              className="bg-border-emphasis pointer-events-none absolute top-0 bottom-0 w-px"
              style={{ left: `${coords[hover]!.x}%` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                left: `${coords[hover]!.x}%`,
                top: `${coords[hover]!.y}%`,
                background: stroke,
              }}
            />
          </>
        )}
      </div>
    </div>
  )
}
