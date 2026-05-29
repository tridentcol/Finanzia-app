import 'server-only'

import type { AnswerBlock, AnswerPayload, BreakdownRow } from '../render/answer-ast'
import type { EngineContext } from '../intents/types'
import { money, capitalize } from '../intents/helpers'
import type { Query } from './types'
import type { CompareResult, QueryResult } from './execute'

const METRIC_NOUN: Record<Query['metric'], string> = {
  sum: 'total',
  count: 'cantidad',
  avg: 'promedio',
  max: 'máximo',
  min: 'mínimo',
}

function subjectNoun(q: Query): string {
  if (q.subject === 'income') return 'ingreso'
  if (q.subject === 'net') return 'flujo neto'
  return 'gasto'
}

/** Formatea un valor según la métrica: count es conteo plano, el resto dinero. */
function fmt(value: number, q: Query, ctx: EngineContext): string {
  return q.metric === 'count' ? String(Math.round(value)) : money(value, ctx.baseCurrency)
}

/** Render de una comparación de dos lados → BarsBlock + intro con la diferencia. */
export function compareToAnswer(
  query: Query,
  result: CompareResult,
  ctx: EngineContext,
): AnswerPayload {
  const subj = subjectNoun(query)
  const max = Math.max(result.a.value, result.b.value, 1)
  const diff = result.a.value - result.b.value
  const pct = result.b.value > 0 ? (diff / result.b.value) * 100 : 0
  const more = diff > 0 ? 'más' : 'menos'
  return {
    intro:
      diff === 0
        ? `Mismo ${subj} en ambos (${fmt(result.a.value, query, ctx)}).`
        : `${capitalize(result.a.label)} tuvo ${fmt(Math.abs(diff), query, ctx)} ${more} que ${result.b.label}${pct !== 0 && query.metric !== 'count' ? ` (${pct > 0 ? '+' : ''}${pct.toFixed(0)}%)` : ''}.`,
    blocks: [
      {
        type: 'bars',
        title: `${capitalize(subj)} comparado`,
        max,
        valueFormat: query.metric === 'count' ? 'count' : 'money',
        rows: [
          { label: result.a.label, raw: result.a.value, value: fmt(result.a.value, query, ctx) },
          { label: result.b.label, raw: result.b.value, value: fmt(result.b.value, query, ctx) },
        ],
      },
    ],
  }
}

export function queryToAnswer(
  query: Query,
  result: QueryResult,
  ctx: EngineContext,
): AnswerPayload {
  const subj = subjectNoun(query)

  // --- Sin agrupación: un escalar. ---
  if (!query.groupBy) {
    if (result.count === 0) {
      return {
        intro: `Sin ${subj}s ${query.period.label}${query.filters.categoryName ? ` en ${query.filters.categoryName}` : ''}.`,
        blocks: [{ type: 'text', body: 'No hay movimientos que coincidan.' }],
      }
    }
    const label =
      query.metric === 'count'
        ? `Transacciones · ${query.period.label}`
        : `${capitalize(METRIC_NOUN[query.metric])} de ${subj} · ${query.period.label}`
    const filterNote = query.filters.categoryName ?? query.filters.merchantName ?? query.filters.accountName
    return {
      intro: filterNote ? `${capitalize(subj)} en ${filterNote}, ${query.period.label}.` : undefined,
      blocks: [
        {
          type: 'amount',
          label,
          value: fmt(result.total, query, ctx),
          currency: ctx.baseCurrency,
          tone: query.subject === 'net' ? (result.total >= 0 ? 'positive' : 'negative') : 'neutral',
          note: query.metric === 'count' ? undefined : `${result.count} movimientos`,
        },
      ],
    }
  }

  // --- Agrupado. ---
  if (result.rows.length === 0) {
    return {
      intro: `Sin datos para agrupar ${query.period.label}.`,
      blocks: [{ type: 'text', body: 'No hay movimientos que coincidan.' }],
    }
  }

  const dimNoun =
    query.groupBy === 'category'
      ? 'categoría'
      : query.groupBy === 'merchant'
        ? 'comercio'
        : query.groupBy === 'account'
          ? 'cuenta'
          : 'mes'

  // sum → breakdown con fracción; resto → bars.
  if (query.metric === 'sum') {
    const total = result.total > 0 ? result.total : result.rows.reduce((a, r) => a + r.value, 0)
    const rows: BreakdownRow[] = result.rows.map((r) => ({
      label: r.label,
      value: money(r.value, ctx.baseCurrency),
      fraction: total > 0 ? r.value / total : 0,
      sub: `${r.count}`,
    }))
    return {
      intro: `${capitalize(subj)} por ${dimNoun}, ${query.period.label}.`,
      blocks: [
        {
          type: 'breakdown',
          title: `Por ${dimNoun}`,
          rows,
          total: { label: 'Total', value: money(total, ctx.baseCurrency) },
        },
      ],
    }
  }

  const max = Math.max(...result.rows.map((r) => r.value), 1)
  const block: AnswerBlock = {
    type: 'bars',
    title: `${capitalize(METRIC_NOUN[query.metric])} por ${dimNoun}`,
    max,
    valueFormat: query.metric === 'count' ? 'count' : 'money',
    rows: result.rows.map((r) => ({ label: r.label, raw: r.value, value: fmt(r.value, query, ctx) })),
  }
  return {
    intro: `${capitalize(METRIC_NOUN[query.metric])} de ${subj} por ${dimNoun}, ${query.period.label}.`,
    blocks: [block],
  }
}
