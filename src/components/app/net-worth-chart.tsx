'use client'

import { scaleLinear, scaleTime } from '@visx/scale'
import { LinePath, Area } from '@visx/shape'
import { curveMonotoneX } from '@visx/curve'
import { ParentSize } from '@visx/responsive'

export type NetWorthChartPoint = { date: string; net: number }

/**
 * Línea de patrimonio neto en el tiempo. Noir: una sola línea (verde si la
 * tendencia sube, arcilla si baja), área tenue debajo, línea de cero punteada.
 * Mide en el cliente (ParentSize); se carga diferido para sacar visx del bundle.
 */
export function NetWorthChart({ points }: { points: NetWorthChartPoint[] }) {
  return (
    <ParentSize>
      {({ width }) => {
        if (width === 0) return null
        return <NetWorthInner points={points} width={width} height={200} />
      }}
    </ParentSize>
  )
}

function NetWorthInner({
  points,
  width,
  height,
}: {
  points: NetWorthChartPoint[]
  width: number
  height: number
}) {
  const marginTop = 8
  const marginBottom = 24
  const innerWidth = width
  const innerHeight = height - marginTop - marginBottom

  const dates = points.map((p) => new Date(p.date + 'T12:00:00Z'))
  const values = points.map((p) => p.net)

  const xScale = scaleTime({
    domain: [dates[0] ?? new Date(), dates[dates.length - 1] ?? new Date()],
    range: [0, innerWidth],
  })
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max((max - min) * 0.12, 1)
  const yScale = scaleLinear({
    domain: [min - pad, max + pad],
    range: [innerHeight, 0],
    nice: true,
  })

  const getX = (_: NetWorthChartPoint, i: number) => xScale(dates[i] ?? new Date())
  const getY = (p: NetWorthChartPoint) => yScale(p.net)
  const getY0 = () => yScale(yScale.domain()[0] ?? 0)

  const rising = (values[values.length - 1] ?? 0) >= (values[0] ?? 0)
  const stroke = rising ? 'var(--positive)' : 'var(--negative)'

  const zero = yScale(0)
  const showZero = zero >= 0 && zero <= innerHeight

  return (
    <svg width={width} height={height}>
      <g transform={`translate(0,${marginTop})`}>
        <Area
          data={points}
          x={getX}
          y0={getY0}
          y1={getY}
          curve={curveMonotoneX}
          fill={stroke}
          fillOpacity={0.07}
        />
        <LinePath
          data={points}
          x={getX}
          y={getY}
          curve={curveMonotoneX}
          stroke={stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        {showZero && (
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
        {[0, Math.floor(points.length / 2), points.length - 1]
          .filter((i, idx, arr) => i >= 0 && i < points.length && arr.indexOf(i) === idx)
          .map((i) => {
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
                {d.toLocaleDateString('es-CO', {
                  month: 'short',
                  year: '2-digit',
                  timeZone: 'UTC',
                })}
              </text>
            )
          })}
      </g>
    </svg>
  )
}
