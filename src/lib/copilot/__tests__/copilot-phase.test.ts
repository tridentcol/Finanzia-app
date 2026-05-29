import { describe, it, expect } from 'vitest'

import {
  derivePhase,
  PHASE_THINKING,
  PHASE_DRAFTING,
  PHASE_WORKING,
  TOOL_LABELS,
} from '../render/copilot-phase'
import type { LoosePart } from '../parts'

describe('derivePhase — jerarquía de fases', () => {
  it('sin parts → Pensando…', () => {
    expect(derivePhase(undefined)).toBe(PHASE_THINKING)
    expect(derivePhase([])).toBe(PHASE_THINKING)
  })

  it('parts sin tools (sólo razonando) → Pensando…', () => {
    const parts: LoosePart[] = [{ type: 'step-start' }, { type: 'reasoning', text: '' }]
    expect(derivePhase(parts)).toBe(PHASE_THINKING)
  })

  it('tool tipado activo (input-available) → etiqueta del tool', () => {
    const parts: LoosePart[] = [
      { type: 'tool-queryTransactions', state: 'input-available' },
    ]
    expect(derivePhase(parts)).toBe(TOOL_LABELS.queryTransactions)
  })

  it('tool en input-streaming también cuenta como activo', () => {
    const parts: LoosePart[] = [{ type: 'tool-getDebts', state: 'input-streaming' }]
    expect(derivePhase(parts)).toBe(TOOL_LABELS.getDebts)
  })

  it('dynamic-tool activo usa toolName', () => {
    const parts: LoosePart[] = [
      { type: 'dynamic-tool', toolName: 'getCashFlow', state: 'input-available' },
    ]
    expect(derivePhase(parts)).toBe(TOOL_LABELS.getCashFlow)
  })

  it('gana el último tool activo del array', () => {
    const parts: LoosePart[] = [
      { type: 'tool-getBalance', state: 'output-available', output: {} },
      { type: 'tool-getDebts', state: 'input-available' },
    ]
    expect(derivePhase(parts)).toBe(TOOL_LABELS.getDebts)
  })

  it('todos los tools resueltos, sin texto → Preparando tu respuesta…', () => {
    const parts: LoosePart[] = [
      { type: 'tool-getBalance', state: 'output-available', output: {} },
      { type: 'tool-getDebts', state: 'output-available', output: {} },
    ]
    expect(derivePhase(parts)).toBe(PHASE_DRAFTING)
  })

  it('tool resuelto con error también se considera resuelto (drafting)', () => {
    const parts: LoosePart[] = [
      { type: 'tool-getBalance', state: 'output-error' },
    ]
    expect(derivePhase(parts)).toBe(PHASE_DRAFTING)
  })

  it('tool desconocido activo → fallback Trabajando…', () => {
    const parts: LoosePart[] = [{ type: 'tool-somethingNew', state: 'input-available' }]
    expect(derivePhase(parts)).toBe(PHASE_WORKING)
  })

  it('propose-* activo → Preparando el movimiento…', () => {
    const parts: LoosePart[] = [
      { type: 'tool-proposeCreateTransaction', state: 'input-available' },
    ]
    expect(derivePhase(parts)).toBe(TOOL_LABELS.proposeCreateTransaction)
  })
})
