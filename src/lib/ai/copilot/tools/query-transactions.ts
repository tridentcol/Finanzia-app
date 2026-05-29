import { tool } from 'ai'
import { z } from 'zod'

import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { normalize } from '@/lib/copilot/nlu/normalize'
import {
  listAvailableCategories,
  listUserAccountsBasic,
} from '@/lib/db/queries/transactions'
import { executeCompare, executeQuery } from '@/lib/copilot/query/execute'
import type { Query, QueryFilters } from '@/lib/copilot/query/types'
import type { EngineContext, PeriodSlot } from '@/lib/copilot/intents/types'
import type { CopilotContext } from '../context'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function inclusiveDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`).getTime()
  const b = new Date(`${to}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000) + 1
}

/** Match de nombre→entidad: igualdad normalizada, luego inclusión (>=3 chars). */
function matchByName<T extends { name: string }>(
  input: string,
  list: T[],
): T | undefined {
  const n = normalize(input)
  const exact = list.find((x) => normalize(x.name) === n)
  if (exact) return exact
  return list.find((x) => {
    const xn = normalize(x.name)
    return xn.length >= 3 && (n.includes(xn) || xn.includes(n))
  })
}

/**
 * Tool genérico de consulta agregada. El LLM arma una consulta componible
 * (métrica × sujeto × agrupación × filtros × período) y nosotros la ejecutamos
 * contra Postgres: cero alucinación de cifras. Es la herramienta preferida para
 * cualquier "cuánto / cuántas / promedio / por categoría / X vs Y / vs período
 * anterior". Read-only, scopeado por userId.
 */
export function queryTransactionsTool(ctx: CopilotContext) {
  return tool({
    description:
      'Consulta agregada y EXACTA sobre las transacciones (las cifras las calcula la base de datos, no las inventes). Combina: metric (sum/count/avg/max/min), subject (expense/income/net), groupBy (category/merchant/account/month), filtros (category/account/merchant/montos) y un período. Úsalo para "cuánto gasté en X", "cuántas compras", "gasto por categoría", "mercado vs restaurantes" (dos consultas) o comparar contra el período anterior (comparePrevious). Para búsqueda difusa por texto usa searchTransactions; para montos formateados ya vienen en *Formatted.',
    inputSchema: z.object({
      metric: z.enum(['sum', 'count', 'avg', 'max', 'min']).optional(),
      subject: z.enum(['expense', 'income', 'net']).optional(),
      groupBy: z.enum(['category', 'merchant', 'account', 'month']).optional(),
      period: z
        .object({
          from: z.string().regex(ISO_DATE),
          to: z.string().regex(ISO_DATE),
          label: z.string().max(40).optional(),
        })
        .describe('Rango inclusivo del análisis (YYYY-MM-DD).'),
      category: z.string().max(60).optional().describe('Nombre de categoría a filtrar.'),
      account: z.string().max(60).optional().describe('Nombre de cuenta a filtrar.'),
      merchant: z
        .string()
        .max(60)
        .optional()
        .describe('Nombre exacto de comercio (match normalizado, no difuso).'),
      minAmount: z.number().nonnegative().optional(),
      maxAmount: z.number().nonnegative().optional(),
      order: z.enum(['asc', 'desc']).optional(),
      limit: z.number().int().min(1).max(50).optional(),
      comparePrevious: z
        .boolean()
        .optional()
        .describe('Compara contra el período anterior de igual longitud.'),
    }),
    execute: async (input) => {
      const baseCurrency = ctx.baseCurrency as CurrencyCode
      const engineCtx: EngineContext = {
        userId: ctx.userId,
        baseCurrency: ctx.baseCurrency,
        todayIso: new Date().toISOString().slice(0, 10),
      }
      const metric = input.metric ?? 'sum'
      const subject = input.subject ?? 'expense'
      const fmt = (v: number) =>
        metric === 'count'
          ? String(Math.round(v))
          : formatMoney(Math.round(v), { currency: baseCurrency })

      // --- Resolver filtros por nombre → id (best-effort). ---
      const filters: QueryFilters = {}
      const unresolved: string[] = []
      const applied: Record<string, string | number> = {}

      if (input.category) {
        const cats = await listAvailableCategories(ctx.userId)
        const hit = matchByName(input.category, cats)
        if (hit) {
          filters.categoryId = hit.id
          filters.categoryName = hit.name
          applied.category = hit.name
        } else unresolved.push(`category:${input.category}`)
      }
      if (input.account) {
        const accs = await listUserAccountsBasic(ctx.userId)
        const hit = matchByName(input.account, accs)
        if (hit) {
          filters.accountId = hit.id
          filters.accountName = hit.name
          applied.account = hit.name
        } else unresolved.push(`account:${input.account}`)
      }
      if (input.merchant) {
        filters.merchantSlug = normalize(input.merchant)
        applied.merchant = input.merchant
      }
      if (input.minAmount !== undefined) {
        filters.minAmount = input.minAmount
        applied.minAmount = input.minAmount
      }
      if (input.maxAmount !== undefined) {
        filters.maxAmount = input.maxAmount
        applied.maxAmount = input.maxAmount
      }

      const period: PeriodSlot = {
        from: input.period.from,
        to: input.period.to,
        label: input.period.label ?? `${input.period.from} a ${input.period.to}`,
        granularity: input.groupBy === 'month' ? 'month' : 'day',
      }

      const query: Query = {
        metric,
        subject,
        groupBy: input.groupBy,
        filters,
        period,
        ...(input.order ? { order: { by: 'value', dir: input.order } } : {}),
        ...(input.limit ? { limit: input.limit } : {}),
      }

      const meta = {
        baseCurrency: ctx.baseCurrency,
        query: { metric, subject, groupBy: input.groupBy ?? null, period: { from: period.from, to: period.to } },
        applied,
        ...(unresolved.length > 0 ? { unresolved } : {}),
      }

      // --- Comparación contra período anterior de igual longitud. ---
      if (input.comparePrevious) {
        const len = inclusiveDays(period.from, period.to)
        const prevTo = shiftIso(period.from, -1)
        const prevFrom = shiftIso(prevTo, -(len - 1))
        const prevPeriod: PeriodSlot = {
          from: prevFrom,
          to: prevTo,
          label: 'período anterior',
          granularity: period.granularity,
        }
        const compareQuery: Query = {
          ...query,
          groupBy: undefined,
          compare: { by: 'period', a: period, b: prevPeriod },
        }
        const res = await executeCompare(compareQuery, engineCtx)
        const deltaPct =
          res.b.value !== 0 ? Math.round(((res.a.value - res.b.value) / Math.abs(res.b.value)) * 100) : null
        return {
          ...meta,
          compare: {
            current: { period: { from: period.from, to: period.to }, value: Math.round(res.a.value), valueFormatted: fmt(res.a.value) },
            previous: { period: { from: prevFrom, to: prevTo }, value: Math.round(res.b.value), valueFormatted: fmt(res.b.value) },
            deltaPct,
          },
        }
      }

      const res = await executeQuery(query, engineCtx)

      // --- Escalar (sin agrupación). ---
      if (!input.groupBy) {
        return {
          ...meta,
          value: Math.round(res.total),
          valueFormatted: fmt(res.total),
          matchedTransactions: res.count,
        }
      }

      // --- Agrupado. ---
      return {
        ...meta,
        total: Math.round(res.total),
        totalFormatted: metric === 'count' ? String(Math.round(res.total)) : fmt(res.total),
        matchedTransactions: res.count,
        rows: res.rows.map((r) => ({
          label: r.label,
          value: Math.round(r.value),
          valueFormatted: fmt(r.value),
          count: r.count,
        })),
      }
    },
  })
}
