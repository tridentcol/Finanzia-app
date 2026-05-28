/**
 * Parser de alertas de movimiento de Bancolombia.
 *
 * Bancolombia envía dos formatos:
 *   1. "Bancolombia le informa Compra por $1.234.567,89 COP en MERCHANT CIUDAD."
 *   2. "Transferencia por $500.000,00 COP desde cta *1234."
 *
 * El parser extrae: kind, amount, currency, merchant/description, date (now si no hay).
 */

export type ParsedEmailTransaction = {
  kind: 'expense' | 'income' | 'transfer'
  amount: string
  currency: string
  description: string
  merchant: string | null
  date: string
}

type ParseResult =
  | { ok: true; data: ParsedEmailTransaction }
  | { ok: false; reason: string }

const AMOUNT_RE = /\$\s*([\d.,]+)\s*([A-Z]{3})/

/** Convierte "1.234.567,89" → "1234567.89" */
function parseColombianAmount(raw: string): string {
  // Eliminar puntos de miles, reemplazar coma decimal por punto
  return raw.replace(/\./g, '').replace(',', '.')
}

const PURCHASE_RE =
  /compra(?:\s+aprobada)?\s+por\s+\$([\d.,]+)\s*([A-Z]{3})\s+en\s+(.+?)(?:\s+ciudad|\s*\.)/i

const TRANSFER_RE = /transferencia\s+por\s+\$([\d.,]+)\s*([A-Z]{3})/i

const INCOME_RE = /(?:consignaci[oó]n|dep[oó]sito|abono|pago)\s+por\s+\$([\d.,]+)\s*([A-Z]{3})/i

export function parseBancolombiaEmail(subject: string, body: string): ParseResult {
  const text = `${subject} ${body}`.replace(/\s+/g, ' ')
  const today = new Date().toISOString().slice(0, 10)

  // Purchase / expense
  const purchase = PURCHASE_RE.exec(text)
  if (purchase) {
    const rawAmount = purchase[1] ?? ''
    const currency = purchase[2] ?? 'COP'
    const merchant = (purchase[3] ?? '').trim().replace(/\.$/, '')
    return {
      ok: true,
      data: {
        kind: 'expense',
        amount: parseColombianAmount(rawAmount),
        currency,
        description: `Compra en ${merchant}`,
        merchant,
        date: today,
      },
    }
  }

  // Income (consignación, depósito, abono)
  const income = INCOME_RE.exec(text)
  if (income) {
    const rawAmount = income[1] ?? ''
    const currency = income[2] ?? 'COP'
    return {
      ok: true,
      data: {
        kind: 'income',
        amount: parseColombianAmount(rawAmount),
        currency,
        description: 'Consignación Bancolombia',
        merchant: null,
        date: today,
      },
    }
  }

  // Transfer
  const transfer = TRANSFER_RE.exec(text)
  if (transfer) {
    const rawAmount = transfer[1] ?? ''
    const currency = transfer[2] ?? 'COP'
    return {
      ok: true,
      data: {
        kind: 'expense',
        amount: parseColombianAmount(rawAmount),
        currency,
        description: 'Transferencia Bancolombia',
        merchant: null,
        date: today,
      },
    }
  }

  // Fallback: try raw amount
  const fallback = AMOUNT_RE.exec(text)
  if (fallback) {
    return {
      ok: true,
      data: {
        kind: 'expense',
        amount: parseColombianAmount(fallback[1] ?? '0'),
        currency: fallback[2] ?? 'COP',
        description: subject.slice(0, 120),
        merchant: null,
        date: today,
      },
    }
  }

  return { ok: false, reason: 'No se reconoció el formato del email de Bancolombia.' }
}
