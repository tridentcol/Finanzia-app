import type { MoneySlot } from '../../intents/types'
import { normalize } from '../normalize'
import { parseMoneyInput } from '@/lib/currency/format'

/**
 * Extractor de montos en lenguaje natural ES. Puro. Reconoce:
 *  - sufijos "k"/"m": "500k" → 500_000, "1.5m" → 1_500_000.
 *  - palabras: "medio millon" → 500_000, "doscientos mil" → 200_000.
 *  - números planos: "200.000" / "200,000" → 200_000 (vía parseMoneyInput).
 *
 * Devuelve el primer monto reconocido o null.
 */

const UNITS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6,
  siete: 7, ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13,
  catorce: 14, quince: 15, veinte: 20, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700,
  ochocientos: 800, novecientos: 900,
}

export function extractMoney(input: string): MoneySlot | null {
  const n = normalize(input)

  // medio millón / un millón y medio
  if (/\bmedio millon\b/.test(n)) return { value: 500_000 }
  const millonWords = n.match(/\b(\w+) millones?\b/)
  if (millonWords) {
    const w = millonWords[1] as string
    const base = UNITS[w]
    if (base !== undefined) {
      const extra = /y medio/.test(n) ? 500_000 : 0
      return { value: base * 1_000_000 + extra }
    }
  }

  // "<palabra> mil" — doscientos mil, quinientos mil, cincuenta mil
  const milWords = n.match(/\b(\w+) mil\b/)
  if (milWords) {
    const w = milWords[1] as string
    const base = UNITS[w]
    if (base !== undefined) return { value: base * 1_000 }
  }

  // sufijos k / m sobre dígitos: 500k, 1.5m, 2,5m
  const suffix = n.match(/\b(\d+(?:[.,]\d+)?)\s*([km])\b/)
  if (suffix) {
    const num = Number.parseFloat((suffix[1] as string).replace(',', '.'))
    const mult = suffix[2] === 'm' ? 1_000_000 : 1_000
    if (Number.isFinite(num)) return { value: Math.round(num * mult) }
  }

  // número plano con separadores de miles/decimales
  const plain = n.match(/\b\d[\d.,]{2,}\b/)
  if (plain) {
    const parsed = parseMoneyInput(plain[0] as string)
    if (parsed !== null) return { value: parsed }
  }

  return null
}
