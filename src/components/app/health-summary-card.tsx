import Link from 'next/link'

import { BAND_LABEL } from '@/lib/health/score'
import type { HealthBand, HealthScore } from '@/lib/health/types'
import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

/**
 * Resumen compacto de la salud financiera para el dashboard: score + banda +
 * el resumen de una línea, enlazando al detalle en /mi-historia/insights.
 * Tonos Noir mudos según la banda; Geist Mono tabular. Server Component.
 * Se omite si todavía no hay nada que evaluar (no ensucia el dashboard).
 */

const bandText: Record<HealthBand, string> = {
  solida: 'text-positive',
  estable: 'text-positive',
  atencion: 'text-warning',
  fragil: 'text-negative',
}

const ArrowRight = icons['arrow-right']

export function HealthSummaryCard({ health }: { health: HealthScore }) {
  if (health.score === null || health.band === null) return null

  return (
    <Link
      href="/mi-historia/insights"
      className="border-border-default bg-surface hover:bg-surface-hover/60 group flex items-center justify-between gap-4 rounded-[12px] border p-5 transition-colors"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Salud financiera
        </span>
        <div className="flex items-baseline gap-2.5">
          <span className={cn('tabular text-3xl leading-none font-semibold', bandText[health.band])}>
            {health.score}
          </span>
          <span className="text-text-tertiary tabular text-[13px]">/ 100</span>
          <span className={cn('text-[13px] font-medium', bandText[health.band])}>
            {BAND_LABEL[health.band]}
          </span>
        </div>
        <p className="text-text-tertiary line-clamp-1 text-[12px]">
          {health.summary}
        </p>
      </div>
      <ArrowRight
        strokeWidth={1.5}
        className="text-text-tertiary group-hover:text-text size-4 shrink-0 transition-colors"
      />
    </Link>
  )
}
