import { describe, it, expect } from 'vitest'
import util from './index'

const CP = (n: number) => String.fromCodePoint(n)

const run = (input: string, params: Record<string, unknown> = {}) =>
  util.apply(input, params) as Promise<string> | string

describe('strip_chars', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('strip_chars')
    expect(util.name).toBe('strip characters')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['type', 'custom', 'invert', 'replaceWith'])
  })

  it('strips punctuation by default', async () => {
    expect(await run("Hello, world! It's #1.")).toBe('Hello world Its 1')
    expect(await run('¿Qué tal? — bien…')).toBe('Qué tal  bien')
  })

  it('returns empty string for empty input', async () => {
    expect(await run('')).toBe('')
    expect(await run('', { type: 'non-ascii' })).toBe('')
    expect(await run('', { type: 'emoji' })).toBe('')
    // empty input must never throw, even when the custom set has not been filled in yet
    expect(await run('', { type: 'custom', custom: '' })).toBe('')
  })

  it('strips digits, letters and whitespace', async () => {
    expect(await run('a1b2 c3', { type: 'digits' })).toBe('ab c')
    expect(await run('٣ and 42', { type: 'digits' })).toBe(' and ')
    expect(await run('a1b2', { type: 'letters' })).toBe('12')
    expect(await run('naïve 1', { type: 'letters' })).toBe(' 1')
    expect(await run('a b\tc\nd e', { type: 'whitespace' })).toBe('abcde')
  })

  it('strips non-alphanumeric, non-ascii and non-printable', async () => {
    expect(await run('Hello, wörld! 42', { type: 'non-alphanumeric' })).toBe('Hellowörld42')
    expect(await run('café ☕ ok', { type: 'non-ascii' })).toBe('caf  ok')
    expect(await run('a\u0000b\u0007c\u200Bd\te', { type: 'non-printable' })).toBe('abcd\te')
  })

  it('strips whole emoji clusters without breaking surrogates', async () => {
    expect(await run('hi \u{1F468}\u200D\u{1F469}\u200D\u{1F467} there', { type: 'emoji' })).toBe('hi  there')
    expect(await run('flag \u{1F1FA}\u{1F1F8} end', { type: 'emoji' })).toBe('flag  end')
    expect(await run('wave \u{1F44B}\u{1F3FD}!', { type: 'emoji' })).toBe('wave !')
  })

  it('keeps astral characters intact when stripping other classes', async () => {
    expect(await run('\u{1F389}42\u{1F389}', { type: 'digits' })).toBe('\u{1F389}\u{1F389}')
    expect(Array.from(await run('\u{1F389}42\u{1F389}', { type: 'digits' })).length).toBe(2)
  })

  it('strips a custom character set', async () => {
    expect(await run('a-b_c/d', { type: 'custom', custom: '-_/' })).toBe('abcd')
    expect(await run('él niño', { type: 'custom', custom: 'ñé' })).toBe('l nio')
  })

  it('inverts to keep only the matched characters', async () => {
    expect(await run('a1b2!', { type: 'letters', invert: true })).toBe('ab')
    expect(await run('phone: +1 555-0100', { type: 'digits', invert: true })).toBe('15550100')
    expect(await run('a-b_c', { type: 'custom', custom: '-_', invert: true })).toBe('-_')
    // inverted emoji keeps whole clusters: skin tone and flag stay glued to their base
    expect(await run('a \u{1F44B}\u{1F3FD} b \u{1F1FA}\u{1F1F8}', { type: 'emoji', invert: true }))
      .toBe('\u{1F44B}\u{1F3FD}\u{1F1FA}\u{1F1F8}')
    expect(await run('a' + CP(0x07) + 'b' + CP(0x200c) + 'c', { type: 'non-printable', invert: true }))
      .toBe(CP(0x07) + CP(0x200c))
  })

  it('replaces instead of deleting when replaceWith is set', async () => {
    expect(await run('a1b2', { type: 'digits', replaceWith: '#' })).toBe('a#b#')
    expect(await run('one two', { type: 'whitespace', replaceWith: '_' })).toBe('one_two')
    expect(await run('hi \u{1F600}', { type: 'emoji', replaceWith: ':)' })).toBe('hi :)')
  })

  it('throws on an unknown type or an empty custom set', async () => {
    await expect(async () => run('x', { type: 'bogus' })).rejects.toThrow(/unknown strip type/)
    await expect(async () => run('x', { type: 'custom' })).rejects.toThrow(/custom character set is empty/)
    await expect(async () => run('x', { type: 'custom', custom: '' })).rejects.toThrow()
  })
})
