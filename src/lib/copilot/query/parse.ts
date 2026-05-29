import { normalize } from '../nlu/normalize'
import type { PeriodSlot, Slots } from '../intents/types'
import type {
  CompareSpec,
  Query,
  QueryFilters,
  QueryGroupBy,
  QueryMetric,
  QuerySubject,
} from './types'

/** Listas para resolver dos entidades en una comparación "X vs Y" (puro). */
export type ParseLists = {
  categories?: Array<{ id: string; name: string }>
  merchants?: Array<{ slug: string; name: string }>
}

function prevMonthOf(period: PeriodSlot): PeriodSlot {
  const from = new Date(`${period.from}T00:00:00Z`)
  const y = from.getUTCFullYear()
  const m = from.getUTCMonth() - 1
  const yy = m < 0 ? y - 1 : y
  const mm = (m + 12) % 12
  const start = new Date(Date.UTC(yy, mm, 1))
  const end = new Date(Date.UTC(yy, mm + 1, 0))
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
    label: 'el mes pasado',
    granularity: 'month',
  }
}

/** Resuelve un lado de "X vs Y" a un filtro (categoría o comercio). */
function matchSide(side: string, lists: ParseLists): { filters: QueryFilters; label: string } | null {
  const s = normalize(side)
  for (const c of lists.categories ?? []) {
    if (s.includes(normalize(c.name))) {
      return { filters: { categoryId: c.id, categoryName: c.name }, label: c.name }
    }
  }
  for (const m of lists.merchants ?? []) {
    if (normalize(m.slug).length >= 3 && s.includes(normalize(m.slug))) {
      return { filters: { merchantSlug: m.slug, merchantName: m.name }, label: m.name }
    }
  }
  return null
}

function detectCompare(n: string, period: PeriodSlot, lists?: ParseLists): CompareSpec | null {
  if (/\b(vs|versus|comparad[oa] con|contra|compara\w* con) (el )?mes (pasado|anterior)\b/.test(n)) {
    return { by: 'period', a: period, b: prevMonthOf(period) }
  }
  const sep = n.split(/\s+(?:vs|versus|contra)\s+/)
  if (sep.length === 2 && lists) {
    const a = matchSide(sep[0] as string, lists)
    const b = matchSide(sep[1] as string, lists)
    if (a && b) {
      const dimension = a.filters.categoryId && b.filters.categoryId ? 'category' : 'merchant'
      return { by: 'entities', dimension, a, b }
    }
  }
  return null
}

/**
 * Construye un `Query` desde el texto + los slots ya extraídos por el engine.
 * PURO (no toca DB; los slots de categoría/comercio/cuenta llegan resueltos;
 * `lists` opcional solo para resolver "X vs Y"). Devuelve null si la utterance
 * no tiene ninguna señal de consulta (para que el caller caiga al intent normal).
 */
export function parseQuery(
  text: string,
  slots: Slots,
  period: PeriodSlot,
  lists?: ParseLists,
): Query | null {
  const n = normalize(text)

  // --- Métrica ---
  let metric: QueryMetric = 'sum'
  let hasMetricWord = false
  if (/\b(cuant[oa]s|numero de|cantidad de|cuantas (transacciones|compras|veces))\b/.test(n)) {
    metric = 'count'
    hasMetricWord = true
  } else if (/\b(promedio|en promedio|media de)\b/.test(n)) {
    metric = 'avg'
    hasMetricWord = true
  } else if (/\b(maximo|mas alto)\b/.test(n)) {
    metric = 'max'
    hasMetricWord = true
  } else if (/\b(minimo|mas bajo)\b/.test(n)) {
    metric = 'min'
    hasMetricWord = true
  }

  // --- Sujeto ---
  let subject: QuerySubject = 'expense'
  if (/\b(ingres|gane|recib|me entro)/.test(n)) subject = 'income'
  else if (/\b(neto|flujo|cuanto me quedo|cuanto ahorre)/.test(n)) subject = 'net'

  // --- Agrupación ---
  let groupBy: QueryGroupBy | undefined
  if (/\bpor categoria/.test(n)) groupBy = 'category'
  else if (/\bpor (comercio|tienda|negocio)/.test(n)) groupBy = 'merchant'
  else if (/\bpor cuenta/.test(n)) groupBy = 'account'
  else if (/\b(por mes|mensual|cada mes|mes a mes)\b/.test(n)) groupBy = 'month'

  // --- Filtros desde slots ---
  const filters: QueryFilters = {}
  if (slots.category) {
    filters.categoryId = slots.category.id
    filters.categoryName = slots.category.name
  }
  if (slots.merchant) {
    filters.merchantSlug = slots.merchant.slug
    filters.merchantName = slots.merchant.name
  }
  if (slots.account) {
    filters.accountId = slots.account.id
    filters.accountName = slots.account.name
  }
  if (slots.ordering?.threshold) {
    if (slots.ordering.threshold.op === 'gt') filters.minAmount = slots.ordering.threshold.value
    else filters.maxAmount = slots.ordering.threshold.value
  }

  const hasFilter =
    filters.categoryId !== undefined ||
    filters.merchantSlug !== undefined ||
    filters.accountId !== undefined ||
    filters.minAmount !== undefined ||
    filters.maxAmount !== undefined

  const compare = detectCompare(n, period, lists)

  // Señal mínima: sin métrica explícita, ni agrupación, ni sujeto no-default, ni
  // filtro, ni comparación → no es consulta componible; cae al intent normal.
  if (!hasMetricWord && !groupBy && subject === 'expense' && !hasFilter && !compare) {
    return null
  }

  const query: Query = { metric, subject, groupBy, filters, period }
  if (compare) query.compare = compare

  if (slots.ordering) {
    query.order = {
      by: 'value',
      dir: slots.ordering.order,
    }
    if (slots.ordering.limit) query.limit = slots.ordering.limit
  }

  return query
}
