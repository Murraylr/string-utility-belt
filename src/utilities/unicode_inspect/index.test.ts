import { describe, it, expect } from 'vitest'
import util from './index'

type Row = {
  index: number
  char: string
  codePoint: string
  decimal: number
  utf8: string
  utf16: string
  category: string
  categoryName: string
  script: string
  block: string
  isCombining: boolean
  isEmoji: boolean
}
type Report = { total: number; shown: number; truncated: boolean; codePoints: Row[] }

const json = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, { ...params, format: 'json' })) as unknown as Report

const table = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, { ...params, format: 'table' })) as unknown as string

describe('unicode_inspect', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('unicode_inspect')
    expect(util.name).toBe('unicode inspect')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params)).toEqual(['limit', 'format'])
  })

  it('describes an ASCII code point in full', async () => {
    const report = await json('A')
    expect(report.total).toBe(1)
    const row = report.codePoints[0]
    expect(row.char).toBe('A')
    expect(row.codePoint).toBe('U+0041')
    expect(row.decimal).toBe(65)
    expect(row.utf8).toBe('41')
    expect(row.utf16).toBe('0041')
    expect(row.category).toBe('Lu')
    expect(row.categoryName).toBe('Uppercase Letter')
    expect(row.script).toBe('Latin')
    expect(row.block).toBe('Basic Latin')
    expect(row.isCombining).toBe(false)
    expect(row.isEmoji).toBe(false)
  })

  it('returns json shape for the json format option', async () => {
    const report = await json('hi')
    expect(report).toMatchObject({ total: 2, shown: 2, truncated: false })
    expect(Array.isArray(report.codePoints)).toBe(true)
    expect(report.codePoints.map((r) => r.codePoint)).toEqual(['U+0068', 'U+0069'])
  })

  it('renders an aligned table for the table format option', async () => {
    const out = await table('Hi')
    const lines = out.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatch(
      /^#\s+CHAR\s+CODE POINT\s+DEC\s+UTF-8\s+UTF-16\s+GC\s+CATEGORY\s+SCRIPT\s+BLOCK\s+FLAGS$/
    )
    expect(lines[1]).toContain('U+0048')
    expect(lines[1]).toContain('Uppercase Letter')
    expect(lines[2]).toContain('U+0069')
  })

  it('keeps astral characters whole and flags emoji', async () => {
    const report = await json('\u{1F600}')
    expect(report.total).toBe(1)
    const row = report.codePoints[0]
    expect(row.char).toBe('\u{1F600}')
    expect(row.codePoint).toBe('U+1F600')
    expect(row.decimal).toBe(128512)
    expect(row.utf8).toBe('F0 9F 98 80')
    expect(row.utf16).toBe('D83D DE00')
    expect(row.block).toBe('Emoticons')
    expect(row.isEmoji).toBe(true)
  })

  it('handles non-ASCII scripts and combining marks', async () => {
    const report = await json('\u3042\u0645e\u0301')
    expect(report.total).toBe(4)
    const [hira, arabic, latin, mark] = report.codePoints
    expect(hira.script).toBe('Hiragana')
    expect(hira.block).toBe('Hiragana')
    expect(hira.utf8).toBe('E3 81 82')
    expect(arabic.script).toBe('Arabic')
    expect(latin.category).toBe('Ll')
    expect(mark.codePoint).toBe('U+0301')
    expect(mark.category).toBe('Mn')
    expect(mark.isCombining).toBe(true)
    expect(mark.block).toBe('Combining Diacritical Marks')
  })

  it('labels control characters and invisibles instead of printing them', async () => {
    const out = await table('\n\u200B')
    expect(out).toContain('\\n')
    expect(out).toContain('<200B>')
    const report = await json('\n\u200B')
    expect(report.codePoints[0].category).toBe('Cc')
    expect(report.codePoints[1].category).toBe('Cf')
    expect(report.codePoints[1].block).toBe('General Punctuation')
  })

  it('truncates at the limit and reports how much was hidden', async () => {
    const report = await json('abcdef', { limit: 2 })
    expect(report).toMatchObject({ total: 6, shown: 2, truncated: true })
    expect(report.codePoints).toHaveLength(2)
    const out = await table('abcdef', { limit: 2 })
    expect(out).toContain('… 4 more code points not shown (limit 2)')
  })

  it('treats a limit of 0 or less as no limit', async () => {
    expect((await json('abcdef', { limit: 0 })).shown).toBe(6)
    expect((await json('abcdef', { limit: -5 })).truncated).toBe(false)
    expect((await table('abcdef', { limit: 0 })).split('\n')).toHaveLength(7)
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', { format: 'table', limit: 200 })).toBe('')
    const report = await json('')
    expect(report).toEqual({ total: 0, shown: 0, truncated: false, codePoints: [] })
  })

  it('throws on an unknown format', () => {
    expect(() => util.apply('a', { format: 'yaml' })).toThrow(/unknown format/)
  })

  it('reports a lone surrogate instead of choking on it', async () => {
    const report = await json('\uD800')
    expect(report.total).toBe(1)
    const row = report.codePoints[0]
    expect(row.codePoint).toBe('U+D800')
    expect(row.decimal).toBe(0xd800)
    expect(row.utf16).toBe('D800')
    expect(row.category).toBe('Cs')
    expect(row.categoryName).toBe('Surrogate')
    expect(row.block).toBe('High Surrogates')
    expect(await table('\uD800')).toContain('<D800>')
  })

  it('names scripts and blocks outside the common Latin/CJK set', async () => {
    // U+1950 TAI LE LETTER KA, U+11013 BRAHMI LETTER GA, U+10450 SHAVIAN LETTER PEEP.
    const report = await json('ᥐ\u{11013}\u{10450}')
    expect(report.total).toBe(3)
    expect(report.codePoints.map((r) => r.script)).toEqual(['Tai Le', 'Brahmi', 'Shavian'])
    expect(report.codePoints.map((r) => r.block)).toEqual(['Tai Le', 'Brahmi', 'Shavian'])
    // U+2FF0 sits in a block the table used to skip entirely.
    const ids = await json('⿰\u{2B740}')
    expect(ids.codePoints[0].block).toBe('Ideographic Description Characters')
    expect(ids.codePoints[1].block).toBe('CJK Unified Ideographs Extension D')
    expect(ids.codePoints[1].script).toBe('Han')
  })

  it('classifies symbols, digits and currency', async () => {
    const report = await json('7\u20AC')
    expect(report.codePoints[0].category).toBe('Nd')
    expect(report.codePoints[0].categoryName).toBe('Decimal Number')
    expect(report.codePoints[1].category).toBe('Sc')
    expect(report.codePoints[1].block).toBe('Currency Symbols')
    expect(report.codePoints[1].utf8).toBe('E2 82 AC')
  })
})
