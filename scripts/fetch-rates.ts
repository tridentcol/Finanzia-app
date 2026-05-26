/**
 * Fetch + backfill manual de tasas de cambio.
 *
 * Llama al provider (open.er-api.com) y upserta las tasas del día en
 * `exchange_rates`. Después recorre las transactions del usuario cuyo
 * `amount_base` fue insertado con tasa 1:1 mock (currency != baseCurrency y
 * exchange_rate IN ('1.000000', NULL)) y las recalcula contra la tasa más
 * cercana disponible.
 *
 * Es idempotente: re-ejecutar sin cambios externos no muta nada.
 *
 * Uso: pnpm tsx --env-file=.env.local scripts/fetch-rates.ts
 */

import 'dotenv/config'
import { and, eq, isNull, ne, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  exchangeRates,
  profiles,
  transactions,
  users,
} from '../src/lib/db/schema'
import { currencyCodes } from '../src/lib/currency/currencies'

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.')
  process.exit(1)
}

const sqlClient = postgres(url, { prepare: false, max: 1 })
const db = drizzle(sqlClient, { casing: 'snake_case' })

const ENDPOINT = 'https://open.er-api.com/v6/latest'
const PROVIDER = 'open.er-api.com'

async function fetchAndUpsert(date: string): Promise<number> {
  const resp = await fetch(`${ENDPOINT}/USD`)
  if (!resp.ok) {
    throw new Error(`Provider HTTP ${resp.status}`)
  }
  const payload = (await resp.json()) as {
    result: string
    rates: Record<string, number>
    'error-type'?: string
  }
  if (payload.result !== 'success') {
    throw new Error(`Provider error: ${payload['error-type'] ?? 'unknown'}`)
  }
  const usdRates: Record<string, number> = { USD: 1 }
  for (const code of currencyCodes) {
    if (code === 'USD') continue
    const r = payload.rates[code]
    if (typeof r !== 'number' || r <= 0) {
      throw new Error(`Tasa ausente para ${code}`)
    }
    usdRates[code] = r
  }
  const rows: Array<{
    date: string
    fromCurrency: string
    toCurrency: string
    rate: string
    source: string
  }> = []
  for (const from of currencyCodes) {
    for (const to of currencyCodes) {
      if (from === to) continue
      const rate = (usdRates[to]! / usdRates[from]!).toFixed(6)
      rows.push({ date, fromCurrency: from, toCurrency: to, rate, source: PROVIDER })
    }
  }
  await db
    .insert(exchangeRates)
    .values(rows)
    .onConflictDoUpdate({
      target: [exchangeRates.date, exchangeRates.fromCurrency, exchangeRates.toCurrency],
      set: {
        rate: sql`excluded.rate`,
        source: sql`excluded.source`,
        fetchedAt: sql`now()`,
      },
    })
  return rows.length
}

async function getRate(from: string, to: string, date: string): Promise<string | null> {
  if (from === to) return '1.000000'
  const rows = await db
    .select({ rate: exchangeRates.rate, date: exchangeRates.date })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.fromCurrency, from),
        eq(exchangeRates.toCurrency, to),
        sql`${exchangeRates.date} <= ${date}`,
      ),
    )
    .orderBy(sql`${exchangeRates.date} DESC`)
    .limit(1)
  return rows[0]?.rate ?? null
}

async function recalcMockedTransactions(): Promise<number> {
  const allUsers = await db.select({ id: users.id }).from(users)
  let updated = 0
  for (const u of allUsers) {
    const profileRows = await db
      .select({ baseCurrency: profiles.baseCurrency })
      .from(profiles)
      .where(eq(profiles.userId, u.id))
      .limit(1)
    const baseCurrency = profileRows[0]?.baseCurrency ?? 'COP'

    const candidates = await db
      .select({
        id: transactions.id,
        date: transactions.date,
        currency: transactions.currency,
        amountOriginal: transactions.amountOriginal,
        exchangeRate: transactions.exchangeRate,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, u.id),
          ne(transactions.currency, baseCurrency),
          or(eq(transactions.exchangeRate, '1.000000'), isNull(transactions.exchangeRate)),
        ),
      )

    for (const tx of candidates) {
      const rate = await getRate(tx.currency, baseCurrency, tx.date)
      if (!rate || rate === '1.000000') continue
      const newBase = (Number.parseFloat(tx.amountOriginal) * Number.parseFloat(rate)).toFixed(
        2,
      )
      await db
        .update(transactions)
        .set({ amountBase: newBase, exchangeRate: rate })
        .where(eq(transactions.id, tx.id))
      updated++
    }
  }
  return updated
}

async function main() {
  const today = new Date().toISOString().slice(0, 10)
  console.log(`Fetching rates para ${today}...`)
  const upserted = await fetchAndUpsert(today)
  console.log(`  upserted ${upserted} pairs`)
  console.log('Recalculando transacciones con tasa mock...')
  const fixed = await recalcMockedTransactions()
  console.log(`  recalculadas ${fixed} transactions`)
  await sqlClient.end()
}

main().catch(async (err) => {
  console.error(err)
  await sqlClient.end()
  process.exit(1)
})
