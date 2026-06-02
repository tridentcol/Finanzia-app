import { describe, expect, it } from 'vitest'

import { formatMoney } from './format'

/**
 * Tests de formato compacto. Regla: el modo compacto usa 1 decimal y NO
 * redondea a la unidad de millón (2.7M debe seguir siendo 2.7M, no 3M), porque
 * redondear de más confunde y se aleja de la realidad. Usamos locale en-US para
 * strings deterministas (es-CO usa coma decimal y NBSP, frágil de asertar).
 */
describe('formatMoney — compacto', () => {
  it('no redondea 2.7M a 3M', () => {
    const out = formatMoney(2_700_000, { currency: 'USD', locale: 'en-US', compact: true })
    expect(out).toContain('2.7')
    expect(out).toContain('M')
    expect(out).not.toContain('3M')
  })

  it('mantiene 1.5M (no salta a 2M)', () => {
    const out = formatMoney(1_536_827, { currency: 'USD', locale: 'en-US', compact: true })
    expect(out).toContain('1.5')
  })

  it('millón exacto se muestra sin decimal sobrante', () => {
    const out = formatMoney(3_000_000, { currency: 'USD', locale: 'en-US', compact: true })
    expect(out).toContain('3M')
    expect(out).not.toContain('3.0M')
  })

  it('miles se compactan con K', () => {
    const out = formatMoney(50_000, { currency: 'USD', locale: 'en-US', compact: true })
    expect(out).toContain('50K')
  })

  it('funciona con COP (0 decimales) sin redondear a la unidad de millón', () => {
    const out = formatMoney(2_700_000, { currency: 'COP', locale: 'en-US', compact: true })
    expect(out).toContain('2.7')
    expect(out).toContain('M')
  })

  it('el modo estándar conserva los decimales de la moneda', () => {
    expect(formatMoney(2_700_000, { currency: 'USD', locale: 'en-US' })).toBe('$2,700,000.00')
    // COP no tiene decimales.
    expect(formatMoney(2_700_000, { currency: 'COP', locale: 'en-US' })).toContain('2,700,000')
  })
})
