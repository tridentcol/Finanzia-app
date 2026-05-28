'use client'

import { useMemo } from 'react'
import { scaleLinear, scalePoint } from '@visx/scale'
import { LinePath, Area } from '@visx/shape'
import { Group } from '@visx/group'
import { curveMonotoneX } from '@visx/curve'
import { ParentSize } from '@visx/responsive'
import type { SavingsPeriodRow } from '@/lib/db/queries/savings'

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'] as const

function addMonths(baseYear: number, baseMonth: number, offset: number): string {
  const d = new Date(baseYear, baseMonth + offset, 1)
  return `${MONTH_LABELS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
}

type ForecastPoint = { label: string; value: number; lower: number; upper: number }

function buildForecast(periods: SavingsPeriodRow[], months = 12): ForecastPoint[] {
  // Use last 3 achieved for avg + stddev
  const recent = [...periods].reverse().slice(-3).map((p) => Number.parseFloat(p.achievedAmount))
  const avg = recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 0
  const variance =
    recent.length > 1
      ? recent.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / recent.length
      : 0
  const sigma = Math.sqrt(variance)

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth()

  let cumulative = 0
  const points: ForecastPoint[] = []
  for (let i = 1; i <= months; i++) {
    cumulative += avg
    points.push({
      label: addMonths(currentYear, currentMonth, i),
      value: cumulative,
      lower: cumulative - sigma * Math.sqrt(i),
      upper: cumulative + sigma * Math.sqrt(i),
    })
  }
  return points
}

const MARGIN = { top: 12, right: 8, bottom: 28, left: 8 }
const LINE_COLOR = '#7FB89F'
const BAND_COLOR = '#7FB89F'

type InnerProps = { width: number; height: number; points: ForecastPoint[] }

function ForecastInner({ width, height, points }: InnerProps) {
  const xMax = width - MARGIN.left - MARGIN.right
  const yMax = height - MARGIN.top - MARGIN.bottom

  const yMin = Math.min(...points.map((p) => p.lower), 0)
  const yMaxVal = Math.max(...points.map((p) => p.upper), 1)

  const xScale = useMemo(
    () => scalePoint({ domain: points.map((p) => p.label), range: [0, xMax], padding: 0.1 }),
    [points, xMax],
  )
  const yScale = useMemo(
    () => scaleLinear({ domain: [yMin, yMaxVal], range: [yMax, 0], nice: true }),
    [yMin, yMaxVal, yMax],
  )

  return (
    <svg width={width} height={height}>
      <Group top={MARGIN.top} left={MARGIN.left}>
        {/* ±1σ band */}
        <Area<ForecastPoint>
          data={points}
          x={(p) => xScale(p.label) ?? 0}
          y0={(p) => yScale(p.lower) ?? 0}
          y1={(p) => yScale(p.upper) ?? 0}
          curve={curveMonotoneX}
          fill={BAND_COLOR}
          fillOpacity={0.12}
        />

        {/* Main line */}
        <LinePath<ForecastPoint>
          data={points}
          x={(p) => xScale(p.label) ?? 0}
          y={(p) => yScale(p.value) ?? 0}
          curve={curveMonotoneX}
          stroke={LINE_COLOR}
          strokeWidth={1.5}
          strokeOpacity={0.9}
        />

        {/* Axis labels — every 3rd month */}
        {points
          .filter((_, i) => i % 3 === 2)
          .map((p) => {
            const x = xScale(p.label) ?? 0
            return (
              <text
                key={p.label}
                x={x}
                y={yMax + 16}
                textAnchor="middle"
                fontSize={10}
                fill="#6B6B72"
                fontFamily="var(--font-mono, monospace)"
              >
                {p.label}
              </text>
            )
          })}
      </Group>
    </svg>
  )
}

export function SavingsForecastChart({ periods }: { periods: SavingsPeriodRow[] }) {
  const points = useMemo(() => buildForecast(periods, 12), [periods])

  return (
    <div className="h-[120px] w-full">
      <ParentSize>
        {({ width }) => <ForecastInner width={width} height={120} points={points} />}
      </ParentSize>
    </div>
  )
}
