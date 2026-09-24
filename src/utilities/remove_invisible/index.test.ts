import { describe, it, expect } from 'vitest'
import util, { isInvisible, nameOf } from './index'

type Entry = { codePoint: string; name: string; index: number }

const CP = (n: number) => String.fromCodePoint(n)

const run = (input: string, params: Record<string, unknown> = {}) =>
  util.apply(input, params) as unknown as Promise<string | Entry[]> | string | Entry[]

describe('remove_invisible', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('remove_invisible')
    expect(util.name).toBe('invisible characters')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params)).toEqual(['mode'])
  })

  it('removes zero-width, bom, soft hyphen and bidi controls by default', async () => {
    expect(await run('he\u200Bllo\uFEFF')).toBe('hello')
    expect(await run('sof\u00ADt hyphen')).toBe('soft hyphen')
    expect(await run('\u202Eevil\u202C text')).toBe('evil text')
    expect(await run('zero\u200Dwidth\u2060joiner')).toBe('zerowidthjoiner')
  })

  it('removes control characters but keeps tab, newline and carriage return', async () => {
    expect(await run('a' + CP(0x00) + 'b' + CP(0x07) + 'c')).toBe('abc')
    expect(await run('col1\tcol2\r\nrow')).toBe('col1\tcol2\r\nrow')
    expect(await run('esc\u001B[31m')).toBe('esc[31m')
  })

  it('handles empty input for every mode', async () => {
    expect(await run('')).toBe('')
    expect(await run('', { mode: 'reveal' })).toBe('')
    expect(await run('', { mode: 'list' })).toEqual([])
  })

  it('reveals invisibles as visible markers', async () => {
    expect(await run('a\u200Bb', { mode: 'reveal' })).toBe('a‹U+200B›b')
    expect(await run('\uFEFFstart', { mode: 'reveal' })).toBe('‹U+FEFF›start')
    expect(await run('plain text', { mode: 'reveal' })).toBe('plain text')
    expect(await run('a' + CP(0x00) + CP(0x1b) + 'b', { mode: 'reveal' })).toBe('a‹U+0000›‹U+001B›b')
    expect(await run(CP(0x1f3f4) + CP(0xe0067), { mode: 'reveal' })).toBe(CP(0x1f3f4) + '‹U+E0067›')
  })

  it('leaves visible spacing alone: nbsp and em space are not invisible junk', async () => {
    const spaced = 'a' + CP(0xa0) + 'b' + CP(0x2003) + 'c' + CP(0x3000) + 'd'
    expect(await run(spaced)).toBe(spaced)
    expect(await run(spaced, { mode: 'reveal' })).toBe(spaced)
    expect(await run(spaced, { mode: 'list' })).toEqual([])
  })

  it('lists invisibles with name and code-point index', async () => {
    const list = (await run('a\u200Bb\u00ADc', { mode: 'list' })) as Entry[]
    expect(list).toEqual([
      { codePoint: 'U+200B', name: 'ZERO WIDTH SPACE', index: 1 },
      { codePoint: 'U+00AD', name: 'SOFT HYPHEN', index: 3 }
    ])
    expect(Array.isArray(list)).toBe(true)
  })

  it('counts indexes in code points so astral characters are not double counted', async () => {
    const list = (await run('\u{1F600}\u200Bx', { mode: 'list' })) as Entry[]
    expect(list).toEqual([{ codePoint: 'U+200B', name: 'ZERO WIDTH SPACE', index: 1 }])
    expect(await run('\u{1F600}\u200Bx')).toBe('\u{1F600}x')
    expect(Array.from(await run('\u{1F600}\u200Bx') as string).length).toBe(2)
  })

  it('handles variation selectors and tag characters', async () => {
    // the whole england flag tag sequence collapses back to the base waving black flag
    expect(await run(CP(0x1f3f4) + CP(0xe0067) + CP(0xe0062) + CP(0xe007f))).toBe(CP(0x1f3f4))
    expect(await run(CP(0x61c) + 'x' + CP(0x180e), { mode: 'list' })).toEqual([
      { codePoint: 'U+061C', name: 'ARABIC LETTER MARK', index: 0 },
      { codePoint: 'U+180E', name: 'MONGOLIAN VOWEL SEPARATOR', index: 2 }
    ])
    expect(await run('❤\uFE0F')).toBe('❤')
    const list = (await run('x\uFE0F', { mode: 'list' })) as Entry[]
    expect(list[0]).toEqual({ codePoint: 'U+FE0F', name: 'VARIATION SELECTOR-16', index: 1 })
  })

  it('leaves ordinary unicode text untouched', async () => {
    expect(await run('日本語 café — naïve 🎉')).toBe('日本語 café — naïve 🎉')
    expect(await run('日本語 🎉', { mode: 'list' })).toEqual([])
  })

  it('exposes a usable classifier and name table', () => {
    expect(isInvisible(0x200b)).toBe(true)
    expect(isInvisible(0x0a)).toBe(false)
    expect(isInvisible(0x41)).toBe(false)
    expect(nameOf(0x0000)).toBe('NULL')
    expect(nameOf(0xe0041)).toBe('TAG A')
  })

  it('throws on an unknown mode', async () => {
    await expect(async () => run('x', { mode: 'bogus' })).rejects.toThrow(/unknown mode/)
    await expect(async () => run('x', { mode: 7 })).rejects.toThrow(/unknown mode/)
  })
})
