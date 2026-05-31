import { describe, expect, it } from 'vitest'

import { convertMoney, fromCents, toCents } from './convert'

/**
 * Tests de precisión de la conversión de dinero.
 *
 * La regla no negociable #4 prohíbe float para dinero. `convertMoney` hace
 * aritmética entera (BigInt, centavos) con redondeo half-even (banker's), así
 * que el resultado es EXACTO y determinista a cualquier magnitud válida de
 * `numeric(15,2)`.
 *
 * Los valores esperados se calcularon con un oráculo BigInt independiente.
 */
describe('convertMoney', () => {
  describe('identidad y casos base', () => {
    it('tasa 1.000000 devuelve el mismo monto (round-trip exacto)', () => {
      expect(convertMoney('1234.56', '1.000000')).toBe('1234.56')
      expect(convertMoney('0.00', '1.000000')).toBe('0.00')
      expect(convertMoney('999999999.99', '1.000000')).toBe('999999999.99')
    })

    it('monto cero siempre da 0.00', () => {
      expect(convertMoney('0.00', '4000.000000')).toBe('0.00')
      expect(convertMoney('0', '0.000250')).toBe('0.00')
    })

    it('producto exacto sin redondeo', () => {
      expect(convertMoney('10.00', '1.500000')).toBe('15.00')
      expect(convertMoney('1000.00', '4000.123456')).toBe('4000123.46')
    })
  })

  describe('redondeo half-even (banker\'s)', () => {
    it('redondea hacia abajo cuando el resto < 0.5 de centavo', () => {
      expect(convertMoney('1.00', '1.234000')).toBe('1.23')
    })

    it('redondea hacia arriba cuando el resto > 0.5 de centavo', () => {
      expect(convertMoney('1.00', '1.236000')).toBe('1.24')
    })

    it('en empate exacto redondea al par más cercano', () => {
      // 1.00 * 0.005 = 0.005  -> par más cercano es 0.00
      expect(convertMoney('1.00', '0.005000')).toBe('0.00')
      // 3.00 * 0.005 = 0.015  -> par más cercano es 0.02
      expect(convertMoney('3.00', '0.005000')).toBe('0.02')
      // 5.00 * 0.005 = 0.025  -> par más cercano es 0.02
      expect(convertMoney('5.00', '0.005000')).toBe('0.02')
      // 7.00 * 0.005 = 0.035  -> par más cercano es 0.04
      expect(convertMoney('7.00', '0.005000')).toBe('0.04')
    })
  })

  describe('signo', () => {
    it('preserva montos negativos con el mismo redondeo', () => {
      expect(convertMoney('-1000.00', '4000.123456')).toBe('-4000123.46')
      expect(convertMoney('-1.00', '1.236000')).toBe('-1.24')
    })
  })

  describe('gran magnitud (COP, sin pérdida de precisión)', () => {
    it('mantiene el centavo exacto en montos grandes', () => {
      expect(convertMoney('99999999.99', '1234.567890')).toBe('123456788987.65')
      expect(convertMoney('9999999999.99', '1234.567891')).toBe('12345678909987.65')
    })
  })

  describe('regresión: el float producía centavos incorrectos', () => {
    // Estos casos son la razón de existir de esta función. El cálculo viejo
    // `(parseFloat(amount) * parseFloat(rate)).toFixed(2)` da un centavo
    // distinto porque float64 no representa 0.005 con exactitud.
    it.each([
      ['1.00', '0.005000', '0.00'],
      ['3.00', '0.005000', '0.02'],
    ])('convertMoney(%s, %s) === %s y difiere del float ingenuo', (amount, rate, expected) => {
      const naiveFloat = (Number.parseFloat(amount) * Number.parseFloat(rate)).toFixed(2)
      expect(convertMoney(amount, rate)).toBe(expected)
      expect(naiveFloat).not.toBe(expected)
    })
  })

  describe('validación de entrada', () => {
    it('lanza con monto no numérico', () => {
      expect(() => convertMoney('abc', '1.000000')).toThrow()
      expect(() => convertMoney('', '1.000000')).toThrow()
    })

    it('lanza con tasa no numérica', () => {
      expect(() => convertMoney('100.00', 'x')).toThrow()
      expect(() => convertMoney('100.00', '')).toThrow()
    })
  })
})

describe('toCents / fromCents', () => {
  it('round-trip exacto', () => {
    for (const v of ['0.00', '1234.56', '999999999.99', '0.01', '-50.00']) {
      expect(fromCents(toCents(v))).toBe(v)
    }
  })

  it('suma dinero sin deriva de float', () => {
    // 0.1 + 0.2 en float = 0.30000000000000004; en centavos es exacto.
    const cents = toCents('0.10') + toCents('0.20')
    expect(fromCents(cents)).toBe('0.30')
  })

  it('suma grandes montos COP exacta', () => {
    const values = ['9999999999.99', '0.01', '1234567.89']
    const total = values.reduce((acc, v) => acc + toCents(v), 0n)
    expect(fromCents(total)).toBe('10001234567.89')
  })

  it('normaliza montos sin decimales o con uno', () => {
    expect(fromCents(toCents('100'))).toBe('100.00')
    expect(fromCents(toCents('100.5'))).toBe('100.50')
  })
})
