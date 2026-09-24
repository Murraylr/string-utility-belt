import { describe, it, expect } from 'vitest'
import util, { STYLES } from './index'

const cp = (...codes: number[]) => String.fromCodePoint(...codes)
const run = async (text: string, params: Record<string, unknown> = {}) =>
  (await util.apply(text, params)) as string

describe('unicode_style', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('unicode_style')
    expect(util.name).toBe('unicode text style')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['intensity', 'seed', 'style'])
    expect(STYLES).toHaveLength(18)
  })

  it('exposes zalgo intensity as a bounded range param', () => {
    expect(util.params.intensity.kind).toBe('range')
    const p = util.params.intensity as { min: number; max: number; default?: number }
    expect(p.min).toBe(0)
    expect(p.max).toBe(200)
    expect(p.default).toBe(3)
  })

  it('defaults to fullwidth', async () => {
    expect(await run('Hi 1')).toBe(cp(0xff28, 0xff49, 0x3000, 0xff11))
  })

  it('maps the mathematical alphanumeric styles, holes included', async () => {
    expect(await run('aA0', { style: 'bold' })).toBe(cp(0x1d41a, 0x1d400, 0x1d7ce))
    expect(await run('ha', { style: 'italic' })).toBe(cp(0x210e, 0x1d44e))
    expect(await run('aB', { style: 'bold-italic' })).toBe(cp(0x1d482, 0x1d469))
    expect(await run('aZ9', { style: 'monospace' })).toBe(cp(0x1d68a, 0x1d689, 0x1d7ff))
    expect(await run('Hello', { style: 'script' }))
      .toBe(cp(0x210b, 0x212f, 0x1d4c1, 0x1d4c1, 0x2134))
    expect(await run('CZa', { style: 'fraktur' })).toBe(cp(0x212d, 0x2128, 0x1d51e))
    expect(await run('R7', { style: 'double-struck' })).toBe(cp(0x211d, 0x1d7df))
  })

  it('maps the enclosed and fullwidth styles', async () => {
    expect(await run('aA05', { style: 'bubble' })).toBe(cp(0x24d0, 0x24b6, 0x24ea, 0x2464))
    expect(await run('aA03', { style: 'bubble-filled' })).toBe(cp(0x1f150, 0x1f150, 0x24ff, 0x278c))
    expect(await run('ab9', { style: 'square' })).toBe(cp(0x1f130, 0x1f131) + '9')
  })

  it('maps the small-caps, superscript and subscript tables', async () => {
    expect(await run('abx', { style: 'small-caps' })).toBe(cp(0x1d00, 0x0299) + 'x')
    // capitals fold into the same small-cap forms — the style must not no-op
    expect(await run('ABX', { style: 'small-caps' })).toBe(cp(0x1d00, 0x0299) + 'x')
    expect(await run('Hello World', { style: 'small-caps' })).toBe(
      cp(0x029c, 0x1d07, 0x029f, 0x029f, 0x1d0f) + ' ' + cp(0x1d21, 0x1d0f, 0x0280, 0x029f, 0x1d05)
    )
    expect(await run('a2AC', { style: 'superscript' })).toBe(cp(0x1d43, 0x00b2, 0x1d2c, 0x1d9c))
    expect(await run('a2z', { style: 'subscript' })).toBe(cp(0x2090, 0x2082) + 'z')
  })

  it('flips and reverses for upside-down', async () => {
    expect(await run('abc', { style: 'upside-down' })).toBe(cp(0x0254) + 'q' + cp(0x0250))
    expect(await run('Hi!', { style: 'upside-down' })).toBe(cp(0x00a1, 0x1d09) + 'H')
  })

  it('flips upside-down line by line so line endings survive', async () => {
    // both lines are reversed and they swap places, but the newline stays a newline
    expect(await run('ab\ncd', { style: 'upside-down' })).toBe('p' + cp(0x0254) + '\nq' + cp(0x0250))
    // a CRLF must not come back as LF CR, which is what reversing the whole
    // string in one pass would produce
    expect(await run('ab\r\ncd', { style: 'upside-down' })).toBe('p' + cp(0x0254) + '\nq' + cp(0x0250))
    expect(await run('a\u{1F600}b', { style: 'upside-down' })).toBe('q\u{1F600}' + cp(0x0250))
  })

  it('leaves characters outside a style table untouched', async () => {
    expect(await run('a-1!', { style: 'bold' })).toBe(cp(0x1d41a) + '-' + cp(0x1d7cf) + '!')
    expect(await run('a-1!', { style: 'script' })).toBe(cp(0x1d4b6) + '-1!')
    expect(await run('こa', { style: 'fullwidth' })).toBe('こ' + cp(0xff41))
  })

  it('appends combining marks for strikethrough and underline', async () => {
    const strike = cp(0x0336)
    const under = cp(0x0332)
    expect(await run('ab', { style: 'strikethrough' })).toBe(`a${strike}b${strike}`)
    expect(await run('a\nb', { style: 'underline' })).toBe(`a${under}\nb${under}`)
  })

  it('leaves astral characters intact in every style', async () => {
    for (const style of STYLES) {
      const out = await run('\u{1F600}a', { style, seed: 7 })
      expect(Array.from(out).includes('\u{1F600}'), style).toBe(true)
    }
    expect(await run('\u{1F600}a', { style: 'bold' })).toBe('\u{1F600}' + cp(0x1d41a))
  })

  it('honours zalgo intensity and seed deterministically', async () => {
    expect(await run('zalgo', { style: 'zalgo', intensity: 0 })).toBe('zalgo')
    const a = await run('zalgo', { style: 'zalgo', intensity: 3, seed: 42 })
    const b = await run('zalgo', { style: 'zalgo', intensity: 3, seed: 42 })
    const c = await run('zalgo', { style: 'zalgo', intensity: 3, seed: 99 })
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a.length).toBeGreaterThan('zalgo'.length)
    const loud = await run('zalgo', { style: 'zalgo', intensity: 12, seed: 42 })
    expect(loud.length).toBeGreaterThan(a.length)
    // seed 0 derives its seed from the text, so it is still stable per input
    expect(await run('zalgo', { style: 'zalgo' })).toBe(await run('zalgo', { style: 'zalgo' }))
    expect(a.replace(new RegExp('[\\u0300-\\u036F]', 'g'), '')).toBe('zalgo')
  })

  it('handles empty input for every style', async () => {
    for (const style of STYLES) expect(await util.apply('', { style })).toBe('')
  })

  it('throws on an unknown style or a bad intensity', () => {
    expect(() => util.apply('hi', { style: 'wingdings' })).toThrow(/unknown style/)
    expect(() => util.apply('hi', { style: 'zalgo', intensity: -1 })).toThrow(/intensity/)
    expect(() => util.apply('hi', { style: 'zalgo', intensity: 'loud' })).toThrow(/intensity/)
    expect(() => util.apply('hi', { style: 'zalgo', seed: 'abc' })).toThrow(/seed/)
    // each unit of intensity is more combining marks per character, so a huge
    // value must be refused rather than allocated
    expect(() => util.apply('hi', { style: 'zalgo', intensity: 1e9 })).toThrow(/200 or less/)
  })
})
