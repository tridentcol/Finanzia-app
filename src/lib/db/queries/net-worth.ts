import 'server-only'
import { asc, eq, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { netWorthSnapshots } from '@/lib/db/schema'
import { userDataTag } from '@/lib/cache/data'
import { getCashFlowData } from '@/lib/db/queries/cash-flow'
import { reconstructNetSeries, type MonthFlow } from '@/lib/net-worth/series'
import type { CurrencyCode } from '@/lib/currency/currencies'

export type NetWorthPoint = {
  /** 'YYYY-MM-DD'. */
  date: string
  net: number
  /** Solo en snapshots con composición (cron/live); null en backfill. */
  assets: number | null
  debts: number | null
  source: 'cron' | 'backfill' | 'manual' | 'live'
}

export type NetWorthNow = { assets: number; debts: number; net: number }

/**
 * Patrimonio neto de HOY = activos (cuentas no-crédito en base) − pasivos
 * (deuda en tarjetas + préstamos/hipotecas). Reusa `getCashFlowData` (mismas
 * cifras que el hero de cash-flow). Análisis: usa float, no es dinero persistido.
 */
export async function computeNetWorthNow(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
): Promise<NetWorthNow> {
  const { creditCards, assetsBase, debtsSummary, ccRatesObj } = await getCashFlowData(
    userId,
    baseCurrency,
    today,
  )
  const ccRates = new Map(Object.entries(ccRatesObj))
  let ccDebt = 0
  for (const c of creditCards) {
    const balance = Number.parseFloat(c.currentBalance)
    if (balance >= 0) continue
    const used = -balance
    if (c.currency === baseCurrency) {
      ccDebt += used
      continue
    }
    const rate = ccRates.get(`${c.currency}->${baseCurrency}`)
    ccDebt += rate ? used * Number.parseFloat(rate) : used
  }

  const assets = Number.parseFloat(assetsBase)
  const formalDebts = Number.parseFloat(debtsSummary.totalBalanceInBase)
  const debts = ccDebt + formalDebts
  return { assets, debts, net: assets - debts }
}

/** Flujo neto (ingreso − gasto) por mes en base, últimos `monthsBack` meses. */
async function getMonthlyFlows(userId: string, monthsBack = 24): Promise<MonthFlow[]> {
  const rows = await db.execute<{ month: string; flow: number }>(sql`
    SELECT to_char(date_trunc('month', date::date), 'YYYY-MM') AS month,
      (COALESCE(SUM(CASE WHEN kind='income'  THEN amount_base ELSE 0 END), 0)
       - COALESCE(SUM(CASE WHEN kind='expense' THEN amount_base ELSE 0 END), 0))::float8 AS flow
    FROM transactions
    WHERE user_id = ${userId}
      AND deleted_at IS NULL
      AND kind IN ('income', 'expense')
      AND date >= (date_trunc('month', CURRENT_DATE) - (${monthsBack} || ' months')::interval)::date
    GROUP BY 1
    ORDER BY 1
  `)
  return rows.map((r) => ({ month: r.month, flow: Number(r.flow) }))
}

/**
 * Reconstruye y persiste el histórico de patrimonio neto a partir del ledger
 * (neto al cierre de cada mes pasado). Idempotente: no pisa snapshots ya
 * existentes (las del cron, con composición, ganan). Devuelve cuántos insertó.
 */
export async function backfillNetWorth(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
): Promise<{ inserted: number }> {
  const [now, flows] = await Promise.all([
    computeNetWorthNow(userId, baseCurrency, today),
    getMonthlyFlows(userId, 24),
  ])
  const points = reconstructNetSeries(now.net, today, flows)
  if (points.length === 0) return { inserted: 0 }

  const result = await db
    .insert(netWorthSnapshots)
    .values(
      points.map((p) => ({
        userId,
        date: p.date,
        net: p.net.toFixed(2),
        currency: baseCurrency,
        source: 'backfill' as const,
      })),
    )
    .onConflictDoNothing({ target: [netWorthSnapshots.userId, netWorthSnapshots.date] })
    .returning({ id: netWorthSnapshots.id })

  return { inserted: result.length }
}

/**
 * Captura el snapshot de HOY con composición completa (activos/deudas/neto).
 * Idempotente por (userId, date): re-correr actualiza. Lo usa el cron mensual.
 */
export async function captureNetWorthSnapshot(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
): Promise<void> {
  const now = await computeNetWorthNow(userId, baseCurrency, today)
  await db
    .insert(netWorthSnapshots)
    .values({
      userId,
      date: today,
      net: now.net.toFixed(2),
      assets: now.assets.toFixed(2),
      debts: now.debts.toFixed(2),
      currency: baseCurrency,
      source: 'cron',
    })
    .onConflictDoUpdate({
      target: [netWorthSnapshots.userId, netWorthSnapshots.date],
      set: {
        net: now.net.toFixed(2),
        assets: now.assets.toFixed(2),
        debts: now.debts.toFixed(2),
        source: 'cron',
      },
    })
}

function loadSnapshots(userId: string) {
  return unstable_cache(
    () =>
      db
        .select({
          date: netWorthSnapshots.date,
          net: netWorthSnapshots.net,
          assets: netWorthSnapshots.assets,
          debts: netWorthSnapshots.debts,
          source: netWorthSnapshots.source,
        })
        .from(netWorthSnapshots)
        .where(eq(netWorthSnapshots.userId, userId))
        .orderBy(asc(netWorthSnapshots.date)),
    ['net-worth-snapshots', userId],
    { tags: [userDataTag(userId)], revalidate: 300 },
  )()
}

/**
 * Serie de patrimonio neto para el chart: snapshots persistidos + el punto
 * VIVO de hoy (neto actual), que reemplaza cualquier snapshot del mismo día.
 * Así la tendencia siempre termina en el valor real de hoy.
 */
export async function getNetWorthSeries(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
): Promise<{ points: NetWorthPoint[]; now: NetWorthNow }> {
  const [stored, now] = await Promise.all([
    loadSnapshots(userId),
    computeNetWorthNow(userId, baseCurrency, today),
  ])

  const points: NetWorthPoint[] = stored
    .filter((s) => s.date !== today)
    .map((s) => ({
      date: s.date,
      net: Number.parseFloat(s.net),
      assets: s.assets !== null ? Number.parseFloat(s.assets) : null,
      debts: s.debts !== null ? Number.parseFloat(s.debts) : null,
      source: s.source,
    }))

  points.push({
    date: today,
    net: now.net,
    assets: now.assets,
    debts: now.debts,
    source: 'live',
  })

  return { points, now }
}
