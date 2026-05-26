import 'server-only'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { convertAmount } from '@/lib/currency/rates'

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
  archived: boolean
  color: string | null
  icon: string | null
  createdAt: Date
  /** Saldo computado en la moneda original de la cuenta. */
  currentBalance: string
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
    archived: boolean
    color: string | null
    icon: string | null
    created_at: Date
    current_balance: string
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
      a.archived,
      a.color,
      a.icon,
      a.created_at,
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
    archived: r.archived,
    color: r.color,
    icon: r.icon,
    createdAt: r.created_at,
    currentBalance: r.current_balance,
  }))
}

/**
 * Saldo total agregado en la moneda base del usuario.
 *
 * Convierte el saldo de cada cuenta (en su moneda nativa) al baseCurrency
 * usando la última tasa disponible vía `convertAmount`. Esto es robusto frente
 * a multi-divisa siempre que el cron de exchange_rates haya corrido al menos
 * una vez. Si una cuenta queda sin tasa (provider caído o cron sin correr),
 * el helper cae a 1:1 y el total queda mock, pero no rompe.
 *
 * Para la fecha de conversión usamos `today` — el saldo es un snapshot
 * presente, no histórico.
 */
export async function getTotalBalanceInBase(
  userId: string,
  baseCurrency: string,
): Promise<{ total: string; partial: boolean }> {
  const list = await listAccountsWithBalance(userId)
  const today = new Date().toISOString().slice(0, 10)
  let total = 0
  let partial = false
  for (const acc of list) {
    if (acc.currency === baseCurrency) {
      total += Number.parseFloat(acc.currentBalance)
      continue
    }
    const conv = await convertAmount(acc.currentBalance, acc.currency, baseCurrency, today, {
      fallbackToOne: true,
    })
    if (conv.missing) partial = true
    total += Number.parseFloat(conv.amount)
  }
  return { total: total.toFixed(2), partial }
}
