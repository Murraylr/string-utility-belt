import { describe, it, expect } from 'vitest'
import util from './index'

const lines = (s: unknown) => String(s).split('\n')

describe('hex_dump', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('hex_dump')
    expect(util.name).toBe('hex dump')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['showAscii', 'showOffset', 'uppercase', 'width'])
  })

  it('declares the documented defaults', () => {
    expect(util.params.width).toMatchObject({ kind: 'number', default: 16 })
    expect(util.params.uppercase).toMatchObject({ kind: 'boolean', default: false })
    expect(util.params.showAscii).toMatchObject({ kind: 'boolean', default: true })
    expect(util.params.showOffset).toMatchObject({ kind: 'boolean', default: true })
  })

  it('dumps a short string with offset, hex and ascii columns', async () => {
    // 'Hello' = 48 65 6c 6c 6f; the hex column is padded to a full 16-byte row
    // (16*2 hex + 14 single + 1 double separator = 48 chars), so 34 spaces follow.
    expect(await util.apply('Hello', {})).toBe(
      `00000000  48 65 6c 6c 6f${' '.repeat(34)}  |Hello|`
    )
  })

  it('groups eight bytes and wraps rows at the given width', async () => {
    const out = lines(await util.apply('a'.repeat(20), {}))
    expect(out).toHaveLength(2)
    expect(out[0]).toBe(
      '00000000  61 61 61 61 61 61 61 61  61 61 61 61 61 61 61 61  |aaaaaaaaaaaaaaaa|'
    )
    expect(out[1]).toBe(`00000010  61 61 61 61${' '.repeat(37)}  |aaaa|`)
    // every hex column is exactly the same width so the ascii gutters line up
    expect(out[0].indexOf('|')).toBe(out[1].indexOf('|'))
  })

  it('honours the width param', async () => {
    const out = lines(await util.apply('Hello', { width: 4 }))
    expect(out).toEqual([
      '00000000  48 65 6c 6c  |Hell|',
      `00000004  6f${' '.repeat(9)}  |o|`
    ])
    // width 1 emits one byte per row and the offset advances by one
    expect(lines(await util.apply('Hi', { width: 1 }))).toEqual([
      '00000000  48  |H|',
      '00000001  69  |i|'
    ])
  })

  it('honours uppercase, showAscii and showOffset in both states', async () => {
    expect(await util.apply('ÿ', { width: 2, uppercase: true })).toBe('00000000  C3 BF  |..|')
    expect(await util.apply('ÿ', { width: 2, uppercase: false })).toBe('00000000  c3 bf  |..|')
    expect(await util.apply('Hi', { width: 2, showOffset: false })).toBe('48 69  |Hi|')
    expect(await util.apply('Hi', { width: 2, showOffset: true })).toBe('00000000  48 69  |Hi|')
    expect(await util.apply('Hi', { width: 4, showAscii: false })).toBe('00000000  48 69')
    expect(await util.apply('Hi', { width: 4, showAscii: true })).toBe(
      `00000000  48 69${' '.repeat(6)}  |Hi|`
    )
    expect(await util.apply('Hi', { width: 4, showAscii: false, showOffset: false })).toBe('48 69')
    // uppercase applies to the offset column too, once it has hex letters in it
    expect(lines(await util.apply('z'.repeat(11), { width: 1, uppercase: true })).pop()).toBe(
      '0000000A  7A  |z|'
    )
  })

  it('shows utf-8 bytes for non-ascii text and dots in the ascii gutter', async () => {
    // é = C3 A9, 😀 = F0 9F 98 80 — six bytes, no surrogate halves
    expect(await util.apply('é😀', { width: 8 })).toBe(
      `00000000  c3 a9 f0 9f 98 80${' '.repeat(6)}  |......|`
    )
    // only printable ascii (0x20-0x7E) survives into the gutter
    expect(await util.apply(new Uint8Array([0x1f, 0x20, 0x7e, 0x7f]), { width: 4 })).toBe(
      '00000000  1f 20 7e 7f  |. ~.|'
    )
  })

  it('accepts raw bytes', async () => {
    expect(await util.apply(new Uint8Array([0, 255, 65]), { width: 4 })).toBe(
      `00000000  00 ff 41${' '.repeat(3)}  |..A|`
    )
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('returns an empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { width: 4, showAscii: false })).toBe('')
  })

  it('falls back to the default width when the field is cleared', async () => {
    // the params editor sends '' for an emptied number input — that must not
    // be read as width 0 and blow the step up
    expect(await util.apply('Hello', { width: '' })).toBe(await util.apply('Hello', {}))
    expect(await util.apply('Hello', { width: undefined })).toBe(await util.apply('Hello', {}))
  })

  it('rejects an out-of-range width', () => {
    expect(() => util.apply('abc', { width: 0 })).toThrow(/width must be a number between 1 and 256/)
    expect(() => util.apply('abc', { width: -4 })).toThrow(/width/)
    expect(() => util.apply('abc', { width: 300 })).toThrow(/width/)
    expect(() => util.apply('abc', { width: 'wide' })).toThrow(/width/)
  })
})
