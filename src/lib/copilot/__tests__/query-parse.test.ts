import { describe, it, expect } from 'vitest'

import { parseQuery, type ParseLists } from '../query/parse'
import type { Slots } from '../intents/types'

const PERIOD = { from: '2026-05-01', to: '2026-05-31', label: 'este mes', granularity: 'month' as const }
const empty: Slots = {}

describe('parseQuery — métrica y sujeto', () => {
  it('count: "cuántas transacciones"', () => {
    const q = parseQuery('cuántas transacciones tuve', empty, PERIOD)
    expect(q?.metric).toBe('count')
    expect(q?.subject).toBe('expense')
  })
  it('avg: "promedio diario de gastos"', () => {
    const q = parseQuery('promedio de gastos', empty, PERIOD)
    expect(q?.metric).toBe('avg')
  })
  it('income: "cuánto ingresé"', () => {
    const q = parseQuery('cuánto ingresé este mes', empty, PERIOD)
    expect(q?.subject).toBe('income')
  })
  it('net: "cuánto me quedó"', () => {
    const q = parseQuery('cuánto me quedó neto', empty, PERIOD)
    expect(q?.subject).toBe('net')
  })
})

describe('parseQuery — agrupación', () => {
  it('por categoría', () => {
    expect(parseQuery('gasto por categoría', empty, PERIOD)?.groupBy).toBe('category')
  })
  it('por comercio', () => {
    expect(parseQuery('gasto por comercio', empty, PERIOD)?.groupBy).toBe('merchant')
  })
  it('por mes', () => {
    expect(parseQuery('gasto por mes', empty, PERIOD)?.groupBy).toBe('month')
  })
})

describe('parseQuery — señal mínima', () => {
  it('sin señal → null', () => {
    expect(parseQuery('hola', empty, PERIOD)).toBeNull()
  })
  it('con filtro de slot → no null', () => {
    const slots: Slots = { category: { id: 'c1', name: 'Mercado' } }
    expect(parseQuery('algo', slots, PERIOD)).not.toBeNull()
  })
})

describe('parseQuery — comparación', () => {
  it('período: "vs el mes pasado"', () => {
    const q = parseQuery('gasto en mercado vs el mes pasado', { category: { id: 'c1', name: 'Mercado' } }, PERIOD)
    expect(q?.compare?.by).toBe('period')
    if (q?.compare?.by === 'period') {
      expect(q.compare.b.label).toBe('el mes pasado')
      expect(q.compare.b.from).toBe('2026-04-01')
    }
  })

  it('entidades: "uber vs taxi" con listas', () => {
    const lists: ParseLists = {
      categories: [],
      merchants: [
        { slug: 'uber', name: 'Uber' },
        { slug: 'taxi', name: 'Taxi' },
      ],
    }
    const q = parseQuery('cuánto gasté en uber vs taxi', empty, PERIOD, lists)
    expect(q?.compare?.by).toBe('entities')
    if (q?.compare?.by === 'entities') {
      expect(q.compare.dimension).toBe('merchant')
      expect(q.compare.a.label).toBe('Uber')
      expect(q.compare.b.label).toBe('Taxi')
    }
  })
})
