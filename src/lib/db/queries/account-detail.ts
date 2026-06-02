import 'server-only'
import { sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { userDataTag } from '@/lib/cache/data'
import type { AccountListItem } from '@/lib/db/queries/accounts'
import {
  listAvailableCategories,
  listTransactionsForUser,
  listUserAccountsBasic,
} from '@/lib/db/queries/transactions'
import type { CurrencyCode } from '@/lib/currency/currencies'

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

/** Una cuenta por id con saldo computado y, si es tarjeta, su perfil de crédito. */
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

/**
 * Datos de /mi-dinero/cuentas/[id]: la cuenta, sus movimientos recientes y los
 * catálogos para el menú de acciones. Si la cuenta no existe o es una tarjeta
 * (la page redirige a /mi-dinero/tarjetas/[id]) se omiten las lecturas pesadas.
 * Cacheado cross-request; el tag coarse `data:${userId}` lo bustea cualquier
 * Server Action que muta. `revalidate: 30` es un backstop.
 */
export function getCuentaDetailData(userId: string, id: string) {
  return unstable_cache(
    async () => {
      const account = await getAccountById(userId, id)
      if (!account || account.type === 'credit_card') {
        return { account, recent: [], available: [], accountsBasic: [] }
      }
      const [recent, available, accountsBasic] = await Promise.all([
        listTransactionsForUser(userId, { accountId: id, limit: 25 }),
        listAvailableCategories(userId),
        listUserAccountsBasic(userId),
      ])
      return { account, recent, available, accountsBasic }
    },
    ['cuenta-detail', userId, id],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}

/**
 * Detalle de tarjeta para /mi-dinero/tarjetas/[id]: la cuenta `credit_card` con
 * su perfil. Cacheado cross-request; el tag coarse `data:${userId}` lo bustea
 * cualquier Server Action que muta. `revalidate: 30` es un backstop.
 */
export function getCardDetailData(userId: string, id: string) {
  return unstable_cache(
    () => getAccountById(userId, id),
    ['card-detail', userId, id],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
