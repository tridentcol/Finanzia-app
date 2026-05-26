/**
 * Normalización de filas CSV crudas a payload de transacción.
 * Tolerante a formatos LATAM: fechas DD/MM/YYYY, montos "1.234,56".
 */

import type { ColumnMapping } from './infer-columns'

export type ParsedRow = {
  date: string // YYYY-MM-DD
  description: string
  merchant: string | null
  amount: string // numeric positivo, ej "1234.56"
  kind: 'income' | 'expense'
}

export type ParseRowError = {
  row: number
  reason: string
  raw: Record<string, unknown>
}

const DATE_FORMATS = [
  /^(\d{4})-(\d{2})-(\d{2})$/, // ISO
  /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY (LATAM)
  /^(\d{2})-(\d{2})-(\d{4})$/, // DD-MM-YYYY
  /^(\d{4})\/(\d{2})\/(\d{2})$/, // YYYY/MM/DD
]

function normalizeDate(raw: string): string | null {
  const s = raw.trim().split(' ')[0] // descarta hora si la hay
  if (!s) return null

  // ISO
  const iso = DATE_FORMATS[0]!.exec(s)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // YYYY/MM/DD
  const ymd = DATE_FORMATS[3]!.exec(s)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`

  // DD/MM/YYYY o DD-MM-YYYY
  for (const fmt of [DATE_FORMATS[1]!, DATE_FORMATS[2]!]) {
    const m = fmt.exec(s)
    if (m) {
      const [, d, mo, y] = m
      return `${y}-${mo}-${d}`
    }
  }

  // Fallback: Date.parse
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10)
  }
  return null
}

function normalizeAmount(raw: string): { value: number; negative: boolean } | null {
  let s = raw.trim()
  if (!s) return null

  // Quitar símbolos comunes
  s = s.replace(/[^\d.,()\-+]/g, '')

  // Paréntesis = negativo en algunos bancos
  let negative = false
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true
    s = s.slice(1, -1)
  }
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }

  const hasDot = s.includes('.')
  const hasComma = s.includes(',')

  if (hasDot && hasComma) {
    const lastDot = s.lastIndexOf('.')
    const lastComma = s.lastIndexOf(',')
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (hasComma) {
    // Heurística: si hay un solo separador y tiene 1-2 dígitos después, es decimal.
    // Si tiene 3 dígitos después, es separador de miles.
    const parts = s.split(',')
    if (parts.length === 2 && parts[1]!.length <= 2) {
      s = s.replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  }

  const n = Number.parseFloat(s)
  if (!Number.isFinite(n)) return null
  return { value: Math.abs(n), negative: negative || n < 0 }
}

export function parseRow(
  raw: Record<string, unknown>,
  mapping: ColumnMapping,
  rowIndex: number,
): ParsedRow | ParseRowError {
  // Date
  if (!mapping.date) {
    return { row: rowIndex, reason: 'Mapping de fecha ausente', raw }
  }
  const rawDate = String(raw[mapping.date] ?? '').trim()
  const date = normalizeDate(rawDate)
  if (!date) {
    return { row: rowIndex, reason: `Fecha no reconocida: "${rawDate}"`, raw }
  }

  // Description
  if (!mapping.description) {
    return { row: rowIndex, reason: 'Mapping de descripción ausente', raw }
  }
  const description = String(raw[mapping.description] ?? '').trim()
  if (!description) {
    return { row: rowIndex, reason: 'Descripción vacía', raw }
  }

  // Amount: tres estrategias en orden
  let amountInfo: { value: number; negative: boolean } | null = null

  if (mapping.amountSigned) {
    const raw1 = String(raw[mapping.amountSigned] ?? '').trim()
    if (raw1) amountInfo = normalizeAmount(raw1)
  }

  if (!amountInfo && (mapping.amountIncome || mapping.amountExpense)) {
    const income = mapping.amountIncome
      ? normalizeAmount(String(raw[mapping.amountIncome] ?? ''))
      : null
    const expense = mapping.amountExpense
      ? normalizeAmount(String(raw[mapping.amountExpense] ?? ''))
      : null
    if (income && income.value > 0) {
      amountInfo = { value: income.value, negative: false }
    } else if (expense && expense.value > 0) {
      amountInfo = { value: expense.value, negative: true }
    }
  }

  if (!amountInfo || amountInfo.value === 0) {
    return { row: rowIndex, reason: 'Monto no encontrado o cero', raw }
  }

  // Merchant
  const merchant = mapping.merchant
    ? String(raw[mapping.merchant] ?? '').trim() || null
    : null

  return {
    date,
    description: description.slice(0, 200),
    merchant: merchant ? merchant.slice(0, 120) : null,
    amount: amountInfo.value.toFixed(2),
    kind: amountInfo.negative ? 'expense' : 'income',
  }
}
