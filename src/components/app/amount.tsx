import { cn } from '@/lib/utils'
import { formatMoney, type FormatMoneyOptions } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'

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
 * number, sin perder precisión razonable. Server component.
 *
 * El modo privacidad NO vive aquí: se enmascara por CSS (`[data-balances-hidden]
 * .amount`) dentro de un PrivacyProvider, así Amount sigue siendo server y la
 * funcionalidad escala a cualquier `.amount` sin tocar este componente.
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
