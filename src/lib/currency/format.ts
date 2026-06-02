import { currencies, type CurrencyCode } from './currencies'

/**
 * Formatea un monto a string usando Intl.NumberFormat.
 *
 * Acepta el valor como string o number. Si viene como string (caso típico:
 * columna numeric(15,2) leída desde Postgres), se convierte una sola vez
 * preservando precisión razonable para display.
 *
 * Para math con dinero (sumas, restas) NO usar number — usar SQL aggregate
 * o Dinero.js. Esta función es solo para display.
 */
export type FormatMoneyOptions = {
  /** ISO currency. Default 'COP'. */
  currency?: CurrencyCode
  /** Locale BCP47. Default 'es-CO'. */
  locale?: string
  /** Si true, omite el símbolo. Útil cuando ya hay un sufijo "COP" aparte. */
  withoutSymbol?: boolean
  /** Forzar signo positivo explícito (+) cuando el monto > 0. */
  showPositiveSign?: boolean
  /** Compactar grandes números (1.2K, 3.4M). */
  compact?: boolean
}

export function formatMoney(value: string | number, options: FormatMoneyOptions = {}): string {
  const {
    currency = 'COP',
    locale = 'es-CO',
    withoutSymbol = false,
    showPositiveSign = false,
    compact = false,
  } = options

  const numeric = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(numeric)) return '—'

  const meta = currencies[currency]

  // En notación compacta NO usamos los decimales de la moneda (COP=0): eso
  // redondea 2.700.000 a "3 M" y se aleja de la realidad. Usamos 1 decimal
  // para que se lea "2,7 M". En notación estándar respetamos los decimales
  // de la moneda como siempre.
  const fractionDigits = compact
    ? { minimumFractionDigits: 0, maximumFractionDigits: 1 }
    : { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals }

  const intl = new Intl.NumberFormat(locale, {
    style: withoutSymbol ? 'decimal' : 'currency',
    currency,
    ...fractionDigits,
    signDisplay: showPositiveSign ? 'exceptZero' : 'auto',
    notation: compact ? 'compact' : 'standard',
  })

  return intl.format(numeric)
}

/**
 * Parsea un string ingresado por el usuario a un número.
 * Acepta: "1.234,56", "1,234.56", "1234.56", "1234,56".
 * Heurística: si hay coma y punto, el último separador define decimales.
 */
export function parseMoneyInput(input: string): number | null {
  const trimmed = input.trim()
  if (trimmed === '') return null

  const hasDot = trimmed.includes('.')
  const hasComma = trimmed.includes(',')

  let normalized = trimmed.replace(/[^\d.,-]/g, '')

  if (hasDot && hasComma) {
    const lastDot = normalized.lastIndexOf('.')
    const lastComma = normalized.lastIndexOf(',')
    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = normalized.replace(/,/g, '')
    }
  } else if (hasComma) {
    normalized = normalized.replace(',', '.')
  }

  const n = Number.parseFloat(normalized)
  return Number.isFinite(n) ? n : null
}
