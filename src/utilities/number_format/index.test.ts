import { describe, it, expect } from 'vitest'
import util from './index'

describe('number_format', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('number_format')
    expect(util.name).toBe('number format')
    expect(util.category).toBe('Numbers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect((util.params.style as { options: string[] }).options).toEqual([
      'decimal', 'thousands', 'scientific', 'engineering', 'percent', 'currency', 'compact', 'fixed'
    ])
  })

  it('groups thousands by default', async () => {
    expect(await util.apply('1234567.891', {})).toBe('1,234,567.89')
    expect(await util.apply('1234567', {})).toBe('1,234,567')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n  ', {})).toBe('')
  })

  it('supports every style', async () => {
    expect(await util.apply('1234567.891', { style: 'decimal' })).toBe('1234567.89')
    expect(await util.apply('1234567.891', { style: 'thousands' })).toBe('1,234,567.89')
    expect(await util.apply('1234.5', { style: 'scientific' })).toBe('1.23e+3')
    // 12345 = 12.345e3, and 12.345 rounded to 2 places is 12.35
    expect(await util.apply('12345', { style: 'engineering' })).toBe('12.35e+3')
    expect(await util.apply('0.000123', { style: 'engineering' })).toBe('123.00e-6')
    expect(await util.apply('0.1234', { style: 'percent' })).toBe('12.34%')
    expect(await util.apply('1234.5', { style: 'currency' })).toBe('$1,234.50')
    expect(await util.apply('1234567', { style: 'compact' })).toBe('1.23M')
    expect(await util.apply('1234', { style: 'fixed' })).toBe('1234.00')
  })

  it('honours the decimals option', async () => {
    expect(await util.apply('1234.56', { style: 'thousands', decimals: 0 })).toBe('1,235')
    expect(await util.apply('0.000123', { style: 'scientific', decimals: 3 })).toBe('1.230e-4')
    expect(await util.apply('1234.5', { style: 'fixed', decimals: 4 })).toBe('1234.5000')
    expect(await util.apply('0', { style: 'engineering', decimals: 2 })).toBe('0.00e+0')
  })

  it('rounds the engineering mantissa on the exact decimal value, not a drifted double', async () => {
    // each of these is an exact ...5 tie that a `Number(mantissa) * 10 ** shift`
    // implementation rounds the wrong way
    expect(await util.apply('1005', { style: 'engineering', decimals: 2 })).toBe('1.01e+3')
    expect(await util.apply('1015', { style: 'engineering', decimals: 2 })).toBe('1.02e+3')
    expect(await util.apply('10050', { style: 'engineering', decimals: 1 })).toBe('10.1e+3')
    expect(await util.apply('100500', { style: 'engineering', decimals: 0 })).toBe('101e+3')
    expect(await util.apply('-12345', { style: 'engineering', decimals: 2 })).toBe('-12.35e+3')
    // rounding that carries the mantissa to 1000 moves to the next engineering step
    expect(await util.apply('999999', { style: 'engineering', decimals: 0 })).toBe('1e+6')
    expect(await util.apply('999.999', { style: 'engineering', decimals: 2 })).toBe('1.00e+3')
    // ...but a carry that only adds an integer digit stays in this step, keeping the
    // exponent a multiple of three and still printing exactly `decimals` places
    expect(await util.apply('9.999', { style: 'engineering', decimals: 2 })).toBe('10.00e+0')
    expect(await util.apply('-9.708966', { style: 'engineering', decimals: 0 })).toBe('-10e+0')
    expect(await util.apply('999.6', { style: 'engineering', decimals: 1 })).toBe('999.6e+0')
    // the exponent is always a multiple of three and the mantissa always in [1, 1000)
    expect(await util.apply('0.5', { style: 'engineering', decimals: 2 })).toBe('500.00e-3')
    expect(await util.apply('1000', { style: 'engineering', decimals: 2 })).toBe('1.00e+3')
  })

  it('formats in other locales and currencies, including non-ASCII output', async () => {
    expect(await util.apply('1234567.891', { style: 'thousands', locale: 'de-DE' })).toBe('1.234.567,89')
    expect(await util.apply('1234567', { style: 'thousands', locale: 'hi-IN' })).toBe('12,34,567')
    // de-DE euro output ends with a (possibly non-breaking) space and the € sign
    expect(await util.apply('1234.5', { style: 'currency', locale: 'de-DE', currency: 'EUR' }))
      .toMatch(/^1\.234,50\s€$/u)
    // yen sign, grouped, and no fractional part at all (ICU spells it ￥ or ¥)
    expect(await util.apply('1234', { style: 'currency', locale: 'ja-JP', currency: 'JPY', decimals: 0 }))
      .toMatch(/^[¥￥]1,234$/u)
  })

  it('applies a custom thousands separator, which also forces grouping', async () => {
    expect(await util.apply('1234567.891', { style: 'thousands', separator: ' ' })).toBe('1 234 567.89')
    expect(await util.apply('1234567.891', { style: 'thousands', separator: '_' })).toBe('1_234_567.89')
    // decimal is ungrouped normally, but a separator opts it in
    expect(await util.apply('1234567', { style: 'decimal', separator: '' })).toBe('1234567')
    expect(await util.apply('1234567', { style: 'decimal', separator: "'" })).toBe("1'234'567")
  })

  it('parses grouped, currency-decorated and percentage input', async () => {
    expect(await util.apply('1,234,567.89', { style: 'decimal' })).toBe('1234567.89')
    expect(await util.apply('€1.234,56', { style: 'decimal' })).toBe('1234.56')
    expect(await util.apply('$1,234.50', { style: 'decimal' })).toBe('1234.5')
    // a non-breaking space between groups (as fr-FR emits) round-trips back
    expect(await util.apply('1 234 567,89', { style: 'decimal' })).toBe('1234567.89')
    // a trailing % means the value is a percentage: 12.34% === 0.1234
    expect(await util.apply('12.34%', { style: 'percent' })).toBe('12.34%')
    expect(await util.apply('12.5%', { style: 'decimal', decimals: 4 })).toBe('0.125')
    expect(await util.apply('1.5e3', { style: 'thousands' })).toBe('1,500')
    expect(await util.apply('-1234.5', { style: 'currency' })).toBe('-$1,234.50')
  })

  it('formats one number per line, or the whole input when perLine is false', async () => {
    expect(await util.apply('1234\n5678', { style: 'thousands', perLine: true })).toBe('1,234\n5,678')
    expect(await util.apply('1234\n\n5678', { style: 'thousands', perLine: true })).toBe('1,234\n\n5,678')
    expect(await util.apply(' 1234 ', { style: 'thousands', perLine: false })).toBe('1,234')
  })

  it('throws clear errors on invalid numbers, locales and currencies', () => {
    expect(() => util.apply('abc', {})).toThrow(/is not a number/)
    expect(() => util.apply('12 34 hello', {})).toThrow(/is not a number/)
    expect(() => util.apply('1234', { locale: 'not a locale' })).toThrow(/locale/)
    expect(() => util.apply('1234', { style: 'currency', currency: 'XXXX' })).toThrow(/currency/)
    expect(() => util.apply('1234\nnope', { style: 'thousands' })).toThrow(/"nope" is not a number/)
  })
})
