import { describe, it, expect } from 'vitest'
import util from './index'

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/

describe('swap_case', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('swap_case')
    expect(util.name).toBe('swap case')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('swaps a realistic sentence', async () => {
    expect(await util.apply('Hello World', {})).toBe('hELLO wORLD')
    expect(await util.apply('The Quick Brown Fox.', {})).toBe('tHE qUICK bROWN fOX.')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
  })

  it('is its own inverse for simple ASCII', async () => {
    const input = 'MiXeD cAsE tExT'
    expect(await util.apply(await util.apply(input, {}), {})).toBe(input)
  })

  it('swaps accented and non-Latin letters', async () => {
    expect(await util.apply('Ünïcödé', {})).toBe('üNÏCÖDÉ')
    expect(await util.apply('Привет', {}))
      .toBe('пРИВЕТ')
  })

  it('upcases sharp s to SS, matching Unicode case mapping', async () => {
    expect(await util.apply('straße', {})).toBe('STRASSE')
  })

  it('leaves digits, punctuation, and emoji untouched', async () => {
    expect(await util.apply('a1!\u{1F44D}B', {})).toBe('A1!\u{1F44D}b')
    const out = String(await util.apply('\u{1F468}\u200d\u{1F680}x', {}))
    expect(out).toBe('\u{1F468}\u200d\u{1F680}X')
    expect(LONE_SURROGATE.test(out)).toBe(false)
  })

  it('does not throw on whitespace or invisible characters', async () => {
    expect(() => util.apply('\u200b\t\n \ufeff', {})).not.toThrow()
    expect(await util.apply('\u200b\t\n \ufeff', {})).toBe('\u200b\t\n \ufeff')
  })
})
