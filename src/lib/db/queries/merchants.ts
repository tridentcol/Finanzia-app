import 'server-only'
import { sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { userDataTag } from '@/lib/cache/data'

/**
 * Agrega gastos por "comercio". Como Finanzia no fuerza un campo `merchant`
 * estructurado en todas las transacciones, normalizamos `merchant` cuando
 * existe y caemos a `description` cuando no.
 *
 * El agrupamiento es case-insensitive y trim-aware. Suma `amount_base` para
 * que la comparación entre transacciones de distintas monedas sea válida.
 */

export type MerchantRow = {
  /** Versión legible (capitalize del primer match). */
  name: string
  /** Versión normalizada — útil como key de URL. */
  slug: string
  totalBase: string
  count: number
  lastSeen: string
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
  categoryIcon: string | null
}

type Row = {
  name: string
  slug: string
  total_base: string
  count: number
  last_seen: string
  category_id: string | null
  category_name: string | null
  category_color: string | null
  category_icon: string | null
}

export type MerchantsRange = {
  /** 'this-month' | 'this-year' */
  scope: 'this-month' | 'this-year'
  from: string
  to: string
  label: string
}

export function resolveRange(
  scope: MerchantsRange['scope'] = 'this-month',
): MerchantsRange {
  const today = new Date()
  const year = today.getUTCFullYear()
  const month = today.getUTCMonth()
  if (scope === 'this-year') {
    return {
      scope,
      from: `${year}-01-01`,
      to: `${year}-12-31`,
      label: String(year),
    }
  }
  // Default: este mes.
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 0))
  return {
    scope: 'this-month',
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString('es-CO', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }),
  }
}

export async function listMerchantsForUser(
  userId: string,
  range: MerchantsRange,
  options: { limit?: number } = {},
): Promise<MerchantRow[]> {
  const limit = options.limit ?? 40
  const rows = await db.execute<Row>(sql`
    WITH txs AS (
      SELECT
        t.id,
        TRIM(COALESCE(NULLIF(t.merchant, ''), t.description)) AS name_raw,
        LOWER(TRIM(COALESCE(NULLIF(t.merchant, ''), t.description))) AS slug_raw,
        t.amount_base::numeric AS amount_base,
        t.date::date AS date,
        t.category_id
      FROM transactions t
      WHERE t.user_id = ${userId}
        AND t.deleted_at IS NULL
        AND t.kind = 'expense'
        AND t.date >= ${range.from}
        AND t.date <= ${range.to}
        AND LENGTH(COALESCE(NULLIF(t.merchant, ''), t.description, '')) >= 2
    ),
    /* Categoría más usada por slug. */
    category_ranks AS (
      SELECT
        slug_raw,
        category_id,
        ROW_NUMBER() OVER (
          PARTITION BY slug_raw ORDER BY COUNT(*) DESC
        ) AS rk
      FROM txs
      WHERE category_id IS NOT NULL
      GROUP BY slug_raw, category_id
    ),
    grouped AS (
      SELECT
        slug_raw,
        MIN(name_raw) AS display_name,
        SUM(amount_base)::text AS total_base,
        COUNT(*)::int AS count,
        MAX(date)::text AS last_seen
      FROM txs
      GROUP BY slug_raw
    )
    SELECT
      g.display_name AS name,
      g.slug_raw AS slug,
      g.total_base,
      g.count,
      g.last_seen,
      c.id AS category_id,
      c.name AS category_name,
      c.color AS category_color,
      c.icon AS category_icon
    FROM grouped g
    LEFT JOIN category_ranks cr ON cr.slug_raw = g.slug_raw AND cr.rk = 1
    LEFT JOIN categories c ON c.id = cr.category_id
    ORDER BY g.total_base::numeric DESC
    LIMIT ${limit}
  `)

  return rows.map((r) => ({
    name: r.name,
    slug: r.slug,
    totalBase: Number.parseFloat(r.total_base).toFixed(2),
    count: r.count,
    lastSeen: r.last_seen,
    categoryId: r.category_id,
    categoryName: r.category_name,
    categoryColor: r.category_color,
    categoryIcon: r.category_icon,
  }))
}

/**
 * Datos de /mi-historia/comercios cacheados cross-request (unstable_cache). El
 * rango se resuelve desde `scope` con la fecha de hoy (este mes / este año),
 * por eso la key incluye scope y today; el tag coarse `data:${userId}` lo
 * bustea cualquier Server Action que muta. `revalidate: 30` es un backstop.
 */
export function getComerciosData(
  userId: string,
  scope: MerchantsRange['scope'],
  today: string,
) {
  return unstable_cache(
    () => listMerchantsForUser(userId, resolveRange(scope), { limit: 80 }),
    ['comercios-data', userId, scope, today],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
