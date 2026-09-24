import { describe, it, expect } from 'vitest'
import util from './index'

const text = async (input: string, params: Record<string, unknown>) =>
  (await util.apply(input, params)) as string

const json = async (input: string, params: Record<string, unknown>) =>
  (await util.apply(input, { ...params, format: 'json' })) as Record<string, any>

describe('text_diff', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('text_diff')
    expect(util.name).toBe('text diff')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params)).toEqual([
      'other',
      'granularity',
      'format',
      'context',
      'ignoreCase',
      'ignoreWhitespace'
    ])
  })

  it('produces a unified line diff by default', async () => {
    const out = await text('line one\nline two\nline three\n', {
      other: 'line one\nline 2\nline three\n'
    })
    expect(out).toBe(['@@ -1,3 +1,3 @@', ' line one', '-line two', '+line 2', ' line three'].join('\n'))
  })

  it('returns nothing for identical texts and for empty input', async () => {
    expect(await text('same\ntext\n', { other: 'same\ntext\n' })).toBe('')
    expect(await text('', { other: '' })).toBe('')
    expect(await text('', { other: 'added\n' })).toBe('@@ -0,0 +1,1 @@\n+added')
  })

  it('honours the context param', async () => {
    const a = 'a\nb\nc\nd\ne\n'
    const b = 'a\nb\nX\nd\ne\n'
    expect(await text(a, { other: b, context: 0 })).toBe('@@ -3,1 +3,1 @@\n-c\n+X')
    expect(await text(a, { other: b, context: 1 })).toBe(
      ['@@ -2,3 +2,3 @@', ' b', '-c', '+X', ' d'].join('\n')
    )
    // a cleared number input falls back to the declared default of 3
    expect(await text(a, { other: b, context: '' })).toBe(
      ['@@ -1,5 +1,5 @@', ' a', ' b', '-c', '+X', ' d', ' e'].join('\n')
    )
  })

  it('diffs by words and by characters in the inline format', async () => {
    expect(
      await text('the quick brown fox', { other: 'the slow brown fox', granularity: 'words', format: 'inline' })
    ).toBe('the [-quick-]{+slow+} brown fox')
    expect(await text('abc', { other: 'abd', granularity: 'characters', format: 'inline' })).toBe(
      'ab[-c-]{+d+}'
    )
  })

  it('honours ignoreCase and ignoreWhitespace', async () => {
    expect(await text('Hello', { other: 'hello', granularity: 'characters', ignoreCase: true, format: 'inline' }))
      .toBe('hello')
    expect(await text('alpha\n  beta\n', { other: 'alpha\nbeta\n', ignoreWhitespace: true })).toBe('')
    expect(await text('alpha\n  beta\n', { other: 'alpha\nbeta\n', ignoreWhitespace: false })).not.toBe('')
    expect(
      await text('a\tb', { other: 'a b', granularity: 'characters', ignoreWhitespace: true, format: 'inline' })
    ).toBe('a b')
    expect((await json('the  quick', { other: 'the quick', granularity: 'words', ignoreWhitespace: true })).identical)
      .toBe(true)
    expect((await json('the  quick', { other: 'the quick', granularity: 'words', ignoreWhitespace: false })).identical)
      .toBe(false)
  })

  it('renders a side-by-side diff, padding by code point', async () => {
    expect(await text('a\nb\n', { other: 'a\nc\n', format: 'side-by-side' })).toBe('a   a\nb | c')
    expect(await text('👍\nx\n', { other: '👍\ny\n', format: 'side-by-side' })).toBe('👍   👍\nx | y')
    expect(await text('a\nb\nc\n', { other: 'a\nX\nc\n', format: 'side-by-side', context: 0 })).toBe(
      '...\nb | X\n...'
    )
  })

  it('returns a real object for the json format', async () => {
    const out = await json('a\n', { other: 'b\n' })
    expect(typeof out).toBe('object')
    expect(out.granularity).toBe('lines')
    expect(out.identical).toBe(false)
    expect(out.stats).toEqual({ added: 1, removed: 1, unchanged: 0 })
    expect(out.changes).toHaveLength(2)
    const same = await json('same\n', { other: 'same\n' })
    expect(same.identical).toBe(true)
    expect(same.stats).toEqual({ added: 0, removed: 0, unchanged: 1 })
  })

  it('keeps astral characters intact', async () => {
    expect(await text('👍', { other: '👎', granularity: 'characters', format: 'inline' })).toBe(
      '[-👍-]{+👎+}'
    )
    // 👍 and 👎 share a high surrogate; splitting by UTF-16 unit would emit
    // "\uD83D[-\uDC4D-]{+\uDC4E+}" — two broken halves rather than two emoji.
    expect(await text('I 👍 this\n', { other: 'I 👎 this\n', granularity: 'words', format: 'inline' }))
      .toBe('I [-👍-]{+👎+} this\n')
    expect(await text('I 👍 this\n', { other: 'I 👎 this\n', granularity: 'words' })).toBe(
      '@@ -1,1 +1,1 @@\n-I 👍 this\n+I 👎 this'
    )
  })

  it('splits into separate hunks and numbers each one independently', async () => {
    const a = Array.from({ length: 20 }, (_, i) => 'l' + (i + 1)).join('\n') + '\n'
    const b = a.replace('l3\n', 'L3\n').replace('l17\n', 'L17\n')
    expect(await text(a, { other: b, context: 1, format: 'unified' })).toBe(
      [
        '@@ -2,3 +2,3 @@', ' l2', '-l3', '+L3', ' l4',
        '@@ -16,3 +16,3 @@', ' l16', '-l17', '+L17', ' l18'
      ].join('\n')
    )
    // one hunk once the context windows touch
    expect(await text(a, { other: b, context: 7, format: 'unified' }).then(s => s.split('@@ -').length - 1))
      .toBe(1)
  })

  it('anchors hunks for pure insertions and pure deletions', async () => {
    expect(await text('a\nc\n', { other: 'a\nb\nc\n' })).toBe('@@ -1,2 +1,3 @@\n a\n+b\n c')
    expect(await text('a\nb\n', { other: '' })).toBe('@@ -1,2 +0,0 @@\n-a\n-b')
    expect(await text('a\nc\n', { other: 'a\nb\nc\n', format: 'side-by-side' })).toBe('a   a\n  > b\nc   c')
  })

  it('honours both states of ignoreCase at word granularity', async () => {
    expect(
      await text('Hello there', { other: 'hello there', granularity: 'words', ignoreCase: true, format: 'inline' })
    ).toBe('hello there')
    expect(
      await text('Hello there', { other: 'hello there', granularity: 'words', ignoreCase: false, format: 'inline' })
    ).toBe('[-Hello-]{+hello+} there')
  })

  it('reports character-level stats in the json format', async () => {
    const out = await json('abc', { other: 'abd', granularity: 'characters' })
    expect(out.granularity).toBe('characters')
    expect(out.stats).toEqual({ added: 1, removed: 1, unchanged: 2 })
    expect(out.changes).toEqual([
      { type: 'equal', value: 'ab', count: 2 },
      { type: 'remove', value: 'c', count: 1 },
      { type: 'add', value: 'd', count: 1 }
    ])
  })

  it('renders a very large diff without blowing the call stack', async () => {
    // Regression: `out.push(...run)` and `Math.max(1, ...widths)` pass one
    // argument per row, which overflows the stack past ~125k rows.
    const rows = 150000
    const big = Array.from({ length: rows }, (_, i) => 'line' + i).join('\n') + '\n'
    const unified = await text(big, { other: '', context: 0 })
    expect(unified.startsWith(`@@ -1,${rows} +0,0 @@\n-line0\n-line1\n`)).toBe(true)
    const sbs = await text(big, { other: '', format: 'side-by-side', context: 0 })
    expect(sbs.split('\n')).toHaveLength(rows)
  }, 60000)

  it('handles multi-line word diffs', async () => {
    const out = await text('intro\nthe quick fox\nend\n', {
      other: 'intro\nthe slow fox\nend\n',
      granularity: 'words'
    })
    expect(out).toBe(
      ['@@ -1,3 +1,3 @@', ' intro', '-the quick fox', '+the slow fox', ' end'].join('\n')
    )
  })

  it('throws on unknown granularity or format', async () => {
    await expect(util.apply('a', { granularity: 'sentences' })).rejects.toThrow(/unknown granularity/)
    await expect(util.apply('a', { format: 'markdown' })).rejects.toThrow(/unknown format/)
  })
})
