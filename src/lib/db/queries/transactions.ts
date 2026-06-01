import 'server-only'
import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { accounts, categories, transactions } from '@/lib/db/schema'
import { userDataTag } from '@/lib/cache/data'
import { listImportBatchesForUser } from '@/lib/db/queries/imports'
import type { CurrencyCode } from '@/lib/currency/currencies'

export type TransactionListItem = {
  id: string
  date: string
  description: string
  merchant: string | null
  notes: string | null
  kind: 'income' | 'expense' | 'transfer'
  amountOriginal: string
  currency: CurrencyCode
  amountBase: string
  account: { id: string; name: string }
  transferAccount: { id: string; name: string } | null
  category: { id: string; name: string; color: string | null; icon: string | null } | null
  aiCategorized: boolean
  aiConfidence: string | null
}

export type TransactionFilters = {
  kind?: 'income' | 'expense' | 'transfer'
  accountId?: string
  categoryId?: string
  /** Slug normalizado (lower, trimmed) — matchea contra LOWER(TRIM(merchant)) o
   *  LOWER(TRIM(description)) cuando merchant es NULL. */
  merchantSlug?: string
  /** Búsqueda libre — ILIKE substring case-insensitive sobre description o
   *  merchant. Para Cmd+K y filtros del usuario. */
  searchQuery?: string
  /** YYYY-MM-DD */
  from?: string
  /** YYYY-MM-DD */
  to?: string
  /** Monto mínimo en moneda original (amount_original). */
  minAmount?: string
  /** Monto máximo en moneda original (amount_original). */
  maxAmount?: string
  limit?: number
}

export async function listTransactionsForUser(
  userId: string,
  filters: TransactionFilters = {},
): Promise<TransactionListItem[]> {
  const limit = filters.limit ?? 50
  const transferAccounts = sql`xfer`.as('xfer')

  const conditions = [
    eq(transactions.userId, userId),
    isNull(transactions.deletedAt),
  ]
  if (filters.kind) conditions.push(eq(transactions.kind, filters.kind))
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId))
  if (filters.categoryId) conditions.push(eq(transactions.categoryId, filters.categoryId))
  if (filters.merchantSlug) {
    conditions.push(
      sql`LOWER(TRIM(COALESCE(NULLIF(${transactions.merchant}, ''), ${transactions.description}))) = ${filters.merchantSlug}`,
    )
  }
  if (filters.searchQuery) {
    const q = `%${filters.searchQuery.toLowerCase()}%`
    conditions.push(
      sql`(LOWER(${transactions.description}) LIKE ${q} OR LOWER(COALESCE(${transactions.merchant}, '')) LIKE ${q})`,
    )
  }
  if (filters.from) conditions.push(gte(transactions.date, filters.from))
  if (filters.to) conditions.push(lte(transactions.date, filters.to))
  if (filters.minAmount) {
    conditions.push(
      sql`${transactions.amountOriginal}::numeric >= ${filters.minAmount}::numeric`,
    )
  }
  if (filters.maxAmount) {
    conditions.push(
      sql`${transactions.amountOriginal}::numeric <= ${filters.maxAmount}::numeric`,
    )
  }

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      description: transactions.description,
      merchant: transactions.merchant,
      notes: transactions.notes,
      kind: transactions.kind,
      amountOriginal: transactions.amountOriginal,
      currency: transactions.currency,
      amountBase: transactions.amountBase,
      aiCategorized: transactions.aiCategorized,
      aiConfidence: transactions.aiConfidence,
      accountId: transactions.accountId,
      accountName: accounts.name,
      transferAccountId: transactions.transferAccountId,
      transferAccountName: sql<string | null>`${transferAccounts}.name`,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
    })
    .from(transactions)
    .leftJoin(accounts, eq(accounts.id, transactions.accountId))
    .leftJoin(
      sql`accounts ${transferAccounts}`,
      sql`${transferAccounts}.id = ${transactions.transferAccountId}`,
    )
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    description: r.description,
    merchant: r.merchant,
    notes: r.notes,
    kind: r.kind,
    amountOriginal: r.amountOriginal,
    currency: r.currency as CurrencyCode,
    amountBase: r.amountBase,
    account: { id: r.accountId, name: r.accountName ?? '—' },
    transferAccount: r.transferAccountId
      ? { id: r.transferAccountId, name: r.transferAccountName ?? '—' }
      : null,
    category: r.categoryId
      ? {
          id: r.categoryId,
          name: r.categoryName ?? '—',
          color: r.categoryColor,
          icon: r.categoryIcon,
        }
      : null,
    aiCategorized: r.aiCategorized,
    aiConfidence: r.aiConfidence,
  }))
}

/**
 * Categorías visibles para el usuario: sistema (user_id null) + propias.
 * Para uso en pickers de transacción.
 */
export async function listAvailableCategories(userId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      kind: categories.kind,
      parentId: categories.parentId,
      icon: categories.icon,
      color: categories.color,
    })
    .from(categories)
    .where(
      and(
        eq(categories.archived, false),
        sql`(${categories.userId} IS NULL OR ${categories.userId} = ${userId})`,
      ),
    )
    .orderBy(categories.kind, categories.sortOrder)
}

/**
 * Cuenta transacciones del usuario sin categoría (categoryId IS NULL) y kind
 * que sí admite categorización (income/expense). Sirve para mostrar el badge
 * "Categorizar N con IA" en el header de `/transacciones`.
 */
export async function countUnclassifiedTransactions(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.categoryId),
        isNull(transactions.deletedAt),
        sql`${transactions.kind} != 'transfer'`,
        eq(transactions.userCorrected, false),
      ),
    )
  return rows[0]?.count ?? 0
}

export async function listUserAccountsBasic(userId: string) {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      currency: accounts.currency,
      type: accounts.type,
    })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.archived, false)))
    .orderBy(accounts.createdAt)
}

async function loadMovimientosData(
  userId: string,
  filters: TransactionFilters,
  skipUnclassified: boolean,
) {
  const [list, available, unclassified, userAccounts, batches] = await Promise.all([
    listTransactionsForUser(userId, filters),
    listAvailableCategories(userId),
    skipUnclassified ? Promise.resolve(0) : countUnclassifiedTransactions(userId),
    listUserAccountsBasic(userId),
    listImportBatchesForUser(userId, 12),
  ])
  return { list, available, unclassified, userAccounts, batches }
}

/**
 * Datos de /mi-dinero/movimientos cacheados cross-request (unstable_cache). La
 * key serializa `filters` (los searchParams ya normalizados en la page) más
 * `skipUnclassified` — cada combinación de filtros tiene su propia entrada. El
 * tag coarse `data:${userId}` lo bustea cualquier Server Action que muta, así
 * que las entradas filtradas nunca quedan stale. `revalidate: 30` es backstop.
 */
export function getMovimientosData(
  userId: string,
  filters: TransactionFilters,
  skipUnclassified: boolean,
) {
  return unstable_cache(
    () => loadMovimientosData(userId, filters, skipUnclassified),
    [
      'movimientos-data',
      userId,
      JSON.stringify(filters),
      String(skipUnclassified),
    ],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
