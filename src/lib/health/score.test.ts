import { describe, expect, it } from 'vitest'

import { BAND_LABEL, computeHealthScore } from './score'
import type { HealthInputs } from './types'

/**
 * Tests del scoring de Salud Financiera. El cálculo es determinista, así que
 * los esperados son exactos. Cubrimos: perfil sano, perfil frágil,
 * re-normalización por datos faltantes, casos borde (sin ingresos, sin deuda,
 * sin nada) y el pacing de presupuestos.
 */

/** Insumos base "neutros" que cada test sobrescribe parcialmente. */
function inputs(over: Partial<HealthInputs> = {}): HealthInputs {
  return {
    savings: { income: 1000, expense: 800 },
    runway: { liquidAssets: 3000, avgMonthlyExpense: 800 },
    debt: { totalDebt: 0, liquidAssets: 3000 },
    budgets: [{ amount: 100, projected: 80 }],
    stability: { dailyVolatility: 5, avgMonthlyExpense: 800 },
    ...over,
  }
}

describe('computeHealthScore', () => {
  it('perfil sano puntúa alto y banda sólida/estable', () => {
    const r = computeHealthScore(
      inputs({
        savings: { income: 1000, expense: 700 }, // 30% ahorro
        runway: { liquidAssets: 6000, avgMonthlyExpense: 800 }, // 7.5 meses
        debt: { totalDebt: 0, liquidAssets: 6000 },
        budgets: [{ amount: 100, projected: 70 }],
        stability: { dailyVolatility: 5, avgMonthlyExpense: 800 },
      }),
    )
    expect(r.score).not.toBeNull()
    expect(r.score!).toBeGreaterThanOrEqual(80)
    expect(r.band).toBe('solida')
    expect(r.evaluatedCount).toBe(5)
  })

  it('perfil frágil puntúa bajo y banda frágil', () => {
    const r = computeHealthScore(
      inputs({
        savings: { income: 1000, expense: 1200 }, // gasta más de lo que ingresa
        runway: { liquidAssets: 200, avgMonthlyExpense: 1000 }, // 0.2 meses
        debt: { totalDebt: 5000, liquidAssets: 200 }, // muy apalancado
        budgets: [{ amount: 100, projected: 200 }], // duplicó el presupuesto
        stability: { dailyVolatility: 200, avgMonthlyExpense: 1000 },
      }),
    )
    expect(r.score!).toBeLessThan(40)
    expect(r.band).toBe('fragil')
  })

  it('re-normaliza pesos cuando faltan dimensiones', () => {
    // Solo ahorro evaluable; el resto sin datos.
    const r = computeHealthScore({
      savings: { income: 1000, expense: 750 }, // 25% → score 100
      runway: { liquidAssets: 0, avgMonthlyExpense: 0 },
      debt: { totalDebt: 0, liquidAssets: 0 }, // deuda 0 → SÍ evaluable (100)
      budgets: [],
      stability: { dailyVolatility: 0, avgMonthlyExpense: 0 },
    })
    // Evaluables: ahorro (100) + deuda (100) = 100 compuesto.
    expect(r.evaluatedCount).toBe(2)
    expect(r.score).toBe(100)
  })

  it('sin ingresos marca ahorro como no evaluable', () => {
    const r = computeHealthScore(inputs({ savings: { income: 0, expense: 500 } }))
    const savings = r.dimensions.find((d) => d.key === 'savings')!
    expect(savings.available).toBe(false)
    expect(savings.score).toBeNull()
    expect(savings.status).toBe('na')
  })

  it('sin deuda da score perfecto en esa dimensión', () => {
    const r = computeHealthScore(inputs({ debt: { totalDebt: 0, liquidAssets: 1000 } }))
    const debt = r.dimensions.find((d) => d.key === 'debt')!
    expect(debt.score).toBe(100)
    expect(debt.detail).toContain('No tienes deudas')
  })

  it('deuda sin saldo líquido es riesgo máximo', () => {
    const r = computeHealthScore(inputs({ debt: { totalDebt: 1000, liquidAssets: 0 } }))
    const debt = r.dimensions.find((d) => d.key === 'debt')!
    expect(debt.score).toBe(0)
    expect(debt.status).toBe('risk')
  })

  it('presupuesto proyectado por encima del límite no cuenta como "dentro"', () => {
    const r = computeHealthScore(
      inputs({ budgets: [{ amount: 100, projected: 150 }] }),
    )
    const b = r.dimensions.find((d) => d.key === 'budgets')!
    expect(b.detail).toContain('0 de 1')
    expect(b.score!).toBeLessThan(70)
  })

  it('usuario nuevo sin gastos ni deudas evalúa al menos la deuda (señal buena)', () => {
    // "No tener deuda" siempre es evaluable y positivo, así que un usuario
    // recién llegado nunca ve un score vacío: arranca con esa señal.
    const r = computeHealthScore({
      savings: { income: 0, expense: 0 },
      runway: { liquidAssets: 0, avgMonthlyExpense: 0 },
      debt: { totalDebt: 0, liquidAssets: 0 },
      budgets: [],
      stability: { dailyVolatility: 0, avgMonthlyExpense: 0 },
    })
    expect(r.evaluatedCount).toBe(1)
    expect(r.score).toBe(100)
    expect(r.dimensions.find((d) => d.key === 'debt')!.score).toBe(100)
  })

  it('el resumen menciona el punto débil', () => {
    const r = computeHealthScore(
      inputs({
        savings: { income: 1000, expense: 700 },
        runway: { liquidAssets: 100, avgMonthlyExpense: 1000 }, // colchón débil
      }),
    )
    expect(r.summary.toLowerCase()).toContain('colchón')
  })

  it('todas las bandas tienen etiqueta', () => {
    expect(BAND_LABEL.solida).toBe('Sólida')
    expect(BAND_LABEL.estable).toBe('Estable')
    expect(BAND_LABEL.atencion).toBe('Atención')
    expect(BAND_LABEL.fragil).toBe('Frágil')
  })
})
