import { describe, it, expect } from 'vitest'
import util from './index'

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])/

describe('alternating_case', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('alternating_case')
    expect(util.name).toBe('alternating case')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['startUpper', 'skipNonLetters'])
  })

  it('alternates starting lowercase by default', async () => {
    expect(await util.apply('hello world', {})).toBe('hElLo WoRlD')
    expect(await util.apply('SPONGEBOB', {})).toBe('sPoNgEbOb')
  })

  it('starts uppercase when startUpper is true', async () => {
    expect(await util.apply('hello world', { startUpper: true })).toBe('HeLlO wOrLd')
  })

  it('lets non-letters take a turn when skipNonLetters is false', async () => {
    expect(await util.apply('hello world', { skipNonLetters: false })).toBe('hElLo wOrLd')
    expect(await util.apply('hello world', { startUpper: true, skipNonLetters: false })).toBe('HeLlO WoRlD')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { startUpper: true, skipNonLetters: false })).toBe('')
  })

  it('falls back to the declared defaults for unset params', async () => {
    expect(await util.apply('hello world', { startUpper: '', skipNonLetters: '' })).toBe('hElLo WoRlD')
    expect(await util.apply('hello world', { startUpper: undefined })).toBe('hElLo WoRlD')
  })

  it('alternates non-ASCII letters and leaves digits alone', async () => {
    expect(await util.apply('über', {})).toBe('üBeR')
    expect(await util.apply('привет', { startUpper: true })).toBe('ПрИвЕт')
    expect(await util.apply('a1b2c3', {})).toBe('a1B2c3')
  })

  it('keeps astral characters intact and treats them as non-letters', async () => {
    const out = String(await util.apply('a\u{1F44D}b', {}))
    expect(out).toBe('a\u{1F44D}B')
    expect(LONE_SURROGATE.test(out)).toBe(false)
  })

  it('is idempotent for the same options and never throws', async () => {
    const once = String(await util.apply('Mixed Case Input!', {}))
    expect(await util.apply(once, {})).toBe(once)
    expect(() => util.apply('!!! ???', {})).not.toThrow()
    expect(await util.apply('!!! ???', {})).toBe('!!! ???')
  })
})
