import { describe, it, expect } from 'vitest'
import util, { BOX_STYLES, STYLE_NAMES, displayWidth, expandTabs } from './index'

const run = async (text: string, params: Record<string, unknown> = {}) =>
  (await util.apply(text, params)) as string

const S = BOX_STYLES.single
const CJK = '日本' // two columns each
const PARTY = '\u{1F389}' // astral emoji, two columns

describe('box_text', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('box_text')
    expect(util.name).toBe('box text')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['align', 'padding', 'style', 'title', 'width'])
    expect(STYLE_NAMES).toEqual(['single', 'double', 'round', 'bold', 'ascii', 'dashed'])
  })

  it('boxes a single line with the default single style', async () => {
    expect(await run('hello')).toBe(
      [
        S.tl + S.h.repeat(7) + S.tr,
        `${S.v} hello ${S.v}`,
        S.bl + S.h.repeat(7) + S.br
      ].join('\n')
    )
    expect(S.tl.codePointAt(0)).toBe(0x250c)
    expect(S.h.codePointAt(0)).toBe(0x2500)
    expect(S.v.codePointAt(0)).toBe(0x2502)
  })

  it('draws every border style with matching corners', async () => {
    for (const name of STYLE_NAMES) {
      const chars = BOX_STYLES[name]
      const rows = (await run('x', { style: name })).split('\n')
      expect(rows, name).toHaveLength(3)
      expect(rows[0], name).toBe(chars.tl + chars.h.repeat(3) + chars.tr)
      expect(rows[1], name).toBe(`${chars.v} x ${chars.v}`)
      expect(rows[2], name).toBe(chars.bl + chars.h.repeat(3) + chars.br)
    }
    expect((await run('x', { style: 'ascii' })).split('\n')[0]).toBe('+---+')
    expect((await run('x', { style: 'dashed' })).split('\n')[1]).toBe('╎ x ╎')
  })

  it('applies horizontal padding, and vertical padding past 1', async () => {
    expect(await run('hi', { padding: 0 })).toBe(
      [S.tl + S.h.repeat(2) + S.tr, `${S.v}hi${S.v}`, S.bl + S.h.repeat(2) + S.br].join('\n')
    )
    const padded = (await run('hi', { padding: 2 })).split('\n')
    expect(padded).toHaveLength(5)
    expect(padded[1]).toBe(S.v + ' '.repeat(6) + S.v)
    expect(padded[2]).toBe(`${S.v}  hi  ${S.v}`)
  })

  it('aligns content inside a fixed width', async () => {
    expect((await run('hi', { width: 11, align: 'left' })).split('\n')[1]).toBe(`${S.v} hi      ${S.v}`)
    expect((await run('hi', { width: 11, align: 'center' })).split('\n')[1]).toBe(`${S.v}   hi    ${S.v}`)
    expect((await run('hi', { width: 11, align: 'right' })).split('\n')[1]).toBe(`${S.v}      hi ${S.v}`)
    for (const row of (await run('hi', { width: 11 })).split('\n')) expect(row).toHaveLength(11)
  })

  it('renders a title in the top border and truncates it when needed', async () => {
    const titled = (await run('hello', { title: 'log' })).split('\n')
    expect(titled[0]).toBe(S.tl + S.h + ' log ' + S.h + S.tr)
    expect(titled[0]).toHaveLength(9)
    // a long title widens a fit-to-content box
    const wide = (await run('hi', { title: 'a longer title' })).split('\n')
    expect(wide[0]).toBe(S.tl + S.h + ' a longer title ' + S.h + S.tr)
    // ...but is clipped when the width is pinned
    const clipped = (await run('hi', { title: 'truncated me', width: 10, padding: 0 })).split('\n')
    expect(clipped[0]).toBe(S.tl + S.h + ' trun ' + S.h + S.tr)
    expect(clipped[0]).toHaveLength(10)
  })

  it('sanitises a title that would tear the border apart', async () => {
    // a line break inside the title would put the border on two lines
    expect((await run('a', { title: 'one\ntwo' })).split('\n')[0])
      .toBe(S.tl + S.h + ' one two ' + S.h + S.tr)
    // no room for even the first (wide) title character: draw a plain border
    const rows = (await run('a', { width: 7, padding: 0, title: CJK })).split('\n')
    expect(rows[0]).toBe(S.tl + S.h.repeat(5) + S.tr)
    expect(rows[0]).toHaveLength(7)
    // one wide character does fit here, and the border still totals 8 columns
    const fits = (await run('a', { width: 8, title: CJK })).split('\n')
    expect(fits[0]).toBe(S.tl + S.h + ' 日 ' + S.h + S.tr)
    for (const row of fits) expect(displayWidth(row)).toBe(8)
  })

  it('wraps long lines at word boundaries and hard-breaks long words', async () => {
    const wrapped = (await run('the quick brown fox', { width: 12 })).split('\n')
    expect(wrapped).toHaveLength(6)
    expect(wrapped[1]).toBe(`${S.v} the      ${S.v}`)
    expect(wrapped[2]).toBe(`${S.v} quick    ${S.v}`)
    const broken = (await run('abcdefghij', { width: 8 })).split('\n')
    expect(broken.slice(1, 4).map((r) => r.slice(2, 6))).toEqual(['abcd', 'efgh', 'ij  '])
  })

  it('keeps leading indentation and interior spacing when wrapping', async () => {
    const rows = (await run('   indented text here that wraps', { width: 18 })).split('\n')
    expect(rows.slice(1, 4)).toEqual([
      `${S.v}    indented    ${S.v}`,
      `${S.v} text here that ${S.v}`,
      `${S.v} wraps          ${S.v}`
    ])
    for (const row of rows) expect(displayWidth(row)).toBe(18)
    // a run of spaces that still fits inside a row is not collapsed
    const doubled = (await run('a  b that wraps here', { width: 14 })).split('\n')
    expect(doubled[1]).toBe(`${S.v} a  b that  ${S.v}`)
    expect(doubled[2]).toBe(`${S.v} wraps here ${S.v}`)
  })

  it('does not turn a trailing space into an empty row', async () => {
    const rows = (await run('abcdefgh ', { width: 8 })).split('\n')
    expect(rows).toHaveLength(4)
    expect(rows[1]).toBe(`${S.v} abcd ${S.v}`)
    expect(rows[2]).toBe(`${S.v} efgh ${S.v}`)
    // a line of nothing but spaces still yields exactly one (blank) row
    expect((await run('        ', { width: 6 })).split('\n')).toHaveLength(3)
  })

  it('expands tabs so the border still lines up', async () => {
    // tab stops are every 8 columns, and a wide character advances two of them
    expect(expandTabs('ab\tcd')).toBe('ab' + ' '.repeat(6) + 'cd')
    expect(expandTabs('\tx')).toBe(' '.repeat(8) + 'x')
    expect(expandTabs('日\tx')).toBe('日' + ' '.repeat(6) + 'x')
    expect(expandTabs('12345678\tx')).toBe('12345678' + ' '.repeat(8) + 'x')
    const rows = (await run('ab\tcd\nlonger line here')).split('\n')
    // tab stops every 8 columns: 'ab' ends at column 2, so the tab is 6 spaces
    expect(rows[1]).toBe(`${S.v} ab      cd       ${S.v}`)
    // 'longer line here' is the widest line at 16 columns, plus padding and border
    for (const row of rows) expect(displayWidth(row)).toBe(20)
  })

  it('measures combining and zero-width characters as zero columns', async () => {
    // U+304B + COMBINING KATAKANA-HIRAGANA VOICED SOUND MARK is one wide glyph,
    // even though that combining mark sits inside the wide CJK block
    const ga = 'が'
    expect(displayWidth(ga)).toBe(2)
    expect(displayWidth('é')).toBe(1)
    expect(displayWidth('a​b')).toBe(2)
    expect(displayWidth('a️')).toBe(1)
    const kana = (await run(ga + ga + '\nabcd')).split('\n')
    expect(kana[1]).toBe(`${S.v} ${ga}${ga} ${S.v}`)
    for (const row of kana) expect(displayWidth(row)).toBe(8)
  })

  it('keeps wide and astral characters aligned', async () => {
    expect(displayWidth(CJK)).toBe(4)
    expect(displayWidth('é')).toBe(1)
    expect(displayWidth(PARTY)).toBe(2)
    const rows = (await run(CJK + '\n' + PARTY + '!')).split('\n')
    expect(rows[0]).toBe(S.tl + S.h.repeat(6) + S.tr)
    expect(rows[1]).toBe(`${S.v} ${CJK} ${S.v}`)
    expect(rows[2]).toBe(`${S.v} ${PARTY}!  ${S.v}`)
    for (const row of rows) expect(displayWidth(row)).toBe(8)
  })

  it('boxes multi-line input', async () => {
    const rows = (await run('hello\nworld!')).split('\n')
    expect(rows).toHaveLength(4)
    expect(rows[1]).toBe(`${S.v} hello  ${S.v}`)
    expect(rows[2]).toBe(`${S.v} world! ${S.v}`)
    // CRLF and CR are line breaks too, and never reach the output
    expect(await run('hello\r\nworld!')).toBe(rows.join('\n'))
    expect(await run('hello\rworld!')).toBe(rows.join('\n'))
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { style: 'double', title: 'x' })).toBe('')
  })

  it('throws on unknown options or an impossible width', () => {
    expect(() => util.apply('hi', { style: 'sparkles' })).toThrow(/unknown box style/)
    expect(() => util.apply('hi', { align: 'middle' })).toThrow(/unknown alignment/)
    expect(() => util.apply('hi', { padding: -1 })).toThrow(/padding/)
    expect(() => util.apply('hi', { width: 3 })).toThrow(/too small/)
    expect(() => util.apply('hi', { width: 'wide' })).toThrow(/width must be a number/)
  })

  it('refuses absurd sizes instead of trying to allocate them', () => {
    expect(() => util.apply('hi', { width: 99999 })).toThrow(/10000 or less/)
    expect(() => util.apply('hi', { padding: 5000 })).toThrow(/500 or less/)
  })
})
