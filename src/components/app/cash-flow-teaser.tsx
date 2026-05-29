'use client'

import Link from 'next/link'
import { scaleLinear, scaleTime } from '@visx/scale'
import { LinePath, Area } from '@visx/shape'
import { curveMonotoneX } from '@visx/curve'
import { ParentSize } from '@visx/responsive'

import type { CashFlowPoint } from '@/lib/cash-flow/project'
import { Amount } from './amount'
import type { CurrencyCode } from '@/lib/currency/currencies'

type Props = {
  points: CashFlowPoint[]
  currency: CurrencyCode
  startingBalance: number
}

/**
 * Mini-widget de cash flow para `/dashboard`. Muestra una sparkline de los
 * próximos 30 días + el saldo proyectado al final del horizonte. Click
 * navega a `/cash-flow` para la versión completa.
 */
export function CashFlowTeaser({ points, currency, startingBalance }: Props) {
  const visible = points.slice(0, 31)
  const ending = visible[visible.length - 1]
  if (!ending) return null

  const delta = ending.balance - startingBalance

  return (
    <Link
      href="/cash-flow"
      prefetch
      className="border-border-default bg-surface hover:bg-surface-hover/40 group flex flex-col gap-4 rounded-[12px] border p-5 transition-colors"
    >
      <header className="flex items-baseline justify-between gap-3">
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Cash flow · próximos 30 días
        </span>
        <span className="text-text-secondary group-hover:text-text text-[13px] transition-colors">
          Ver completo →
        </span>
      </header>

      <div className="flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-text-tertiary text-[11px]">Saldo en 30 días</span>
          <Amount
            value={String(ending.balance.toFixed(2))}
            currency={currency}
            kind={ending.balance < 0 ? 'negative' : 'neutral'}
            className="text-xl sm:text-2xl"
          />
          <span
            className={`font-mono text-[11px] tabular-nums ${
              delta >= 0 ? 'text-positive' : 'text-negative'
            }`}
          >
            {delta >= 0 ? '+' : ''}
            {Math.round(delta).toLocaleString('es-CO')} desde hoy
          </span>
        </div>
        <div className="h-16 w-1/2 max-w-[200px]">
          <ParentSize>
            {({ width, height }) => {
              if (width === 0 || height === 0) return null
              return <Sparkline points={visible} width={width} height={height} />
            }}
          </ParentSize>
        </div>
      </div>
    </Link>
  )
}

function Sparkline({
  points,
  width,
  height,
}: {
  points: CashFlowPoint[]
  width: number
  height: number
}) {
  const dates = points.map((p) => new Date(p.date + 'T12:00:00Z'))
  const balances = points.map((p) => p.balance)
  const hasBands = points.some((p) => p.lower !== undefined)

  const allValues = hasBands
    ? [
        ...balances,
        ...points.map((p) => p.lower ?? p.balance),
        ...points.map((p) => p.upper ?? p.balance),
      ]
    : balances
  const minB = Math.min(...allValues)
  const maxB = Math.max(...allValues)
  const pad = Math.max((maxB - minB) * 0.08, 1)

  const xScale = scaleTime({
    domain: [dates[0] ?? new Date(), dates[dates.length - 1] ?? new Date()],
    range: [0, width],
  })
  const yScale = scaleLinear({
    domain: [minB - pad, maxB + pad],
    range: [height, 0],
  })

  const isPositive = (balances[balances.length - 1] ?? 0) >= (balances[0] ?? 0)
  const stroke = isPositive ? 'var(--positive)' : 'var(--negative)'

  return (
    <svg width={width} height={height}>
      {hasBands && (
        <Area
          data={points}
          x={(_, i) => xScale(dates[i] ?? new Date())}
          y0={(p) => yScale(p.lower ?? p.balance)}
          y1={(p) => yScale(p.upper ?? p.balance)}
          curve={curveMonotoneX}
          fill={stroke}
          fillOpacity={0.08}
        />
      )}
      <LinePath
        data={points}
        x={(_, i) => xScale(dates[i] ?? new Date())}
        y={(p) => yScale(p.balance)}
        curve={curveMonotoneX}
        stroke={stroke}
        strokeWidth={1.25}
        strokeLinecap="round"
      />
    </svg>
  )
}
