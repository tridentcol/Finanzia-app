'use client'

import { cn } from '@/lib/utils'
import { formatMoney, type FormatMoneyOptions } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { usePrivacy } from './privacy'

type AmountKind = 'neutral' | 'positive' | 'negative'

type AmountProps = {
  value: string | number
  currency: CurrencyCode
  /** Color por tipo de movimiento. `neutral` mantiene el text por default. */
  kind?: AmountKind
  /** Forzar signo positivo cuando el monto > 0. */
  showPositiveSign?: boolean
  /** Formato compacto: 1.2K, 3.4M. */
  compact?: boolean
  /** Modo display gigante (clase `.display`). */
  display?: boolean
  /** Mostrar el código ISO al lado en text-tertiary. */
  withCode?: boolean
  className?: string
  /** Locale override. Default 'es-CO'. */
  locale?: string
}

/**
 * Componente canónico para representar dinero. Siempre Geist Mono tabular
 * (regla 10 del mandato). Acepta string (caso típico Postgres numeric) o
 * number, sin perder precisión razonable.
 *
 * Es client porque respeta el modo privacidad (`usePrivacy`). Fuera de un
 * `PrivacyProvider` el contexto es `hidden:false`, así que se comporta igual que
 * antes; la única superficie con proveedor hoy es el dashboard.
 */
export function Amount({
  value,
  currency,
  kind = 'neutral',
  showPositiveSign,
  compact,
  display,
  withCode = false,
  locale,
  className,
}: AmountProps) {
  const { hidden } = usePrivacy()

  // Modo privacidad (sólo dentro de un PrivacyProvider, p.ej. el dashboard):
  // máscara de longitud fija — no filtra la magnitud del saldo. Conserva la
  // tipografía mono y el tamaño (display/className) para no romper el layout.
  if (hidden) {
    return (
      <span
        role="img"
        aria-label="Saldo oculto"
        className={cn('amount text-text-secondary select-none', display && 'display', className)}
      >
        <span aria-hidden="true">•••••</span>
      </span>
    )
  }

  const options: FormatMoneyOptions = {
    currency,
    showPositiveSign,
    compact,
    locale,
  }
  const formatted = formatMoney(value, options)

  return (
    <span
      className={cn(
        'amount',
        display && 'display',
        kind === 'positive' && 'text-positive',
        kind === 'negative' && 'text-negative',
        className,
      )}
      data-amount-kind={kind}
    >
      {formatted}
      {withCode && (
        <span className="text-text-tertiary ml-1.5 text-[0.7em] tracking-wider">
          {currency}
        </span>
      )}
    </span>
  )
}
