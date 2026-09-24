import { describe, it, expect } from 'vitest'
import util, { expandCharset } from './index'

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'

/**
 * Printable ASCII punctuation, derived from code-point ranges rather than
 * copied from the implementation's own literal — so a symbol accidentally
 * dropped from (or added to) the preset table is actually detectable.
 */
const PUNCTUATION = (() => {
  let s = ''
  for (const [lo, hi] of [[0x21, 0x2f], [0x3a, 0x40], [0x5b, 0x60], [0x7b, 0x7e]])
    for (let c = lo; c <= hi; c++) s += String.fromCharCode(c)
  return s
})()

const sorted = (s: string) => Array.from(s).sort().join('')

/**
 * The exact set of characters a preset can emit. The sample is seeded (so the
 * test is deterministic) and long enough that every member of even the 94-char
 * `all` set is drawn — which makes this an equality check in both directions:
 * nothing outside the set is emitted, and nothing inside it is unreachable.
 */
const reachable = async (charset: string) =>
  sorted([...new Set(String(await util.apply('', { charset, length: 4000, seed: 1 })))].join(''))

describe('random_string', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('random_string')
    expect(util.name).toBe('random string')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('generates a 16-character alphanumeric string by default', async () => {
    const out = String(await util.apply('', {}))
    expect(out).toHaveLength(16)
    expect(out).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(String(await util.apply('', {}))).not.toBe(out)
  })

  it('honours the length option', async () => {
    expect(String(await util.apply('', { length: 32 }))).toHaveLength(32)
    expect(String(await util.apply('', { length: 1 }))).toHaveLength(1)
    expect(await util.apply('', { length: 0 })).toBe('')
  })

  it('emits exactly the documented characters for every preset', async () => {
    expect(PUNCTUATION).toHaveLength(32)
    expect(await reachable('alphanumeric')).toBe(sorted(LOWER + UPPER + DIGITS))
    expect(await reachable('alpha')).toBe(sorted(LOWER + UPPER))
    expect(await reachable('lowercase')).toBe(LOWER)
    expect(await reachable('uppercase')).toBe(UPPER)
    expect(await reachable('numeric')).toBe(DIGITS)
    expect(await reachable('hex')).toBe(sorted(DIGITS + 'abcdef'))
    expect(await reachable('symbols')).toBe(sorted(PUNCTUATION))
    // `all` is every printable ASCII character except the space
    expect(await reachable('all')).toBe(sorted(LOWER + UPPER + DIGITS + PUNCTUATION))
    expect(await reachable('all')).toHaveLength(94)
  })

  it('keeps every preset the right length and inside its own alphabet', async () => {
    for (const charset of ['alphanumeric', 'alpha', 'lowercase', 'uppercase', 'numeric', 'hex', 'symbols', 'all']) {
      const out = String(await util.apply('', { charset, length: 64 }))
      expect(out).toHaveLength(64)
      expect(out).toMatch(/^[\x21-\x7e]{64}$/)
    }
  })

  it('supports a custom character set with ranges', async () => {
    expect(expandCharset('a-d').join('')).toBe('abcd')
    expect(expandCharset('ab-d').join('')).toBe('abcd')
    expect(String(await util.apply('', { charset: 'custom', custom: '01', length: 20 }))).toMatch(/^[01]{20}$/)
    expect(await util.apply('', { charset: 'custom', custom: 'ab-d', length: 8, seed: 5 })).toBe('adcbdadd')
  })

  it('keeps astral characters whole in a custom set', async () => {
    const out = String(await util.apply('', { charset: 'custom', custom: '🎲🎯', length: 10 }))
    const points = Array.from(out)
    expect(points).toHaveLength(10)
    expect(points.every(c => '🎲🎯'.includes(c))).toBe(true)
    expect(out).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })

  it('generates count strings, one per line', async () => {
    const lines = String(await util.apply('', { count: 4 })).split('\n')
    expect(lines).toHaveLength(4)
    expect(new Set(lines).size).toBe(4)
    for (const line of lines) expect(line).toHaveLength(16)
  })

  it('is reproducible with a non-zero seed', async () => {
    expect(await util.apply('', { seed: 42 })).toBe('KESvO50HW7tfduFu')
    expect(await util.apply('', { seed: 123, charset: 'hex', length: 8 })).toBe('87ef12f2')
    expect(await util.apply('', { seed: 9, charset: 'all', length: 12 })).toBe('k[w!xzkFH4O@')
    expect(await util.apply('', { seed: 43 })).not.toBe(await util.apply('', { seed: 42 }))
    // a negative seed is still a seed, not a fall-through to crypto randomness
    expect(await util.apply('', { seed: -7 })).toBe(await util.apply('', { seed: -7 }))
    // seed 0 is the documented "use real randomness" switch
    expect(await util.apply('', { seed: 0 })).not.toBe(await util.apply('', { seed: 0 }))
  })

  it('ignores its input, including unicode and empty input', async () => {
    expect(String(await util.apply('', {}))).toMatch(/^[A-Za-z0-9]{16}$/)
    expect(String(await util.apply('🎲 über 日本語', {}))).toMatch(/^[A-Za-z0-9]{16}$/)
  })

  it('throws on an empty custom set, a bad range or out-of-range options', () => {
    expect(() => util.apply('', { charset: 'custom', custom: '' })).toThrow(/custom character set is empty/)
    expect(() => util.apply('', { charset: 'custom', custom: 'z-a' })).toThrow(/invalid character range/)
    expect(() => util.apply('', { charset: 'base64' })).toThrow(/unknown character set/)
    expect(() => util.apply('', { length: -1 })).toThrow(/length must be 0 or more/)
    expect(() => util.apply('', { length: 5000 })).toThrow(/length must be 4096 or less/)
    expect(() => util.apply('', { count: 0 })).toThrow(/count must be at least 1/)
    expect(() => util.apply('', { count: 10001 })).toThrow(/count must be 10000 or less/)
    expect(() => util.apply('', { length: 4000, count: 500 })).toThrow(/length x count must be 1000000 or less/)
  })
})
