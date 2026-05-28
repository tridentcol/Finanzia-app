'use client'

import { useMemo } from 'react'
import { scaleBand, scaleLinear } from '@visx/scale'
import { Bar } from '@visx/shape'
import { Group } from '@visx/group'
import { AxisBottom } from '@visx/axis'
import { ParentSize } from '@visx/responsive'
import type { SavingsPeriodRow } from '@/lib/db/queries/savings'

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

function formatPeriodLabel(periodEnd: string): string {
  // periodEnd = 'YYYY-MM-DD'
  const parts = periodEnd.split('-')
  const month = parts[1] ?? ''
  const year = parts[0]?.slice(2) ?? ''
  return `${MONTH_LABELS[month] ?? month} ${year}`
}

type BarChartInnerProps = {
  width: number
  height: number
  periods: SavingsPeriodRow[]
}

const MARGIN = { top: 12, right: 8, bottom: 32, left: 8 }
const POSITIVE_COLOR = '#7FB89F'
const NEGATIVE_COLOR = '#D4938A'
const NEUTRAL_COLOR = '#6B6B72'

function SavingsBarChartInner({ width, height, periods }: BarChartInnerProps) {
  const xMax = width - MARGIN.left - MARGIN.right
  const yMax = height - MARGIN.top - MARGIN.bottom

  // Show at most 12 months, oldest first for left-to-right reading
  const visible = [...periods].reverse().slice(-12)

  const maxAchieved = Math.max(...visible.map((p) => Math.abs(Number.parseFloat(p.achievedAmount))), 1)

  const xScale = useMemo(
    () =>
      scaleBand({
        domain: visible.map((p) => p.periodEnd),
        range: [0, xMax],
        padding: 0.25,
      }),
    [visible, xMax],
  )

  const yScale = useMemo(
    () => scaleLinear({ domain: [0, maxAchieved], range: [yMax, 0], nice: true }),
    [maxAchieved, yMax],
  )

  return (
    <svg width={width} height={height}>
      <Group top={MARGIN.top} left={MARGIN.left}>
        {visible.map((p) => {
          const achieved = Number.parseFloat(p.achievedAmount)
          const target = Number.parseFloat(p.targetAmount)
          const barHeight = Math.max(2, yMax - (yScale(Math.abs(achieved)) ?? 0))
          const barY = yMax - barHeight
          const barX = xScale(p.periodEnd) ?? 0
          const barWidth = xScale.bandwidth()

          const hasTarget = target > 0
          const metTarget = achieved >= target
          const fill = !hasTarget ? NEUTRAL_COLOR : metTarget ? POSITIVE_COLOR : NEGATIVE_COLOR

          return (
            <Bar
              key={p.periodEnd}
              x={barX}
              y={barY}
              width={barWidth}
              height={barHeight}
              rx={3}
              fill={fill}
              fillOpacity={0.85}
            />
          )
        })}

        <AxisBottom
          scale={xScale}
          top={yMax}
          tickFormat={formatPeriodLabel}
          stroke="transparent"
          tickStroke="transparent"
          tickLabelProps={{
            fill: '#6B6B72',
            fontSize: 10,
            fontFamily: 'var(--font-mono, monospace)',
            textAnchor: 'middle',
          }}
          hideTicks
        />
      </Group>
    </svg>
  )
}

export function SavingsBarChart({ periods }: { periods: SavingsPeriodRow[] }) {
  return (
    <div className="h-[140px] w-full">
      <ParentSize>
        {({ width }) => (
          <SavingsBarChartInner width={width} height={140} periods={periods} />
        )}
      </ParentSize>
    </div>
  )
}
