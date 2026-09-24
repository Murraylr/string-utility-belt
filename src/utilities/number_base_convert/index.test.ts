import { describe, it, expect } from 'vitest'
import util from './index'

describe('number_base_convert', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('number_base_convert')
    expect(util.name).toBe('number base convert')
    expect(util.category).toBe('Numbers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('converts decimal to hex by default', async () => {
    expect(await util.apply('255', {})).toBe('ff')
    expect(await util.apply('4096', { from: 10, to: 16 })).toBe('1000')
  })

  it('converts between arbitrary bases', async () => {
    expect(await util.apply('11111111', { from: 2, to: 10 })).toBe('255')
    expect(await util.apply('zz', { from: 36, to: 10 })).toBe('1295')
    expect(await util.apply('255', { from: 10, to: 36 })).toBe('73')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
  })

  it('auto-detects the source base from a prefix when from = 0', async () => {
    expect(await util.apply('0xff', { from: 0, to: 10 })).toBe('255')
    expect(await util.apply('0b1010', { from: 0, to: 10 })).toBe('10')
    expect(await util.apply('0o17', { from: 0, to: 10 })).toBe('15')
    expect(await util.apply('42', { from: 0, to: 2 })).toBe('101010')
  })

  it('keeps "0b1" as a hex literal when the source base is explicitly 16', async () => {
    expect(await util.apply('0b1', { from: 16, to: 10 })).toBe('177')
    expect(await util.apply('0xff', { from: 16, to: 10 })).toBe('255')
  })

  it('honours uppercase and prefix options', async () => {
    expect(await util.apply('255', { from: 10, to: 16, uppercase: true })).toBe('FF')
    expect(await util.apply('255', { from: 10, to: 16, prefix: true })).toBe('0xff')
    expect(await util.apply('255', { from: 10, to: 16, uppercase: true, prefix: true })).toBe('0xFF')
    expect(await util.apply('255', { from: 10, to: 2, prefix: true })).toBe('0b11111111')
    expect(await util.apply('255', { from: 10, to: 8, prefix: true })).toBe('0o377')
    // bases without a conventional prefix get none
    expect(await util.apply('255', { from: 10, to: 36, prefix: true })).toBe('73')
    expect(await util.apply('255', { from: 10, to: 16, uppercase: false, prefix: false })).toBe('ff')
  })

  it('groups digits from the right and reads grouped input back', async () => {
    expect(await util.apply('255', { from: 10, to: 2, groupDigits: 4 })).toBe('1111 1111')
    expect(await util.apply('1000000', { from: 10, to: 10, groupDigits: 3 })).toBe('1 000 000')
    expect(await util.apply('1111 1111', { from: 2, to: 10, groupDigits: 0 })).toBe('255')
    expect(await util.apply('1_000_000', { from: 10, to: 16 })).toBe('f4240')
  })

  it('handles negative numbers and a leading plus', async () => {
    expect(await util.apply('-255', { from: 10, to: 16 })).toBe('-ff')
    expect(await util.apply('-255', { from: 10, to: 16, prefix: true, uppercase: true })).toBe('-0xFF')
    expect(await util.apply('+16', { from: 10, to: 16 })).toBe('10')
  })

  it('is exact for huge values (BigInt)', async () => {
    expect(await util.apply('123456789012345678901234567890', { from: 10, to: 16 }))
      .toBe('18ee90ff6c373e0ee4e3f0ad2')
    expect(await util.apply('18ee90ff6c373e0ee4e3f0ad2', { from: 16, to: 10 }))
      .toBe('123456789012345678901234567890')
    expect(await util.apply('123456789012345678901234567890', { from: 10, to: 36 }))
      .toBe('byw97um9s91dlz68tsi')
  })

  it('converts per line and preserves blank lines, or joins when perLine is false', async () => {
    expect(await util.apply('255\n16', { from: 10, to: 16, perLine: true })).toBe('ff\n10')
    expect(await util.apply('255\n\n16', { from: 10, to: 16, perLine: true })).toBe('ff\n\n10')
    // perLine off treats the whole input as a single number (separators ignored)
    expect(await util.apply('255\n16', { from: 10, to: 16, perLine: false })).toBe('63ac')
  })

  it('throws clear errors on invalid digits, bases and non-integers', () => {
    expect(() => util.apply('xyz', { from: 10, to: 16 })).toThrow(/not a valid digit in base 10/)
    expect(() => util.apply('2', { from: 2, to: 10 })).toThrow(/not a valid digit in base 2/)
    expect(() => util.apply('10', { from: 10, to: 64 })).toThrow(/between 2 and 36/)
    expect(() => util.apply('10', { from: 1, to: 10 })).toThrow(/between 2 and 36/)
    expect(() => util.apply('3.5', { from: 10, to: 2 })).toThrow(/whole numbers/)
    expect(() => util.apply('-', { from: 10, to: 2 })).toThrow(/is not a number/)
  })

  it('rejects non-ASCII digit shapes with a clear message', () => {
    // Arabic-Indic and full-width digits are not accepted as base digits
    expect(() => util.apply('٣٤٥', { from: 10, to: 16 })).toThrow(/not a valid digit/)
    expect(() => util.apply('２５５', { from: 10, to: 16 })).toThrow(/not a valid digit/)
    // an emoji must not be silently truncated into surrogate halves
    expect(() => util.apply('1😀0', { from: 10, to: 16 })).toThrow(/"😀" is not a valid digit/)
  })
})
