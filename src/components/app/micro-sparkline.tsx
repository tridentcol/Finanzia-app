import { cn } from '@/lib/utils'

/**
 * Sparkline mínimo: una polilínea normalizada en un viewBox 100×100 que se
 * estira al contenedor (preserveAspectRatio="none"). SVG puro, sin Visx ni
 * cliente — se puede renderizar en server. Noir: una sola línea, color vía
 * `currentColor` (se controla con la clase del contenedor). Sin ejes, sin chrome.
 *
 * Pensado para los tiles del dashboard: muestra la FORMA de una serie, no cifras
 * (no filtra saldos bajo modo privacidad).
 */
export function MicroSparkline({
  values,
  className,
}: {
  values: number[]
  className?: string
}) {
  if (values.length < 2) return null

  const W = 100
  const H = 100
  const pad = 6
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const last = values.length - 1

  const points = values
    .map((v, i) => {
      const x = (i / last) * W
      const y = pad + (1 - (v - min) / range) * (H - pad * 2)
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden
      className={cn('block', className)}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
