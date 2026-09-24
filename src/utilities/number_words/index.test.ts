import { describe, it, expect } from 'vitest'
import util from './index'

describe('number_words', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('number_words')
    expect(util.name).toBe('number ↔ words')
    expect(util.category).toBe('Numbers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['direction', 'locale', 'perLine', 'style'])
    expect(util.params.direction).toMatchObject({ kind: 'select', default: 'to-words' })
    expect(util.params.style).toMatchObject({ kind: 'select', default: 'cardinal' })
    expect(util.params.locale).toMatchObject({ kind: 'select', default: 'en-US' })
    expect(util.params.perLine).toMatchObject({ kind: 'boolean', default: true })
  })

  it('spells cardinal numbers out (default direction/style)', async () => {
    expect(await util.apply('42', {})).toBe('forty-two')
    expect(await util.apply('0', {})).toBe('zero')
    expect(await util.apply('105', {})).toBe('one hundred five')
    expect(await util.apply('1234567', {}))
      .toBe('one million two hundred thirty-four thousand five hundred sixty-seven')
    expect(await util.apply('3.14', {})).toBe('three point one four')
    expect(await util.apply('-7', {})).toBe('negative seven')
    expect(await util.apply('1,234', {})).toBe('one thousand two hundred thirty-four')
    expect(await util.apply('1 234 567', {}))
      .toBe('one million two hundred thirty-four thousand five hundred sixty-seven')
  })

  it('stays exact past Number.MAX_SAFE_INTEGER', async () => {
    expect(await util.apply('9007199254740993', {}))
      .toBe('nine quadrillion seven trillion one hundred ninety-nine billion two hundred fifty-four million seven hundred forty thousand nine hundred ninety-three')
    expect(await util.apply('nine quadrillion seven trillion one hundred ninety-nine billion two hundred fifty-four million seven hundred forty thousand nine hundred ninety-three', { direction: 'to-number' }))
      .toBe('9007199254740993')
    expect(() => util.apply('1' + '0'.repeat(24), {})).toThrow(/too large/)
  })

  it('uses en-GB "and" placement when locale is en-GB', async () => {
    expect(await util.apply('105', { locale: 'en-GB' })).toBe('one hundred and five')
    expect(await util.apply('1000005', { locale: 'en-GB' })).toBe('one million and five')
    expect(await util.apply('1105', { locale: 'en-GB' })).toBe('one thousand one hundred and five')
    expect(await util.apply('105', { locale: 'en-US' })).toBe('one hundred five')
  })

  it('supports ordinal style', async () => {
    expect(await util.apply('1', { style: 'ordinal' })).toBe('first')
    expect(await util.apply('42', { style: 'ordinal' })).toBe('forty-second')
    expect(await util.apply('12', { style: 'ordinal' })).toBe('twelfth')
    expect(await util.apply('100', { style: 'ordinal' })).toBe('one hundredth')
    expect(await util.apply('1000000', { style: 'ordinal' })).toBe('one millionth')
  })

  it('supports year style', async () => {
    expect(await util.apply('1984', { style: 'year' })).toBe('nineteen eighty-four')
    expect(await util.apply('1905', { style: 'year' })).toBe('nineteen oh five')
    expect(await util.apply('1900', { style: 'year' })).toBe('nineteen hundred')
    expect(await util.apply('2000', { style: 'year' })).toBe('two thousand')
    expect(await util.apply('2021', { style: 'year' })).toBe('twenty twenty-one')
    expect(await util.apply('2010', { style: 'year' })).toBe('twenty ten')
    expect(await util.apply('2005', { style: 'year', locale: 'en-GB' })).toBe('two thousand and five')
  })

  it('supports currency style in both locales', async () => {
    expect(await util.apply('42.50', { style: 'currency' })).toBe('forty-two dollars and fifty cents')
    expect(await util.apply('1', { style: 'currency' })).toBe('one dollar')
    expect(await util.apply('0.99', { style: 'currency' })).toBe('ninety-nine cents')
    expect(await util.apply('0', { style: 'currency' })).toBe('zero dollars')
    expect(await util.apply('0.01', { style: 'currency', locale: 'en-GB' })).toBe('one penny')
    expect(await util.apply('42.50', { style: 'currency', locale: 'en-GB' }))
      .toBe('forty-two pounds and fifty pence')
  })

  it('parses number words back to digits (to-number)', async () => {
    expect(await util.apply('forty-two', { direction: 'to-number' })).toBe('42')
    expect(await util.apply('one hundred and five', { direction: 'to-number' })).toBe('105')
    expect(await util.apply('three point one four', { direction: 'to-number' })).toBe('3.14')
    expect(await util.apply('negative seven', { direction: 'to-number' })).toBe('-7')
    expect(await util.apply('forty-second', { direction: 'to-number', style: 'ordinal' })).toBe('42')
    expect(await util.apply('nineteen oh five', { direction: 'to-number', style: 'year' })).toBe('1905')
    expect(await util.apply('ninety-nine cents', { direction: 'to-number', style: 'currency' })).toBe('0.99')
  })

  it('round-trips every style exactly', async () => {
    const cases: Array<[string, string]> = [
      ['cardinal', '42'],
      ['cardinal', '1234567'],
      ['cardinal', '3.14'],
      ['cardinal', '-7'],
      ['ordinal', '42'],
      ['ordinal', '1'],
      ['year', '1984'],
      ['year', '2021'],
      ['year', '1900'],
      ['currency', '42.50'],
      ['currency', '1.00'],
      ['currency', '0.99']
    ]
    for (const [style, value] of cases) {
      for (const locale of ['en-US', 'en-GB']) {
        const words = await util.apply(value, { style, locale }) as string
        const back = await util.apply(words, { direction: 'to-number', style, locale }) as string
        expect(back, `${style}/${locale}: ${value} -> ${words}`).toBe(value)
      }
    }
  })

  it('handles non-ASCII currency symbols and minus signs', async () => {
    expect(await util.apply('£1.50', { style: 'currency', locale: 'en-GB' }))
      .toBe('one pound and fifty pence')
    expect(await util.apply('€2', { style: 'currency' })).toBe('two dollars')
    expect(await util.apply('-$5', {})).toBe('negative five')
    expect(await util.apply('−3', {})).toBe('negative three')
    expect(await util.apply('–9', {})).toBe('negative nine')
  })

  it('honours perLine in both states', async () => {
    expect(await util.apply('1\n2\n3', { perLine: true })).toBe('one\ntwo\nthree')
    expect(await util.apply('1\n\n3', { perLine: true })).toBe('one\n\nthree')
    expect(await util.apply('  7  ', { perLine: true })).toBe('  seven  ')
    expect(await util.apply('  7  ', { perLine: false })).toBe('  seven  ')
    expect(() => util.apply('1\n2', { perLine: false })).toThrow(/not a number/)
  })

  it('returns empty input untouched', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('   ')
    expect(await util.apply('', { direction: 'to-number' })).toBe('')
  })

  it('rejects badly grouped or malformed numbers instead of guessing', () => {
    // a separator is only a digit-group separator inside well-formed 3-digit groups
    expect(() => util.apply('1 2', {})).toThrow(/not a number/)
    expect(() => util.apply('1,2', {})).toThrow(/not a number/)
    expect(() => util.apply('12,34,567', {})).toThrow(/not a number/)
    expect(() => util.apply('1.2 3', {})).toThrow(/not a number/)
    expect(() => util.apply('4$2', {})).toThrow(/not a number/)
    expect(() => util.apply('1.2.3', {})).toThrow(/not a number/)
  })

  it('rejects trailing junk after a currency unit', () => {
    expect(() => util.apply('ninety-nine cents banana', { direction: 'to-number', style: 'currency' }))
      .toThrow(/unexpected words after the currency unit/)
    expect(() => util.apply('one dollar and fifty cents extra', { direction: 'to-number', style: 'currency' }))
      .toThrow(/unexpected words after the currency unit/)
    expect(() => util.apply('one dollar banana', { direction: 'to-number', style: 'currency' }))
      .toThrow(/unexpected words after the currency unit/)
  })

  it('throws clear errors on bad input and bad params', () => {
    expect(() => util.apply('abc', {})).toThrow(/not a number/)
    expect(() => util.apply('banana', { direction: 'to-number' })).toThrow(/unrecognized number word/)
    expect(() => util.apply('nineteen ninety banana', { direction: 'to-number', style: 'year' }))
      .toThrow(/not a year/)
    expect(() => util.apply('1.5', { style: 'ordinal' })).toThrow(/whole number/)
    expect(() => util.apply('1.5', { style: 'year' })).toThrow(/whole number/)
    expect(() => util.apply('42', { direction: 'sideways' })).toThrow(/unknown direction/)
    expect(() => util.apply('42', { style: 'roman' })).toThrow(/unknown style/)
    expect(() => util.apply('42', { locale: 'fr-FR' })).toThrow(/unknown locale/)
  })
})
