import { describe, it, expect } from 'vitest'
import util from './index'

describe('number_sequence', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('number_sequence')
    expect(util.name).toBe('number sequence')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('generates the default 1..10 sequence and ignores the input', async () => {
    const expected = '1\n2\n3\n4\n5\n6\n7\n8\n9\n10'
    expect(await util.apply('', {})).toBe(expected)
    expect(await util.apply('anything at all', {})).toBe(expected)
    // the declared default must produce the same newline separation as an absent param
    const declared = Object.fromEntries(
      Object.entries(util.params).map(([k, s]) => [k, (s as { default?: unknown }).default])
    )
    expect(await util.apply('', declared)).toBe(expected)
  })

  it('ignores non-ASCII input entirely', async () => {
    expect(await util.apply('🎉 héllo 日本語', { start: 1, end: 3 })).toBe('1\n2\n3')
  })

  it('counts down with a negative step', async () => {
    expect(await util.apply('', { start: 10, end: 1, step: -3 })).toBe('10\n7\n4\n1')
    expect(await util.apply('', { start: 5, end: 5, step: 1 })).toBe('5')
    expect(await util.apply('', { start: 5, end: 5, step: -1 })).toBe('5')
    expect(await util.apply('', { start: 2, end: -2, step: -1, separator: ' ' })).toBe('2 1 0 -1 -2')
  })

  it('stops at or before end, never past it', async () => {
    // step does not divide the span evenly
    expect(await util.apply('', { start: 1, end: 10, step: 4, separator: ' ' })).toBe('1 5 9')
    expect(await util.apply('', { start: 0, end: 10, step: 3, separator: ' ' })).toBe('0 3 6 9')
    expect(await util.apply('', { start: 10, end: 0, step: -4, separator: ' ' })).toBe('10 6 2')
    expect(String(await util.apply('', { start: 1, end: 1000 })).split('\n')).toHaveLength(1000)
  })

  it('applies pad, prefix, suffix and separator', async () => {
    expect(
      await util.apply('', { start: 1, end: 3, pad: 3, prefix: 'item-', suffix: '.txt', separator: ', ' })
    ).toBe('item-001.txt, item-002.txt, item-003.txt')
    // a pad narrower than the number must not truncate it
    expect(await util.apply('', { start: 998, end: 1001, pad: 2, separator: ',' })).toBe('998,999,1000,1001')
  })

  it('decodes escape sequences in the separator', async () => {
    expect(await util.apply('', { start: 1, end: 3, separator: '\\t' })).toBe('1\t2\t3')
    expect(await util.apply('', { start: 1, end: 2, separator: '\\n' })).toBe('1\n2')
    expect(await util.apply('', { start: 1, end: 2, separator: '\\r' })).toBe('1\r2')
    expect(await util.apply('', { start: 1, end: 2, separator: '\\\\' })).toBe('1\\2')
    expect(await util.apply('', { start: 1, end: 2, separator: ' -> ' })).toBe('1 -> 2')
    expect(await util.apply('', { start: 1, end: 2, separator: '' })).toBe('12')
  })

  it('supports other radixes and agrees with Number.prototype.toString', async () => {
    expect(await util.apply('', { start: 250, end: 255, radix: 16 })).toBe('fa\nfb\nfc\nfd\nfe\nff')
    expect(await util.apply('', { start: 0, end: 4, radix: 2, pad: 4, separator: ' ' }))
      .toBe('0000 0001 0010 0011 0100')
    expect(await util.apply('', { start: 33, end: 36, radix: 36, separator: ' ' })).toBe('x y z 10')
    for (const radix of [2, 8, 16, 36]) {
      const out = String(await util.apply('', { start: 0, end: 40, radix, separator: ',' })).split(',')
      expect(out).toEqual(Array.from({ length: 41 }, (_, i) => i.toString(radix)))
    }
    // the sign goes outside the digits, so padding never swallows it
    expect(await util.apply('', { start: -20, end: -18, radix: 16, pad: 3, separator: ' ' }))
      .toBe('-014 -013 -012')
  })

  it('keeps fractional steps exact and pads negatives after the sign', async () => {
    expect(await util.apply('', { start: 0, end: 1, step: 0.25, separator: ' ' }))
      .toBe('0.00 0.25 0.50 0.75 1.00')
    // 0.1 steps are the classic float-drift case: 0.7/0.1 is 6.999999999999999
    expect(await util.apply('', { start: 0, end: 0.7, step: 0.1, separator: ' ' }))
      .toBe('0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7')
    expect(await util.apply('', { start: 0, end: 1, step: 0.1, separator: ' ' }))
      .toBe('0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.0')
    expect(await util.apply('', { start: -1, end: 1, step: 0.5, separator: ' ' }))
      .toBe('-1.0 -0.5 0.0 0.5 1.0')
    expect(await util.apply('', { start: -2, end: 2, pad: 3, separator: ' ' }))
      .toBe('-002 -001 000 001 002')
  })

  it('rejects impossible or unsafe configurations', () => {
    expect(() => util.apply('', { step: 0 })).toThrow(/step must not be zero/)
    expect(() => util.apply('', { start: 1, end: 10, step: -1 })).toThrow(/moves away from end/)
    expect(() => util.apply('', { start: 10, end: 1, step: 1 })).toThrow(/moves away from end/)
    expect(() => util.apply('', { radix: 1 })).toThrow(/radix must be between 2 and 36/)
    expect(() => util.apply('', { radix: 37 })).toThrow(/radix must be between 2 and 36/)
    expect(() => util.apply('', { start: 0, end: 1, step: 0.5, radix: 2 })).toThrow(/requires whole numbers/)
    expect(() => util.apply('', { start: 1, end: 1e9 })).toThrow(/limit 100000/)
    expect(() => util.apply('', { pad: -1 })).toThrow(/zero pad width/)
    expect(() => util.apply('', { start: 'x' })).toThrow(/must be finite numbers/)
  })
})
