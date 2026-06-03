import { describe, expect, it } from 'vitest'

import {
  endOfMonthIso,
  monthSequence,
  reconstructNetSeries,
  type MonthFlow,
} from './series'

describe('endOfMonthIso', () => {
  it('devuelve el último día del mes', () => {
    expect(endOfMonthIso('2026-02')).toBe('2026-02-28')
    expect(endOfMonthIso('2024-02')).toBe('2024-02-29') // bisiesto
    expect(endOfMonthIso('2026-01')).toBe('2026-01-31')
    expect(endOfMonthIso('2026-04')).toBe('2026-04-30')
  })
})

describe('monthSequence', () => {
  it('lista meses contiguos sin incluir el fin', () => {
    expect(monthSequence('2026-03', '2026-06')).toEqual(['2026-03', '2026-04', '2026-05'])
  })
  it('cruza el cambio de año', () => {
    expect(monthSequence('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01'])
  })
  it('vacío si start >= endExclusive', () => {
    expect(monthSequence('2026-06', '2026-06')).toEqual([])
  })
})

describe('reconstructNetSeries', () => {
  it('resta hacia atrás el flujo de los meses posteriores', () => {
    // Hoy junio. Neto hoy = 1000. Flujos: may +100, jun +50.
    // neto(fin may) = 1000 − flujo(jun) = 1000 − 50 = 950.
    // neto(fin abr) = 1000 − flujo(jun) − flujo(may) = 1000 − 50 − 100 = 850.
    const flows: MonthFlow[] = [
      { month: '2026-04', flow: 200 },
      { month: '2026-05', flow: 100 },
      { month: '2026-06', flow: 50 },
    ]
    const pts = reconstructNetSeries(1000, '2026-06-15', flows)
    expect(pts).toEqual([
      { date: '2026-04-30', net: 850 },
      { date: '2026-05-31', net: 950 },
    ])
  })

  it('maneja flujos negativos (déficit) subiendo el neto pasado', () => {
    // Si este mes gastaste de más (flujo negativo), el pasado tenía MÁS neto.
    const flows: MonthFlow[] = [
      { month: '2026-05', flow: -300 },
      { month: '2026-06', flow: -100 },
    ]
    const pts = reconstructNetSeries(500, '2026-06-10', flows)
    // neto(fin may) = 500 − flujo(jun) = 500 − (−100) = 600.
    expect(pts).toEqual([{ date: '2026-05-31', net: 600 }])
  })

  it('rellena meses sin transacciones (flujo 0) dentro del rango', () => {
    const flows: MonthFlow[] = [
      { month: '2026-03', flow: 100 },
      { month: '2026-06', flow: 50 },
    ]
    const pts = reconstructNetSeries(1000, '2026-06-01', flows)
    // meses pasados: mar, abr, may. abr y may sin flujo (0).
    // neto(fin may) = 1000 − flujo(jun)=50 → 950
    // neto(fin abr) = 950 − flujo(may)=0 → 950
    // neto(fin mar) = 950 − flujo(abr)=0 → 950
    expect(pts).toEqual([
      { date: '2026-03-31', net: 950 },
      { date: '2026-04-30', net: 950 },
      { date: '2026-05-31', net: 950 },
    ])
  })

  it('sin meses pasados devuelve vacío', () => {
    const pts = reconstructNetSeries(1000, '2026-06-01', [{ month: '2026-06', flow: 50 }])
    expect(pts).toEqual([])
  })
})
