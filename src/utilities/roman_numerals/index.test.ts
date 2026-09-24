import { describe, it, expect } from 'vitest'
import util from './index'

/** Independent greedy reference for the subtractive canonical form. */
const refRoman = (n: number): string => {
  const table: Array<[number, string]> = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ]
  let rest = n
  let out = ''
  for (const [value, symbol] of table) {
    while (rest >= value) { out += symbol; rest -= value }
  }
  return out
}

describe('roman_numerals', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('roman_numerals')
    expect(util.name).toBe('roman numerals')
    expect(util.category).toBe('Numbers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['direction', 'perLine'])
    expect(util.params.direction).toMatchObject({ kind: 'select', default: 'to-roman' })
    expect(util.params.perLine).toMatchObject({ kind: 'boolean', default: true })
  })

  it('matches published vectors on to-roman (default direction)', async () => {
    const vectors: Array<[string, string]> = [
      ['1', 'I'], ['4', 'IV'], ['9', 'IX'], ['14', 'XIV'], ['40', 'XL'], ['90', 'XC'],
      ['400', 'CD'], ['900', 'CM'], ['1000', 'M'], ['1666', 'MDCLXVI'], ['1954', 'MCMLIV'],
      ['1990', 'MCMXC'], ['1994', 'MCMXCIV'], ['2014', 'MMXIV'], ['2024', 'MMXXIV'],
      ['2421', 'MMCDXXI'], ['3888', 'MMMDCCCLXXXVIII'], ['3999', 'MMMCMXCIX']
    ]
    for (const [arabic, expected] of vectors) {
      expect(await util.apply(arabic, {}), arabic).toBe(expected)
    }
    expect(await util.apply('1,066', {})).toBe('MLXVI')
  })

  it('matches published vectors on to-arabic', async () => {
    expect(await util.apply('MCMXCIV', { direction: 'to-arabic' })).toBe('1994')
    expect(await util.apply('IV', { direction: 'to-arabic' })).toBe('4')
    expect(await util.apply('MMMCMXCIX', { direction: 'to-arabic' })).toBe('3999')
    expect(await util.apply('mmxxiv', { direction: 'to-arabic' })).toBe('2024')
    expect(await util.apply('M.C.M.', { direction: 'to-arabic' })).toBe('1900')
  })

  it('produces the canonical form and round-trips for all of 1..3999', async () => {
    const wrong: string[] = []
    for (let n = 1; n <= 3999; n++) {
      const roman = await util.apply(String(n), {}) as string
      if (roman !== refRoman(n)) wrong.push(`${n} -> ${roman}, want ${refRoman(n)}`)
      const back = await util.apply(roman, { direction: 'to-arabic' })
      if (back !== String(n)) wrong.push(`${roman} -> ${back}, want ${n}`)
    }
    expect(wrong).toEqual([])
  })

  it('accepts exactly the canonical numerals and nothing else (brute force to 4 letters)', () => {
    const canonical = new Set<string>()
    for (let n = 1; n <= 3999; n++) canonical.add(refRoman(n))
    const wrong: string[] = []
    const walk = (prefix: string, depth: number) => {
      if (prefix) {
        let accepted = true
        try { util.apply(prefix, { direction: 'to-arabic' }) } catch { accepted = false }
        if (accepted !== canonical.has(prefix)) wrong.push(`${prefix} accepted=${accepted}`)
      }
      if (depth === 0) return
      for (const c of 'IVXLCDM') walk(prefix + c, depth - 1)
    }
    walk('', 4)
    expect(wrong).toEqual([])
  })

  it('accepts Unicode Number Forms on to-arabic', async () => {
    expect(await util.apply('Ⅻ', { direction: 'to-arabic' })).toBe('12')
    expect(await util.apply('ⅳ', { direction: 'to-arabic' })).toBe('4')
    expect(await util.apply('ⅯⅭⅯ', { direction: 'to-arabic' })).toBe('1900')
    expect(await util.apply('Ⅹ Ⅳ', { direction: 'to-arabic' })).toBe('14')
    // astral-safe: iterating by code point leaves an emoji whole rather than
    // splitting it into surrogate halves that might look like numeral letters
    expect(() => util.apply('🍎', { direction: 'to-arabic' })).toThrow(/invalid roman numeral/)
  })

  it('honours perLine in both states', async () => {
    expect(await util.apply('1\n2\n3', { perLine: true })).toBe('I\nII\nIII')
    expect(await util.apply('IX\n\nXI', { direction: 'to-arabic', perLine: true })).toBe('9\n\n11')
    expect(await util.apply('  7  ', { perLine: true })).toBe('  VII  ')
    expect(await util.apply('  7  ', { perLine: false })).toBe('  VII  ')
    expect(() => util.apply('1\n2', { perLine: false })).toThrow(/not a whole number/)
  })

  it('returns empty input untouched', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { direction: 'to-arabic' })).toBe('')
    expect(await util.apply('   ', { direction: 'to-arabic' })).toBe('   ')
  })

  it('rejects non-strict roman forms', () => {
    for (const bad of ['IIII', 'VV', 'IC', 'IL', 'XD', 'MMMM', 'XIIX', 'IXX', 'VX', 'LL', 'DD', 'CCCC', 'XXXX', 'MCMC', 'banana']) {
      expect(() => util.apply(bad, { direction: 'to-arabic' }), bad).toThrow(/invalid roman numeral/)
    }
    expect(() => util.apply('...', { direction: 'to-arabic' })).toThrow(/not a roman numeral/)
  })

  it('rejects out-of-range, non-numeric and badly grouped input on to-roman', () => {
    expect(() => util.apply('0', {})).toThrow(/roman numerals cover 1-3999/)
    expect(() => util.apply('4000', {})).toThrow(/roman numerals cover 1-3999/)
    expect(() => util.apply('-5', {})).toThrow(/roman numerals cover 1-3999/)
    expect(() => util.apply('−5', {})).toThrow(/roman numerals cover 1-3999/)
    expect(() => util.apply('3.5', {})).toThrow(/not a whole number/)
    expect(() => util.apply('abc', {})).toThrow(/not a whole number/)
    // digit-group separators are only honoured for well-formed 3-digit groups,
    // so "1 0" must not quietly become 10
    expect(() => util.apply('1 0', {})).toThrow(/not a whole number/)
    expect(() => util.apply('1,0,6,6', {})).toThrow(/not a whole number/)
    expect(() => util.apply('1', { direction: 'sideways' })).toThrow(/unknown direction/)
  })
})
