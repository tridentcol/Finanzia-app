import 'server-only'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { getRatesForPairs } from '@/lib/currency/rates'

export type AccountDetail = AccountListItem & {
  creditCardProfile: {
    id: string
    allowsDirectedPayment: boolean
    interestRateMonthly: string | null
    paymentPolicy: 'total' | 'minimum' | 'partial'
    hasPromotionalTerms: boolean
    notes: string | null
  } | null
}

export async function getAccountById(
  userId: string,
  accountId: string,
): Promise<AccountDetail | null> {
  const rows = await db.execute<{
    id: string
    name: string
    type: AccountListItem['type']
    currency: string
    initial_balance: string
    credit_limit: string | null
    statement_day: number | null
    payment_day: number | null
    archived: boolean
    color: string | null
    icon: string | null
    created_at: Date
    current_balance: string
    bank_slug: string | null
    card_product_slug: string | null
    card_brand: string | null
    card_last_four: string | null
    card_holder_name: string | null
    ccp_id: string | null
    ccp_allows_directed: boolean | null
    ccp_interest_rate: string | null
    ccp_payment_policy: 'total' | 'minimum' | 'partial' | null
    ccp_has_promo: boolean | null
    ccp_notes: string | null
  }>(sql`
    WITH deltas AS (
      SELECT
        account_id,
        CASE
          WHEN kind = 'income' THEN amount_original
          WHEN kind = 'expense' THEN -amount_original
          WHEN kind = 'transfer' AND transfer_account_id IS NOT NULL THEN -amount_original
          WHEN kind = 'transfer' AND transfer_account_id IS NULL AND transfer_group_id IS NOT NULL THEN amount_original
          ELSE 0
        END AS delta,
        currency
      FROM transactions
      WHERE user_id = ${userId}
        AND deleted_at IS NULL

      UNION ALL

      SELECT
        transfer_account_id AS account_id,
        amount_original AS delta,
        currency
      FROM transactions
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
        AND kind = 'transfer'
        AND transfer_account_id IS NOT NULL
        AND transfer_group_id IS NULL
    )
    SELECT
      a.id,
      a.name,
      a.type,
      a.currency,
      a.initial_balance,
      a.credit_limit,
      a.statement_day,
      a.payment_day,
      a.archived,
      a.color,
      a.icon,
      a.created_at,
      a.bank_slug,
      a.card_product_slug,
      a.card_brand,
      a.card_last_four,
      a.card_holder_name,
      (a.initial_balance + COALESCE(SUM(d.delta) FILTER (WHERE d.currency = a.currency), 0))::text AS current_balance,
      ccp.id                       AS ccp_id,
      ccp.allows_directed_payment  AS ccp_allows_directed,
      ccp.interest_rate_monthly::text AS ccp_interest_rate,
      ccp.payment_policy           AS ccp_payment_policy,
      ccp.has_promotional_terms    AS ccp_has_promo,
      ccp.notes                    AS ccp_notes
    FROM accounts a
    LEFT JOIN deltas d ON d.account_id = a.id
    LEFT JOIN credit_card_profiles ccp ON ccp.account_id = a.id
    WHERE a.user_id = ${userId}
      AND a.id = ${accountId}::uuid
    GROUP BY a.id, ccp.id, ccp.allows_directed_payment, ccp.interest_rate_monthly,
             ccp.payment_policy, ccp.has_promotional_terms, ccp.notes
    LIMIT 1
  `)

  const r = rows[0]
  if (!r) return null

  return {
    id: r.id,
    name: r.name,
    type: r.type,
    currency: r.currency as CurrencyCode,
    initialBalance: r.initial_balance,
    creditLimit: r.credit_limit,
    statementDay: r.statement_day,
    paymentDay: r.payment_day,
    archived: r.archived,
    color: r.color,
    icon: r.icon,
    createdAt: r.created_at,
    currentBalance: r.current_balance,
    bankSlug: r.bank_slug,
    cardProductSlug: r.card_product_slug,
    cardBrand: r.card_brand,
    cardLastFour: r.card_last_four,
    cardHolderName: r.card_holder_name,
    creditCardProfile: r.ccp_id
      ? {
          id: r.ccp_id,
          allowsDirectedPayment: r.ccp_allows_directed ?? false,
          interestRateMonthly: r.ccp_interest_rate,
          paymentPolicy: r.ccp_payment_policy ?? 'total',
          hasPromotionalTerms: r.ccp_has_promo ?? false,
          notes: r.ccp_notes,
        }
      : null,
  }
}

export type AccountListItem = {
  id: string
  name: string
  type:
    | 'checking'
    | 'savings'
    | 'credit_card'
    | 'cash'
    | 'investment'
    | 'crypto'
    | 'other'
  currency: CurrencyCode
  initialBalance: string
  creditLimit: string | null
  statementDay: number | null
  paymentDay: number | null
  archived: boolean
  color: string | null
  icon: string | null
  createdAt: Date
  /** Saldo computado en la moneda original de la cuenta. */
  currentBalance: string
  /** Identidad visual de la tarjeta (todo opcional). */
  bankSlug: string | null
  cardProductSlug: string | null
  cardBrand: string | null
  cardLastFour: string | null
  cardHolderName: string | null
}

/**
 * Lista cuentas del usuario con saldo computado a partir de las transacciones.
 *
 * Reglas de cómputo (siempre sobre amount_original; el filtro
 * `currency = a.currency` ignora deltas en moneda distinta a la cuenta):
 *  - income → suma.
 *  - expense → resta.
 *  - transfer same-currency (transfer_account_id ≠ null, transfer_group_id IS NULL)
 *    → resta de account_id, suma en transfer_account_id (fila única).
 *  - transfer cross-currency (transfer_group_id ≠ null) → dos filas espejo;
 *    la origen tiene transfer_account_id seteado (resta), la destino lo deja
 *    null (suma). Cada fila aporta su propia moneda a su propio account_id.
 *
 * Las transacciones con deleted_at NOT NULL se excluyen.
 */
export async function listAccountsWithBalance(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<AccountListItem[]> {
  const includeArchived = options.includeArchived ?? false

  const rows = await db.execute<{
    id: string
    name: string
    type: AccountListItem['type']
    currency: string
    initial_balance: string
    credit_limit: string | null
    statement_day: number | null
    payment_day: number | null
    archived: boolean
    color: string | null
    icon: string | null
    created_at: Date
    current_balance: string
    bank_slug: string | null
    card_product_slug: string | null
    card_brand: string | null
    card_last_four: string | null
    card_holder_name: string | null
  }>(sql`
    WITH deltas AS (
      SELECT
        account_id,
        CASE
          WHEN kind = 'income' THEN amount_original
          WHEN kind = 'expense' THEN -amount_original
          WHEN kind = 'transfer' AND transfer_account_id IS NOT NULL THEN -amount_original
          WHEN kind = 'transfer' AND transfer_account_id IS NULL AND transfer_group_id IS NOT NULL THEN amount_original
          ELSE 0
        END AS delta,
        currency
      FROM transactions
      WHERE user_id = ${userId}
        AND deleted_at IS NULL

      UNION ALL

      SELECT
        transfer_account_id AS account_id,
        amount_original AS delta,
        currency
      FROM transactions
      WHERE user_id = ${userId}
        AND deleted_at IS NULL
        AND kind = 'transfer'
        AND transfer_account_id IS NOT NULL
        AND transfer_group_id IS NULL
    )
    SELECT
      a.id,
      a.name,
      a.type,
      a.currency,
      a.initial_balance,
      a.credit_limit,
      a.statement_day,
      a.payment_day,
      a.archived,
      a.color,
      a.icon,
      a.created_at,
      a.bank_slug,
      a.card_product_slug,
      a.card_brand,
      a.card_last_four,
      a.card_holder_name,
      (a.initial_balance + COALESCE(SUM(d.delta) FILTER (WHERE d.currency = a.currency), 0))::text AS current_balance
    FROM accounts a
    LEFT JOIN deltas d ON d.account_id = a.id
    WHERE a.user_id = ${userId}
      ${includeArchived ? sql`` : sql`AND a.archived = false`}
    GROUP BY a.id
    ORDER BY a.archived ASC, a.created_at DESC
  `)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    currency: r.currency as CurrencyCode,
    initialBalance: r.initial_balance,
    creditLimit: r.credit_limit,
    statementDay: r.statement_day,
    paymentDay: r.payment_day,
    archived: r.archived,
    color: r.color,
    icon: r.icon,
    createdAt: r.created_at,
    currentBalance: r.current_balance,
    bankSlug: r.bank_slug,
    cardProductSlug: r.card_product_slug,
    cardBrand: r.card_brand,
    cardLastFour: r.card_last_four,
    cardHolderName: r.card_holder_name,
  }))
}

/**
 * Saldo total agregado en la moneda base del usuario.
 *
 * Convierte el saldo de cada cuenta (en su moneda nativa) al baseCurrency
 * usando la última tasa disponible. Robusto frente a multi-divisa siempre que
 * el cron de exchange_rates haya corrido al menos una vez. Si una cuenta
 * queda sin tasa (provider caído o cron sin correr), cae a 1:1 y el total
 * queda mock, pero no rompe.
 *
 * `preloadedAccounts` evita la query duplicada cuando el caller (dashboard)
 * ya tiene `listAccountsWithBalance` en su Promise.all. Si no se pasa, se
 * fetchea internamente.
 *
 * Para la fecha de conversión usamos `today` — el saldo es un snapshot
 * presente, no histórico.
 */
export async function getTotalBalanceInBase(
  userId: string,
  baseCurrency: string,
  preloadedAccounts?: AccountListItem[],
): Promise<{ total: string; partial: boolean }> {
  const list = preloadedAccounts ?? (await listAccountsWithBalance(userId))
  const today = new Date().toISOString().slice(0, 10)
  const nonBase = list.filter((a) => a.currency !== baseCurrency)
  const rates =
    nonBase.length > 0
      ? await getRatesForPairs(
          nonBase.map((a) => ({ from: a.currency, to: baseCurrency })),
          today,
        )
      : new Map<string, string>()

  let total = 0
  let partial = false
  for (const acc of list) {
    if (acc.currency === baseCurrency) {
      total += Number.parseFloat(acc.currentBalance)
      continue
    }
    const rate = rates.get(`${acc.currency}->${baseCurrency}`)
    if (rate === undefined) {
      partial = true
      total += Number.parseFloat(acc.currentBalance)
      continue
    }
    total += Number.parseFloat(acc.currentBalance) * Number.parseFloat(rate)
  }
  return { total: total.toFixed(2), partial }
}
