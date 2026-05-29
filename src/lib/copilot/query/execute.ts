import 'server-only'

import { sql, type SQL } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import type { EngineContext } from '../intents/types'
import type { Query, QueryFilters, QueryMetric, QuerySubject } from './types'

export type QueryResultRow = { label: string; value: number; count: number }
export type QueryResult = {
  /** Escalar global (no-groupBy) o suma de filas (sum/count agrupado). */
  total: number
  rows: QueryResultRow[]
  /** Transacciones que matchearon. */
  count: number
}

/** Condiciones WHERE comunes a partir de período + sujeto + filtros. */
function buildWhere(
  ctx: EngineContext,
  query: Query,
  filters: QueryFilters,
  period: { from: string; to: string },
): SQL {
  const conds: SQL[] = [
    sql`t.user_id = ${ctx.userId}`,
    sql`t.deleted_at IS NULL`,
    sql`t.date >= ${period.from}`,
    sql`t.date <= ${period.to}`,
  ]
  if (query.subject === 'expense') conds.push(sql`t.kind = 'expense'`)
  else if (query.subject === 'income') conds.push(sql`t.kind = 'income'`)
  else conds.push(sql`t.kind IN ('income', 'expense')`)

  if (filters.categoryId) conds.push(sql`t.category_id = ${filters.categoryId}`)
  if (filters.merchantSlug) {
    conds.push(
      sql`LOWER(TRIM(COALESCE(NULLIF(t.merchant, ''), t.description))) = ${filters.merchantSlug}`,
    )
  }
  if (filters.accountId) conds.push(sql`t.account_id = ${filters.accountId}`)
  if (filters.minAmount !== undefined) conds.push(sql`t.amount_base::numeric >= ${filters.minAmount}`)
  if (filters.maxAmount !== undefined) conds.push(sql`t.amount_base::numeric <= ${filters.maxAmount}`)

  return sql.join(conds, sql` AND `)
}

/** Expresión de valor agregado. `net` siempre es suma con signo. */
function valueExpr(metric: QueryMetric, subject: QuerySubject): SQL {
  if (subject === 'net') {
    return sql`SUM(CASE WHEN t.kind = 'income' THEN t.amount_base ELSE -t.amount_base END)`
  }
  switch (metric) {
    case 'count':
      return sql`COUNT(*)`
    case 'avg':
      return sql`AVG(t.amount_base)`
    case 'max':
      return sql`MAX(t.amount_base)`
    case 'min':
      return sql`MIN(t.amount_base)`
    case 'sum':
    default:
      return sql`SUM(t.amount_base)`
  }
}

export type CompareResult = {
  a: { label: string; value: number }
  b: { label: string; value: number }
}

/** Corre el escalar de la consulta para un set de filtros + período dado. */
async function runScalar(
  query: Query,
  ctx: EngineContext,
  filters: QueryFilters,
  period: { from: string; to: string },
): Promise<number> {
  const where = buildWhere(ctx, query, filters, period)
  const value = valueExpr(query.metric, query.subject)
  const rows = await db.execute<{ value: string | null }>(sql`
    SELECT ${value}::text AS value FROM transactions t WHERE ${where}
  `)
  const raw = rows[0]?.value
  const v = raw ? Number.parseFloat(raw) : 0
  return Number.isFinite(v) ? v : 0
}

/** Ejecuta una comparación de dos lados (entidades o períodos). */
export async function executeCompare(query: Query, ctx: EngineContext): Promise<CompareResult> {
  const cmp = query.compare
  if (!cmp) return { a: { label: '', value: 0 }, b: { label: '', value: 0 } }
  if (cmp.by === 'period') {
    const [va, vb] = await Promise.all([
      runScalar(query, ctx, query.filters, cmp.a),
      runScalar(query, ctx, query.filters, cmp.b),
    ])
    return { a: { label: cmp.a.label, value: va }, b: { label: cmp.b.label, value: vb } }
  }
  const [va, vb] = await Promise.all([
    runScalar(query, ctx, { ...query.filters, ...cmp.a.filters }, query.period),
    runScalar(query, ctx, { ...query.filters, ...cmp.b.filters }, query.period),
  ])
  return { a: { label: cmp.a.label, value: va }, b: { label: cmp.b.label, value: vb } }
}

export async function executeQuery(query: Query, ctx: EngineContext): Promise<QueryResult> {
  const where = buildWhere(ctx, query, query.filters, query.period)
  const value = valueExpr(query.metric, query.subject)

  if (!query.groupBy) {
    const rows = await db.execute<{ value: string | null; count: number }>(sql`
      SELECT ${value}::text AS value, COUNT(*)::int AS count
      FROM transactions t
      WHERE ${where}
    `)
    const r = rows[0]
    const total = r?.value ? Number.parseFloat(r.value) : 0
    return { total: Number.isFinite(total) ? total : 0, rows: [], count: r?.count ?? 0 }
  }

  // Etiqueta + join según la dimensión.
  let labelExpr: SQL
  let from: SQL
  let groupExpr: SQL
  if (query.groupBy === 'category') {
    labelExpr = sql`COALESCE(c.name, 'Sin categoría')`
    from = sql`transactions t LEFT JOIN categories c ON c.id = t.category_id`
    groupExpr = labelExpr
  } else if (query.groupBy === 'merchant') {
    labelExpr = sql`MIN(TRIM(COALESCE(NULLIF(t.merchant, ''), t.description)))`
    from = sql`transactions t`
    groupExpr = sql`LOWER(TRIM(COALESCE(NULLIF(t.merchant, ''), t.description)))`
  } else if (query.groupBy === 'account') {
    labelExpr = sql`COALESCE(a.name, '—')`
    from = sql`transactions t LEFT JOIN accounts a ON a.id = t.account_id`
    groupExpr = labelExpr
  } else {
    // month
    labelExpr = sql`to_char(date_trunc('month', t.date::date), 'YYYY-MM')`
    from = sql`transactions t`
    groupExpr = sql`date_trunc('month', t.date::date)`
  }

  const dir = query.order?.dir === 'asc' ? sql`ASC` : sql`DESC`
  const limit = query.limit && query.limit > 0 ? query.limit : 12

  const rows = await db.execute<{ label: string; value: string | null; count: number }>(sql`
    SELECT ${labelExpr} AS label, ${value}::text AS value, COUNT(*)::int AS count
    FROM ${from}
    WHERE ${where}
    GROUP BY ${groupExpr}
    ORDER BY ${value} ${dir}
    LIMIT ${limit}
  `)

  const out: QueryResultRow[] = rows.map((r) => ({
    label: r.label,
    value: r.value ? Number.parseFloat(r.value) : 0,
    count: r.count,
  }))
  const aggregable = query.metric === 'sum' || query.metric === 'count'
  const total = aggregable ? out.reduce((acc, r) => acc + r.value, 0) : 0
  const matched = out.reduce((acc, r) => acc + r.count, 0)
  return { total, rows: out, count: matched }
}
