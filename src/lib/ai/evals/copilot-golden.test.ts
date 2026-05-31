import { describe, expect, it } from 'vitest'

import { COPILOT_GOLDEN, COPILOT_TOOL_NAMES } from './copilot-golden'

/**
 * Buena-formación del golden set de tool-calls (CI). La calidad real (¿el LLM
 * elige la tool correcta?) la mide `/api/dev/eval-copilot` con keys + DB.
 */
describe('golden set de tool-calls del copiloto', () => {
  const valid = new Set(COPILOT_TOOL_NAMES)

  it('toda tool esperada es una key válida de buildCopilotTools', () => {
    const unknown = COPILOT_GOLDEN.filter((c) => !valid.has(c.expectedTool))
    expect(unknown.map((c) => `${c.question} → ${c.expectedTool}`)).toEqual([])
  })

  it('sin preguntas duplicadas', () => {
    const seen = new Set<string>()
    const dupes: string[] = []
    for (const c of COPILOT_GOLDEN) {
      const key = c.question.toLowerCase()
      if (seen.has(key)) dupes.push(c.question)
      seen.add(key)
    }
    expect(dupes).toEqual([])
  })

  it('cubre las propuestas (regla 6) y un buen rango de lecturas', () => {
    const tools = new Set(COPILOT_GOLDEN.map((c) => c.expectedTool))
    expect(tools.has('proposeCreateTransaction')).toBe(true)
    expect(tools.has('proposeSetBudget')).toBe(true)
    expect(tools.has('proposeCardPurchase')).toBe(true)
    expect(tools.size).toBeGreaterThanOrEqual(12)
  })
})
