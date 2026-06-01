import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { debts, type Debt } from '@/lib/db/schema'
import { userDataTag } from '@/lib/cache/data'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { getRatesForPairs } from '@/lib/currency/rates'
import { convertMoney, fromCents, toCents } from '@/lib/currency/convert'

export type DebtListItem = Debt

/**
 * Lista deudas activas (no archivadas) ordenadas por próximo pago ascendente.
 * Las deudas sin `nextPaymentDate` van al final.
 */
export async function listDebts(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<DebtListItem[]> {
  const includeArchived = options.includeArchived ?? false
  const rows = await db.query.debts.findMany({
    where: includeArchived
      ? eq(debts.userId, userId)
      : and(eq(debts.userId, userId), eq(debts.archived, false)),
    orderBy: [asc(debts.nextPaymentDate), asc(debts.createdAt)],
  })
  return rows
}

export async function getDebtById(
  userId: string,
  debtId: string,
): Promise<DebtListItem | null> {
  const row = await db.query.debts.findFirst({
    where: and(eq(debts.id, debtId), eq(debts.userId, userId)),
  })
  return row ?? null
}

export type DebtsSummary = {
  /** Suma de saldos pendientes convertida a la moneda base del usuario. */
  totalBalanceInBase: string
  /** True si alguna conversión cayó a 1:1 por falta de tasa. */
  partial: boolean
  /** Conteo de deudas activas (no archivadas, status='active'). */
  activeCount: number
  /** Próximo pago en cualquier deuda (la fecha más cercana en el futuro). */
  nextPayment: {
    debtId: string
    debtName: string
    date: string
    amount: string | null
    currency: string
  } | null
}

/**
 * Resumen agregado de deudas para el widget de dashboard y header de /deudas.
 * Convierte saldos a baseCurrency con la última tasa disponible.
 */
export async function getDebtsSummary(
  userId: string,
  baseCurrency: CurrencyCode,
): Promise<DebtsSummary> {
  const list = await listDebts(userId)
  const today = new Date().toISOString().slice(0, 10)
  const active = list.filter((d) => d.status === 'active')
  const nonBase = active.filter((d) => d.currency !== baseCurrency)
  const rates =
    nonBase.length > 0
      ? await getRatesForPairs(
          nonBase.map((d) => ({ from: d.currency, to: baseCurrency })),
          today,
        )
      : new Map<string, string>()

  let total = 0n
  let partial = false
  for (const d of active) {
    if (d.currency === baseCurrency) {
      total += toCents(d.currentBalance)
      continue
    }
    const rate = rates.get(`${d.currency}->${baseCurrency}`)
    if (rate === undefined) {
      partial = true
      total += toCents(d.currentBalance)
      continue
    }
    total += toCents(convertMoney(d.currentBalance, rate))
  }

  // Próximo pago: la deuda activa con nextPaymentDate más temprana (>= hoy).
  const upcoming = list
    .filter((d) => d.status === 'active' && d.nextPaymentDate && d.nextPaymentDate >= today)
    .sort((a, b) => (a.nextPaymentDate! < b.nextPaymentDate! ? -1 : 1))[0]

  const nextPayment = upcoming
    ? {
        debtId: upcoming.id,
        debtName: upcoming.name,
        date: upcoming.nextPaymentDate!,
        amount: upcoming.installmentAmount,
        currency: upcoming.currency,
      }
    : null

  return {
    totalBalanceInBase: fromCents(total),
    partial,
    activeCount: list.filter((d) => d.status === 'active').length,
    nextPayment,
  }
}

/**
 * Lecturas crudas de /mi-dinero/deudas: las tarjetas (para el saldo adeudado
 * que suma al KPI hero), la lista de deudas formales y el resumen agregado.
 * Los derivados de tiempo (días hasta el próximo pago) viven en la page.
 */
async function loadDeudasData(userId: string, baseCurrency: CurrencyCode) {
  const [accountsList, debtsList, summary] = await Promise.all([
    listAccountsWithBalance(userId),
    listDebts(userId),
    getDebtsSummary(userId, baseCurrency),
  ])
  const creditCards = accountsList.filter((a) => a.type === 'credit_card')
  return { creditCards, debtsList, summary }
}

/**
 * Datos de /mi-dinero/deudas cacheados cross-request (unstable_cache). La key
 * incluye userId/baseCurrency/today (today porque el resumen depende de la
 * fecha: tasas del día y próximo pago >= hoy); el tag coarse `data:${userId}`
 * lo bustea cualquier Server Action que muta. `revalidate: 30` es backstop.
 */
export function getDeudasData(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
) {
  return unstable_cache(
    () => loadDeudasData(userId, baseCurrency),
    ['deudas-data', userId, baseCurrency, today],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
