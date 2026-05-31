/**
 * Conversión de dinero con aritmética entera exacta — regla no negociable #4
 * (dinero nunca es float).
 *
 * El monto y la tasa llegan como strings decimales (columnas `numeric` leídas
 * desde Postgres: `amount` en escala 2, `rate` en escala 6). Multiplicamos en
 * BigInt y redondeamos a 2 decimales con half-even (banker's), igual que la
 * convención contable. El resultado es exacto y determinista a cualquier
 * magnitud válida — sin la deriva de `(parseFloat(a) * parseFloat(r))`.
 *
 * Módulo puro (sin `server-only`): se ejercita en tests de node.
 */

/** Parsea un decimal string a `{ value, scale }` donde real = value / 10^scale. */
function parseDecimal(s: string): { value: bigint; scale: number } {
  const trimmed = s.trim()
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Número inválido para conversión: "${s}"`)
  }
  const negative = trimmed.startsWith('-')
  const unsigned = negative ? trimmed.slice(1) : trimmed
  const [intPart = '', fracPart = ''] = unsigned.split('.')
  const scale = fracPart.length
  const digits = `${intPart}${fracPart}` || '0'
  const value = BigInt(digits)
  return { value: negative ? -value : value, scale }
}

/**
 * Divide `numer / denom` (con `denom > 0`) a entero, redondeo half-even.
 * Maneja el signo operando sobre el valor absoluto.
 */
function divHalfEven(numer: bigint, denom: bigint): bigint {
  const negative = numer < 0n
  const n = negative ? -numer : numer
  let q = n / denom
  const remainder = n % denom
  const twice = remainder * 2n
  // > 0.5 → sube; == 0.5 → sube solo si el cociente es impar (queda par).
  if (twice > denom || (twice === denom && q % 2n === 1n)) {
    q += 1n
  }
  return negative ? -q : q
}

/** Formatea un entero de centavos (escala 2) a string "x.xx". */
function formatScale2(cents: bigint): string {
  const negative = cents < 0n
  const abs = (negative ? -cents : cents).toString().padStart(3, '0')
  const intPart = abs.slice(0, -2)
  const fracPart = abs.slice(-2)
  return `${negative ? '-' : ''}${intPart}.${fracPart}`
}

/**
 * Convierte `amount` por `rate` y devuelve un string con exactamente 2
 * decimales (matchea `numeric(15,2)` de `amount_base`), redondeo half-even.
 *
 * @param amount  monto decimal (típicamente escala 2 de `numeric(15,2)`)
 * @param rate    tasa decimal (típicamente escala 6 de `numeric(15,6)`)
 */
export function convertMoney(amount: string, rate: string): string {
  const a = parseDecimal(amount)
  const r = parseDecimal(rate)
  const product = a.value * r.value
  const productScale = a.scale + r.scale

  if (productScale <= 2) {
    // El producto ya tiene 2 o menos decimales: escala hacia arriba sin perder.
    const cents = product * 10n ** BigInt(2 - productScale)
    return formatScale2(cents)
  }

  const denom = 10n ** BigInt(productScale - 2)
  return formatScale2(divHalfEven(product, denom))
}

/**
 * Parsea un monto decimal string a centavos (BigInt, escala 2). Para sumar
 * dinero de forma exacta sin float. Redondea half-even si el monto trae más
 * de 2 decimales (no debería en columnas `numeric(15,2)`).
 */
export function toCents(amount: string): bigint {
  const a = parseDecimal(amount)
  if (a.scale <= 2) return a.value * 10n ** BigInt(2 - a.scale)
  return divHalfEven(a.value, 10n ** BigInt(a.scale - 2))
}

/** Formatea centavos (BigInt, escala 2) a string "x.xx". */
export function fromCents(cents: bigint): string {
  return formatScale2(cents)
}
