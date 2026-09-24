import { describe, it, expect } from 'vitest'
import util, { GLYPHS, FONTS } from './index'

const B = '█' // full block
const T = '▀' // upper half block
const L = '▄' // lower half block

const run = async (text: string, params: Record<string, unknown> = {}) =>
  (await util.apply(text, params)) as string

describe('ascii_banner', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('ascii_banner')
    expect(util.name).toBe('ascii banner')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['font', 'spacing'])
  })

  it('has a well-formed 5x7 bitmap for every glyph', () => {
    const keys = Object.keys(GLYPHS)
    expect(keys.length).toBeGreaterThan(60)
    for (const key of keys) {
      const rows = GLYPHS[key].split('/')
      expect(rows, key).toHaveLength(7)
      for (const row of rows) {
        expect(row.length, `${key} row width`).toBe(5)
        expect(/^[.#]{5}$/.test(row), `${key} row charset`).toBe(true)
      }
    }
    for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789') {
      expect(GLYPHS[letter], letter).toBeTruthy()
    }
  })

  it('renders the banner font exactly', async () => {
    expect(await run('A', { font: 'banner' })).toBe(
      [' ###', '#   #', '#   #', '#####', '#   #', '#   #', '#   #'].join('\n')
    )
  })

  it('renders the block font with two columns per pixel', async () => {
    expect(await run('I', { font: 'block' })).toBe(
      [
        '  ' + B.repeat(6),
        '    ' + B.repeat(2),
        '    ' + B.repeat(2),
        '    ' + B.repeat(2),
        '    ' + B.repeat(2),
        '    ' + B.repeat(2),
        '  ' + B.repeat(6)
      ].join('\n')
    )
  })

  it('squeezes two bitmap rows per line in the small font', async () => {
    expect(await run('a', { font: 'small' })).toBe(
      [`${L}${T}${T}${T}${L}`, `${B}${L}${L}${L}${B}`, `${B}   ${B}`, `${T}   ${T}`].join('\n')
    )
    // two glyphs, two columns of gap, and the odd seventh bitmap row half-lit
    expect(await run('ab', { font: 'small', spacing: 2 })).toBe(
      [
        `${L}${T}${T}${T}${L}  ${B}${T}${T}${T}${L}`,
        `${B}${L}${L}${L}${B}  ${B}${L}${L}${L}${T}`,
        `${B}   ${B}  ${B}   ${B}`,
        `${T}   ${T}  ${T}${T}${T}${T}`
      ].join('\n')
    )
  })

  it('shears each row in the slant font', async () => {
    expect(await run('I', { font: 'slant' })).toBe(
      [
        ' '.repeat(8) + B.repeat(6),
        ' '.repeat(9) + B.repeat(2),
        ' '.repeat(8) + B.repeat(2),
        ' '.repeat(7) + B.repeat(2),
        ' '.repeat(6) + B.repeat(2),
        ' '.repeat(5) + B.repeat(2),
        ' '.repeat(2) + B.repeat(6)
      ].join('\n')
    )
  })

  it('honours letter spacing', async () => {
    const tight = (await run('AB', { font: 'banner', spacing: 0 })).split('\n')[3]
    const loose = (await run('AB', { font: 'banner', spacing: 3 })).split('\n')[3]
    expect(tight).toBe('#########')
    expect(loose.length).toBe(tight.length + 3)
    expect(await run('A', { font: 'banner', spacing: 0 })).toBe(
      await run('A', { font: 'banner', spacing: 5 })
    )
  })

  it('is case insensitive and renders one block per input line', async () => {
    expect(await run('ab', { font: 'banner' })).toBe(await run('AB', { font: 'banner' }))
    expect((await run('A\nB', { font: 'banner' })).split('\n')).toHaveLength(14)
    expect((await run('A\n\nB', { font: 'banner' })).split('\n')).toHaveLength(15)
  })

  it('falls back to a placeholder box for unsupported characters', async () => {
    const out = await run('\u{1F600}中', { font: 'banner' })
    const rows = out.split('\n')
    expect(rows).toHaveLength(7)
    expect(rows[0]).toBe('##### #####')
    expect(rows[1]).toBe('#   # #   #')
  })

  it('renders punctuation and digits, trimming trailing blanks', async () => {
    // the sixth row of '!' is empty, so that row ends after the '7' stem
    expect(await run('7!', { font: 'banner' })).toBe(
      ['#####   #', '    #   #', '   #    #', '  #     #', ' #      #', ' #', ' #      #'].join('\n')
    )
  })

  it('returns empty output for empty input', async () => {
    for (const font of FONTS) expect(await util.apply('', { font })).toBe('')
  })

  it('throws on an unknown font or negative spacing', () => {
    expect(() => util.apply('hi', { font: 'gothic' })).toThrow(/unknown font/)
    expect(() => util.apply('hi', { spacing: -2 })).toThrow(/spacing/)
    expect(() => util.apply('hi', { spacing: 'wide' })).toThrow(/spacing/)
    // a stray huge number must not try to allocate a gigabyte of gap
    expect(() => util.apply('hi', { spacing: 1e9 })).toThrow(/64 or less/)
  })
})


describe('ascii_banner — attacker-sized input', () => {
  // A long line of glyphs whose rows are mostly blank ends in one inked glyph, so each
  // rendered row is a huge run of spaces followed by ink: trimming it with /\s+$/ was
  // quadratic (8k chars of '~' took ~25 s and froze the tab/worker).
  it('renders a long line with blank-row glyphs in linear time', () => {
    const t0 = performance.now()
    const out = util.apply('~'.repeat(8000) + 'X', { font: 'banner', spacing: 1 }) as string
    expect(performance.now() - t0).toBeLessThan(2000)
    const rows = out.split('\n')
    expect(rows).toHaveLength(7)
    expect(rows.every(r => r === r.trimEnd())).toBe(true)
    expect(rows[0].endsWith('#   #')).toBe(true)
  })
})
