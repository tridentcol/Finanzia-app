import { describe, it, expect } from 'vitest'

import {
  derivePersona,
  parsePersona,
  personaToSnapshotLines,
  personaToToneHints,
  hasToneSignal,
  testAnswersSchema,
  TEST_QUESTIONS,
  type Persona,
} from '@/lib/ai/copilot/persona'

describe('derivePersona — determinista y auditable', () => {
  it('todo "planificador/corto/conservador" en el extremo 0', () => {
    const d = derivePersona({ p1: 'fondo', p2: 'mes', p3: 'reglas' })
    expect(d.moneyStyle).toBe('planificador')
    expect(d.horizon).toBe('corto')
    expect(d.riskTolerance).toBe('conservador')
  })

  it('todo en el extremo 2 → espontáneo/largo/agresivo', () => {
    const d = derivePersona({ p1: 'como_pueda', p2: 'anios', p3: 'flexible' })
    expect(d.moneyStyle).toBe('espontaneo')
    expect(d.horizon).toBe('largo')
    expect(d.riskTolerance).toBe('agresivo')
  })

  it('punto medio → equilibrado/medio/moderado', () => {
    const d = derivePersona({ p1: 'reacomodo', p2: 'anio', p3: 'medio' })
    expect(d.moneyStyle).toBe('equilibrado')
    expect(d.horizon).toBe('medio')
    expect(d.riskTolerance).toBe('moderado')
  })

  it('mismas respuestas → mismo resultado (determinismo)', () => {
    const a = derivePersona({ p1: 'fondo', p2: 'anios', p3: 'medio' })
    const b = derivePersona({ p1: 'fondo', p2: 'anios', p3: 'medio' })
    expect(a).toEqual(b)
  })

  it('respuestas parciales: deriva sólo lo posible', () => {
    expect(derivePersona({ p2: 'anio' })).toEqual({ horizon: 'medio' })
    expect(derivePersona({})).toEqual({})
    // p1+p3 dan moneyStyle pero sin p2 no hay horizon ni risk
    expect(derivePersona({ p1: 'fondo', p3: 'reglas' })).toEqual({ moneyStyle: 'planificador' })
  })

  it('valores fuera del catálogo se ignoran', () => {
    expect(derivePersona({ p2: 'inexistente' })).toEqual({})
  })
})

describe('testAnswersSchema — valores cerrados, sin drift', () => {
  it('acepta todos los valores reales del catálogo', () => {
    for (const q of TEST_QUESTIONS) {
      for (const o of q.options) {
        expect(testAnswersSchema.safeParse({ [q.id]: o.value }).success).toBe(true)
      }
    }
  })
  it('rechaza un valor fuera del catálogo', () => {
    expect(testAnswersSchema.safeParse({ p1: 'basura' }).success).toBe(false)
  })
  it('parcial: acepta sólo algunas respuestas', () => {
    expect(testAnswersSchema.safeParse({ p2: 'anio' }).success).toBe(true)
    expect(testAnswersSchema.safeParse({}).success).toBe(true)
  })
})

describe('parsePersona — Zod tolerante', () => {
  it('null / no-objeto → null', () => {
    expect(parsePersona(null)).toBeNull()
    expect(parsePersona(undefined)).toBeNull()
  })
  it('focus con más de 2 → rechaza', () => {
    expect(
      parsePersona({ focus: ['salir_de_deudas', 'invertir', 'ahorrar_meta'] }),
    ).toBeNull()
  })
  it('enum inválido → rechaza', () => {
    expect(parsePersona({ literacy: 'experto' })).toBeNull()
  })
  it('persona válida → la devuelve', () => {
    const p = parsePersona({ literacy: 'basico', focus: ['invertir'] })
    expect(p?.literacy).toBe('basico')
    expect(p?.focus).toEqual(['invertir'])
  })
})

describe('personaToSnapshotLines — una línea por señal', () => {
  it('persona vacía → cero líneas', () => {
    expect(personaToSnapshotLines({})).toEqual([])
  })
  it('emite una línea por cada señal presente', () => {
    const p: Persona = {
      literacy: 'basico',
      commStyle: 'didactico',
      moneyStyle: 'planificador',
      horizon: 'largo',
      focus: ['salir_de_deudas', 'invertir'],
    }
    const lines = personaToSnapshotLines(p)
    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain('básico')
    expect(lines[4]).toContain('salir de deudas')
    expect(lines[4]).toContain('empezar a invertir')
  })
})

describe('personaToToneHints — mapeo de tono', () => {
  it('directo → verbosity low; básico → explainTerms', () => {
    const h = personaToToneHints({ commStyle: 'directo', literacy: 'basico' })
    expect(h.verbosity).toBe('low')
    expect(h.explainTerms).toBe(true)
    expect(h.assumeKnowledge).toBe(false)
  })
  it('didáctico → verbosity high + explainReasoning; avanzado → assumeKnowledge', () => {
    const h = personaToToneHints({ commStyle: 'didactico', literacy: 'avanzado' })
    expect(h.verbosity).toBe('high')
    expect(h.explainReasoning).toBe(true)
    expect(h.assumeKnowledge).toBe(true)
  })
  it('persona vacía → sin señal de tono', () => {
    expect(hasToneSignal(personaToToneHints({}))).toBe(false)
  })
  it('focus genera focusOrder legible', () => {
    const h = personaToToneHints({ focus: ['ordenar_gastos'] })
    expect(h.focusOrder).toEqual(['ordenar sus gastos'])
    expect(hasToneSignal(h)).toBe(true)
  })
})
