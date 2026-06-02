import Link from 'next/link'
import type { ReactNode } from 'react'

import { Amount } from '@/components/app/amount'
import { BAND_LABEL } from '@/lib/health/score'
import type { HealthBand, HealthScore } from '@/lib/health/types'
import { icons } from '@/lib/design/icons'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { cn } from '@/lib/utils'

const ArrowRight = icons['arrow-right']

const bandText: Record<HealthBand, string> = {
  solida: 'text-positive',
  estable: 'text-positive',
  atencion: 'text-warning',
  fragil: 'text-negative',
}

export type DashboardNextThing = {
  kind: 'debt' | 'recurring'
  title: string
  when: string
  amount?: string
  currency?: CurrencyCode
  href: string
}

/**
 * Tile compacto del dashboard: una cifra glanceable que enlaza a su sección
 * dedicada (ahí vive el detalle). Minimalista, Noir: la flecha aparece en hover.
 * Server Component.
 */
function Tile({
  label,
  href,
  children,
  hint,
}: {
  label: string
  href: string
  children: ReactNode
  hint?: ReactNode
}) {
  return (
    <Link
      href={href}
      prefetch
      className="border-border-default bg-surface hover:bg-surface-hover/60 group flex min-w-0 flex-col gap-2 rounded-[12px] border p-4 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-text-tertiary truncate text-[10px] uppercase tracking-[0.1em]">
          {label}
        </span>
        <ArrowRight
          strokeWidth={1.5}
          className="size-3.5 shrink-0 text-transparent transition-colors group-hover:text-text-tertiary"
        />
      </div>
      <div className="min-w-0">{children}</div>
      {hint && (
        <span className="text-text-tertiary truncate text-[11px]">{hint}</span>
      )}
    </Link>
  )
}

/**
 * Grilla de tiles del dashboard: 1 columna en pantallas muy angostas, 2
 * columnas desde ~380px (incluido mobile). Ordenados por relevancia inmediata:
 * salud, lo siguiente, flujo, deuda. Se omite el tile cuya info no aplica.
 */
export function DashboardTiles({
  health,
  nextThing,
  projectedBalance,
  debtTotal,
  baseCurrency,
}: {
  health: HealthScore
  nextThing: DashboardNextThing | null
  projectedBalance: number | null
  debtTotal: number | null
  baseCurrency: CurrencyCode
}) {
  const tiles: ReactNode[] = []

  if (health.score !== null && health.band !== null) {
    tiles.push(
      <Tile key="salud" label="Salud" href="/mi-historia/insights">
        <div className="flex items-baseline gap-2">
          <span className={cn('tabular text-2xl leading-none font-semibold', bandText[health.band])}>
            {health.score}
          </span>
          <span className={cn('text-[13px] font-medium', bandText[health.band])}>
            {BAND_LABEL[health.band]}
          </span>
        </div>
      </Tile>,
    )
  }

  if (nextThing) {
    tiles.push(
      <Tile
        key="next"
        label="Lo siguiente"
        href={nextThing.href}
        hint={`${nextThing.kind === 'debt' ? 'Próximo pago' : 'Próximo cargo'} · ${nextThing.when}`}
      >
        <span className="text-text block truncate text-base font-medium">
          {nextThing.title}
        </span>
      </Tile>,
    )
  }

  if (projectedBalance !== null) {
    tiles.push(
      <Tile key="flujo" label="Flujo 30 días" href="/mi-dinero/cash-flow" hint="saldo proyectado">
        <Amount
          value={projectedBalance.toFixed(2)}
          currency={baseCurrency}
          compact
          kind={projectedBalance < 0 ? 'negative' : 'neutral'}
          className="text-xl"
        />
      </Tile>,
    )
  }

  if (debtTotal !== null && debtTotal > 0) {
    tiles.push(
      <Tile key="deuda" label="Deuda" href="/mi-dinero/deudas" hint="total adeudado">
        <Amount
          value={debtTotal.toFixed(2)}
          currency={baseCurrency}
          compact
          className="text-xl"
        />
      </Tile>,
    )
  }

  if (tiles.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">{tiles}</div>
  )
}
