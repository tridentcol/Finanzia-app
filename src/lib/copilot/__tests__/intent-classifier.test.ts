import { describe, it, expect } from 'vitest'

import { INTENT_CATALOG } from '../intents/catalog'
import type { IntentId, SlotKey, Slots } from '../intents/types'
import { tokenize } from '../nlu/tokenize'
import { classify } from '../nlu/intent-classifier'
import { extractPeriod } from '../nlu/slots/period'
import { extractMoney } from '../nlu/slots/money'
import { extractOrdering } from '../nlu/slots/ordering'
import { extractQuery } from '../nlu/slots/query'

const TODAY = '2026-05-29'

/**
 * Pipeline PURO (sin DB): tokeniza, extrae los slots que no requieren
 * Postgres y clasifica. Suficiente para validar la elección de intent — los
 * slots de categoría/comercio/cuenta no cambian el ganador en este corpus.
 */
function classifyPure(utterance: string) {
  const tokens = tokenize(utterance)
  const slots: Slots = {}
  const period = extractPeriod(utterance, TODAY)
  if (period) slots.period = period
  const money = extractMoney(utterance)
  if (money) slots.money = money
  const ordering = extractOrdering(utterance)
  if (ordering) slots.ordering = ordering
  const query = extractQuery(utterance)
  if (query) slots.query = query

  const present = new Set<SlotKey>()
  if (slots.period) present.add('period')
  if (slots.money) present.add('money')
  if (slots.ordering) present.add('ordering')
  if (slots.query) present.add('query')

  return classify(tokens, present, INTENT_CATALOG)
}

// Corpus ES: utterance → intent esperado.
const CORPUS: Array<[string, IntentId]> = [
  // show-balance
  ['¿cuál es mi saldo total?', 'show-balance'],
  ['cuánto tengo en total', 'show-balance'],
  ['mi saldo', 'show-balance'],
  ['cuánta plata tengo', 'show-balance'],
  ['balance total de mis cuentas', 'show-balance'],
  ['cuánto dinero tengo', 'show-balance'],

  // account-detail
  ['saldo de mi cuenta de ahorros', 'account-detail'],
  ['cuánto tengo en mi débito', 'account-detail'],
  ['cuánto hay en mi cuenta corriente', 'account-detail'],
  ['saldo de la tarjeta', 'account-detail'],

  // spend-by-category
  ['¿cuánto gasté este mes?', 'spend-by-category'],
  ['cuánto gasté en restaurantes', 'spend-by-category'],
  ['gastos de transporte', 'spend-by-category'],
  ['en qué se va mi plata', 'spend-by-category'],
  ['gasto en mercado el mes pasado', 'spend-by-category'],
  ['cuánto gasté en gasolina', 'spend-by-category'],

  // top-merchants
  ['¿dónde gasté más?', 'top-merchants'],
  ['top tiendas del mes', 'top-merchants'],
  ['en qué comercio gasté más', 'top-merchants'],
  ['mis comercios con más gasto', 'top-merchants'],

  // budget-status
  ['¿cómo van mis presupuestos?', 'budget-status'],
  ['cómo voy con el presupuesto', 'budget-status'],
  ['mi tope de gasto', 'budget-status'],
  ['estado de mis presupuestos', 'budget-status'],

  // upcoming-payments
  ['¿qué pagos se vienen?', 'upcoming-payments'],
  ['próximos pagos', 'upcoming-payments'],
  ['qué tengo que pagar esta semana', 'upcoming-payments'],
  ['qué se viene de pagos', 'upcoming-payments'],

  // runway
  ['¿cuánto me dura el dinero?', 'runway'],
  ['cuánto me alcanza', 'runway'],
  ['hasta cuándo me alcanza la plata', 'runway'],
  ['mi runway', 'runway'],

  // compare-month
  ['compara este mes con el pasado', 'compare-month'],
  ['¿gasté más que el mes pasado?', 'compare-month'],
  ['comparar mis gastos', 'compare-month'],
  ['gasté menos que el mes pasado', 'compare-month'],

  // biggest-charge
  ['¿cuál fue mi gasto más caro?', 'biggest-charge'],
  ['el gasto más grande del mes', 'biggest-charge'],
  ['mi compra más grande', 'biggest-charge'],
  ['el cargo más costoso', 'biggest-charge'],

  // subscriptions
  ['¿qué suscripciones tengo?', 'subscriptions'],
  ['mis pagos recurrentes', 'subscriptions'],
  ['qué pago cada mes', 'subscriptions'],
  ['cuáles son mis suscripciones', 'subscriptions'],

  // savings-progress
  ['¿cómo voy con el ahorro?', 'savings-progress'],
  ['cuánto he ahorrado', 'savings-progress'],
  ['mi meta de ahorro', 'savings-progress'],
  ['cómo voy con la meta', 'savings-progress'],

  // debt-overview
  ['¿cuánto debo?', 'debt-overview'],
  ['mis deudas', 'debt-overview'],
  ['cuánto debo en préstamos', 'debt-overview'],
  ['resumen de mis deudas', 'debt-overview'],

  // insights-active
  ['¿qué detectaste?', 'insights-active'],
  ['qué encontraste en mis finanzas', 'insights-active'],
  ['mis lecturas', 'insights-active'],
  ['hay alguna anomalía', 'insights-active'],

  // search-transactions
  ['busca pagos a Uber', 'search-transactions'],
  ['encuentra transacciones de Netflix', 'search-transactions'],
  ['movimientos de Rappi', 'search-transactions'],
  ['busca Spotify', 'search-transactions'],

  // monthly-summary
  ['resumen del mes', 'monthly-summary'],
  ['dame el panorama', 'monthly-summary'],
  ['recap de mayo', 'monthly-summary'],
  ['cómo cerró el mes', 'monthly-summary'],

  // dormant-money
  ['¿tengo cuentas sin movimiento?', 'dormant-money'],
  ['plata quieta', 'dormant-money'],
  ['dinero dormido', 'dormant-money'],
  ['cuentas sin usar', 'dormant-money'],

  // advice
  ['¿qué me recomiendas?', 'advice'],
  ['¿qué me recomendás?', 'advice'],
  ['¿dónde puedo ahorrar?', 'advice'],
  ['dame consejos', 'advice'],
  ['¿cómo puedo mejorar mis finanzas?', 'advice'],

  // data-query
  ['¿cuántas transacciones tuve la semana pasada?', 'data-query'],
  ['gasto por mes', 'data-query'],
  ['gasto agrupado por categoría', 'data-query'],

  // help
  ['ayuda', 'help'],
  ['¿qué sabes hacer?', 'help'],
  ['qué puedo preguntarte', 'help'],
  ['comandos disponibles', 'help'],
]

describe('intent classifier — corpus ES', () => {
  const failures: Array<{ utterance: string; expected: IntentId; got: IntentId }> = []

  for (const [utterance, expected] of CORPUS) {
    const res = classifyPure(utterance)
    if (res.intent !== expected) {
      failures.push({ utterance, expected, got: res.intent })
    }
  }

  it('clasifica ≥90% del corpus correctamente', () => {
    const total = CORPUS.length
    const ok = total - failures.length
    const ratio = ok / total
    if (failures.length > 0) {
      // Visible en el reporte para iterar el motor (no bajar el threshold).
      console.log(`fallos (${failures.length}/${total}):`, failures)
    }
    expect(ratio).toBeGreaterThanOrEqual(0.9)
  })

  it('cada intent del catálogo aparece al menos una vez en el corpus', () => {
    const covered = new Set(CORPUS.map(([, id]) => id))
    const all = INTENT_CATALOG.map((m) => m.id)
    const missing = all.filter((id) => !covered.has(id))
    expect(missing).toEqual([])
  })
})

describe('slot extractors — período', () => {
  it('reconoce mes pasado', () => {
    const p = extractPeriod('el mes pasado', TODAY)
    expect(p?.granularity).toBe('month')
    expect(p?.from).toBe('2026-04-01')
    expect(p?.to).toBe('2026-04-30')
  })
  it('reconoce hoy y ayer', () => {
    expect(extractPeriod('hoy', TODAY)?.from).toBe('2026-05-29')
    expect(extractPeriod('ayer', TODAY)?.from).toBe('2026-05-28')
  })
  it('reconoce mes nombrado con año', () => {
    const p = extractPeriod('en marzo 2026', TODAY)
    expect(p?.from).toBe('2026-03-01')
    expect(p?.to).toBe('2026-03-31')
  })
})

describe('slot extractors — dinero', () => {
  it('sufijos y palabras', () => {
    expect(extractMoney('500k')?.value).toBe(500_000)
    expect(extractMoney('1.5m')?.value).toBe(1_500_000)
    expect(extractMoney('medio millón')?.value).toBe(500_000)
    expect(extractMoney('doscientos mil')?.value).toBe(200_000)
  })
})

describe('slot extractors — orden', () => {
  it('más caro y top N', () => {
    expect(extractOrdering('el más caro')?.order).toBe('desc')
    expect(extractOrdering('el más caro')?.limit).toBe(1)
    expect(extractOrdering('top 3')?.limit).toBe(3)
  })
})

describe('slot extractors — query', () => {
  it('extrae término tras verbo de búsqueda', () => {
    expect(extractQuery('busca pagos a uber este mes')).toContain('uber')
    expect(extractQuery('movimientos de netflix')).toBe('netflix')
  })
})
