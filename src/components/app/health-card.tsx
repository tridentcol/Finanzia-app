import { BAND_LABEL } from '@/lib/health/score'
import type {
  HealthBand,
  HealthDimension,
  HealthScore,
  HealthStatus,
} from '@/lib/health/types'
import { cn } from '@/lib/utils'

/**
 * Card editorial de Salud Financiera Explicada. Score determinista (0..100)
 * con su banda y, debajo, cada dimensión como barra + lista con su "porqué".
 * No es presencia de IA → sin lavanda; tonos Noir mudos (sage/arena/arcilla)
 * según el estado. Números en Geist Mono tabular. Server Component.
 */

const statusTone: Record<HealthStatus, { text: string; bar: string }> = {
  good: { text: 'text-positive', bar: 'bg-positive' },
  watch: { text: 'text-warning', bar: 'bg-warning' },
  risk: { text: 'text-negative', bar: 'bg-negative' },
}

const bandStatus: Record<HealthBand, HealthStatus> = {
  solida: 'good',
  estable: 'good',
  atencion: 'watch',
  fragil: 'risk',
}

export function HealthCard({ health }: { health: HealthScore }) {
  if (health.score === null || health.band === null) {
    return (
      <section className="border-border-default bg-surface flex flex-col gap-2 rounded-[12px] border p-5 lg:p-6">
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Salud financiera
        </span>
        <p className="text-text-secondary max-w-prose text-[15px] leading-relaxed">
          {health.summary}
        </p>
      </section>
    )
  }

  const tone = statusTone[bandStatus[health.band]]

  return (
    <section className="border-border-default bg-surface flex flex-col gap-6 rounded-[12px] border p-5 lg:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Salud financiera
          </span>
          <div className="flex items-baseline gap-3">
            <span className={cn('tabular text-5xl leading-none font-semibold', tone.text)}>
              {health.score}
            </span>
            <span className="text-text-tertiary tabular text-sm">/ 100</span>
            <span className={cn('text-sm font-medium', tone.text)}>
              {BAND_LABEL[health.band]}
            </span>
          </div>
        </div>
      </header>

      <p className="text-text-secondary max-w-prose text-[15px] leading-relaxed">
        {health.summary}
      </p>

      <ul className="flex flex-col gap-4 border-t border-border-default/60 pt-5">
        {health.dimensions.map((d) => (
          <DimensionRow key={d.key} dimension={d} />
        ))}
      </ul>
    </section>
  )
}

function DimensionRow({ dimension: d }: { dimension: HealthDimension }) {
  const evaluated = d.available && d.score !== null
  const tone = evaluated && d.status !== 'na' ? statusTone[d.status] : null

  return (
    <li className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-text text-[13px] font-medium">{d.label}</span>
        <span
          className={cn(
            'tabular text-[13px]',
            tone ? tone.text : 'text-text-tertiary',
          )}
        >
          {evaluated ? d.score : '—'}
        </span>
      </div>

      {/* Barra: track sutil + relleno tintado por estado. Sin barra si no hay datos. */}
      <div className="bg-surface-elevated h-1 w-full overflow-hidden rounded-full">
        {evaluated && tone && (
          <div
            className={cn('h-full rounded-full', tone.bar)}
            style={{ width: `${Math.max(2, d.score as number)}%` }}
          />
        )}
      </div>

      <p className="text-text-tertiary text-[12px] leading-snug">{d.detail}</p>
    </li>
  )
}
