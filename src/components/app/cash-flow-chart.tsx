'use client'

import { useMemo, useState } from 'react'
import { scaleLinear, scaleTime } from '@visx/scale'
import { LinePath, Area } from '@visx/shape'
import { curveMonotoneX } from '@visx/curve'
import { ParentSize } from '@visx/responsive'

import type { CashFlowPoint } from '@/lib/cash-flow/project'

const HORIZONS = [30, 60, 90] as const
type Horizon = (typeof HORIZONS)[number]

type Props = {
  points: CashFlowPoint[]
  currency: string
}

export function CashFlowChart({ points, currency }: Props) {
  const [horizon, setHorizon] = useState<Horizon>(30)

  const visible = useMemo(() => points.slice(0, horizon + 1), [points, horizon])

  return (
    <div className="flex flex-col gap-4">
      {/* Horizon selector */}
      <div className="flex items-center gap-1 self-start">
        {HORIZONS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => setHorizon(h)}
            className={`rounded-[6px] px-3 py-1.5 text-[12px] transition-colors ${
              horizon === h
                ? 'bg-surface-hover text-text'
                : 'text-text-secondary hover:text-text hover:bg-surface-hover/60'
            }`}
          >
            {h}d
          </button>
        ))}
      </div>

      <ParentSize>
        {({ width }) => {
          if (width === 0) return null
          return (
            <CashFlowInner
              points={visible}
              width={width}
              height={200}
              currency={currency}
            />
          )
        }}
      </ParentSize>
    </div>
  )
}

function CashFlowInner({
  points,
  width,
  height,
  currency,
}: {
  points: CashFlowPoint[]
  width: number
  height: number
  currency: string
}) {
  const marginTop = 8
  const marginBottom = 24
  const marginLeft = 0
  const marginRight = 0

  const innerWidth = width - marginLeft - marginRight
  const innerHeight = height - marginTop - marginBottom

  const dates = points.map((p) => new Date(p.date + 'T12:00:00Z'))
  const balances = points.map((p) => p.balance)

  const xScale = scaleTime({
    domain: [dates[0] ?? new Date(), dates[dates.length - 1] ?? new Date()],
    range: [0, innerWidth],
  })

  const minBalance = Math.min(...balances)
  const maxBalance = Math.max(...balances)
  const pad = Math.max((maxBalance - minBalance) * 0.1, 1)

  const yScale = scaleLinear({
    domain: [minBalance - pad, maxBalance + pad],
    range: [innerHeight, 0],
    nice: true,
  })

  const getX = (_: CashFlowPoint, i: number) => xScale(dates[i] ?? new Date())
  const getY = (p: CashFlowPoint) => yScale(p.balance)

  const isPositive = (points[points.length - 1]?.balance ?? 0) >= (points[0]?.balance ?? 0)
  const strokeColor = isPositive ? 'var(--positive)' : 'var(--negative)'
  const fillColor = isPositive ? 'var(--positive)' : 'var(--negative)'

  const zero = yScale(0)
  const clipToZero = zero >= 0 && zero <= innerHeight

  return (
    <svg width={width} height={height}>
      <g transform={`translate(${marginLeft},${marginTop})`}>
        {/* Área bajo la curva */}
        <Area
          data={points}
          x={getX}
          y0={() => (clipToZero ? zero : innerHeight)}
          y1={getY}
          curve={curveMonotoneX}
          fill={fillColor}
          fillOpacity={0.08}
        />

        {/* Línea */}
        <LinePath
          data={points}
          x={getX}
          y={getY}
          curve={curveMonotoneX}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
        />

        {/* Línea de cero */}
        {clipToZero && (
          <line
            x1={0}
            x2={innerWidth}
            y1={zero}
            y2={zero}
            stroke="var(--border-emphasis)"
            strokeWidth={1}
            strokeDasharray="2,4"
          />
        )}

        {/* Labels eje X */}
        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((i) => i >= 0 && i < points.length)
          .map((i) => {
            const pt = points[i]
            if (!pt) return null
            const d = dates[i]
            if (!d) return null
            return (
              <text
                key={i}
                x={xScale(d)}
                y={innerHeight + 16}
                textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
                fontSize={10}
                fill="var(--text-tertiary)"
              >
                {d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })}
              </text>
            )
          })}
      </g>
    </svg>
  )
}
