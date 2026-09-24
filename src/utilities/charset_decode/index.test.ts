import { describe, it, expect } from 'vitest'
import util, { singleByteCodePoint } from './index'

const bytes = (...b: number[]) => new Uint8Array(b)

/**
 * The windows-1252 index for 0x80-0x9F, transcribed from the published table
 * and cross-checked against Python's `cp1252` codec. Node's own TextDecoder
 * aliases `windows-1252` to Latin-1, so no runtime reference is available here.
 */
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178
]

/** iso-8859-15 differs from iso-8859-1 at exactly these eight bytes. */
const LATIN9_OVERRIDES: Record<number, number> = {
  0xa4: 0x20ac, 0xa6: 0x0160, 0xa8: 0x0161, 0xb4: 0x017d,
  0xb8: 0x017e, 0xbc: 0x0152, 0xbd: 0x0153, 0xbe: 0x0178
}

describe('charset_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('charset_decode')
    expect(util.name).toBe('charset decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(util.params.charset.default).toBe('windows-1252')
    expect(util.params.fatal.default).toBe(false)
    expect((util.params.charset as { options: string[] }).options).toEqual([
      'utf-8', 'utf-16le', 'utf-16be', 'windows-1252', 'iso-8859-1', 'iso-8859-15',
      'windows-1251', 'koi8-r', 'shift_jis', 'euc-jp', 'euc-kr', 'gbk', 'big5', 'macintosh'
    ])
  })

  it('decodes utf-8 bytes', async () => {
    expect(await util.apply(bytes(0x63, 0x61, 0x66, 0xc3, 0xa9), { charset: 'utf-8' })).toBe('café')
    expect(await util.apply(bytes(0xf0, 0x9f, 0x98, 0x80), { charset: 'utf-8' })).toBe('😀')
  })

  it('uses windows-1252 when no charset is supplied', async () => {
    expect(await util.apply(bytes(0x80, 0x92, 0xe9), {})).toBe('€’é')
    expect(await util.apply(bytes(0x63, 0x61, 0x66, 0xe9), {})).toBe('café')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array(0), { charset: 'shift_jis' })).toBe('')
  })

  it('repairs mojibake pasted as text by re-reading code units as bytes', async () => {
    expect(await util.apply('cafÃ©', { charset: 'utf-8' })).toBe('café')
    // raw utf-8 bytes of “quoted” seen through a latin-1 lens
    const mojibake = '\u00E2\u0080\u009Cquoted\u00E2\u0080\u009D'
    expect(await util.apply(mojibake, { charset: 'utf-8' })).toBe('“quoted”')
    // and a cp1252 payload mis-read as latin-1
    expect(await util.apply('Ïð', { charset: 'windows-1251' })).toBe('Пр')
  })

  it('falls back to utf-8 bytes for string characters above 0xFF', async () => {
    expect(await util.apply('😀 ok', { charset: 'utf-8' })).toBe('😀 ok')
    // the astral char is never split into broken surrogate halves on the way in
    expect(await util.apply('a😀b', { charset: 'utf-8' })).toBe('a😀b')
    // utf-8 bytes F0 9F 98 80 read back through the Latin-1 table
    expect(await util.apply('😀', { charset: 'iso-8859-1' })).toBe('\u00F0\u009F\u0098\u0080')
  })

  it('decodes the whole windows-1252 high range exactly', async () => {
    for (let b = 0x80; b <= 0x9f; b++) {
      const expected = String.fromCodePoint(CP1252_HIGH[b - 0x80])
      expect(await util.apply(bytes(b), { charset: 'windows-1252' })).toBe(expected)
      expect(singleByteCodePoint('windows-1252', b)).toBe(CP1252_HIGH[b - 0x80])
    }
    // outside 0x80-0x9F windows-1252 is Latin-1
    for (const b of [0x00, 0x20, 0x41, 0x7f, 0xa0, 0xc0, 0xe9, 0xff]) {
      expect(await util.apply(bytes(b), { charset: 'windows-1252' })).toBe(String.fromCharCode(b))
    }
  })

  it('decodes latin-1 as true Latin-1 and latin-9 with its eight overrides', async () => {
    // iso-8859-1 is a pure byte = code point mapping, unlike the WHATWG alias
    for (const b of [0x00, 0x80, 0x9f, 0xa4, 0xbe, 0xff]) {
      expect(await util.apply(bytes(b), { charset: 'iso-8859-1' })).toBe(String.fromCharCode(b))
    }
    for (let b = 0x00; b <= 0xff; b++) {
      const expected = String.fromCodePoint(LATIN9_OVERRIDES[b] ?? b)
      expect(await util.apply(bytes(b), { charset: 'iso-8859-15' })).toBe(expected)
    }
    expect(await util.apply(bytes(0xa4), { charset: 'iso-8859-15' })).toBe('€')
    expect(await util.apply(bytes(0xa4), { charset: 'iso-8859-1' })).toBe('¤')
  })

  it('decodes every offered multi-byte charset', async () => {
    expect(await util.apply(bytes(0x68, 0x00, 0x69, 0x00), { charset: 'utf-16le' })).toBe('hi')
    expect(await util.apply(bytes(0x00, 0x68, 0x00, 0x69), { charset: 'utf-16be' })).toBe('hi')
    expect(await util.apply(bytes(0x3d, 0xd8, 0x00, 0xde), { charset: 'utf-16le' })).toBe('😀')
    expect(await util.apply(bytes(0xd8, 0x3d, 0xde, 0x00), { charset: 'utf-16be' })).toBe('😀')
    expect(await util.apply(bytes(0xcf, 0xf0), { charset: 'windows-1251' })).toBe('Пр')
    expect(await util.apply(bytes(0xd0, 0xd2), { charset: 'koi8-r' })).toBe('пр')
    expect(await util.apply(bytes(0x82, 0xa0), { charset: 'shift_jis' })).toBe('あ')
    expect(await util.apply(bytes(0xa4, 0xa2), { charset: 'euc-jp' })).toBe('あ')
    expect(await util.apply(bytes(0xb0, 0xa1), { charset: 'euc-kr' })).toBe('가')
    expect(await util.apply(bytes(0xc4, 0xe3), { charset: 'gbk' })).toBe('你')
    expect(await util.apply(bytes(0xa4, 0x40), { charset: 'big5' })).toBe('一')
    expect(await util.apply(bytes(0x8e), { charset: 'macintosh' })).toBe('é')
  })

  it('replaces invalid bytes when fatal is off', async () => {
    expect(await util.apply(bytes(0xff, 0x28), { charset: 'utf-8', fatal: false })).toBe('\uFFFD(')
    expect(await util.apply(bytes(0xc3), { charset: 'utf-8', fatal: false })).toBe('\uFFFD')
  })

  it('still decodes valid input when fatal is on', async () => {
    expect(await util.apply(bytes(0xc3, 0xa9), { charset: 'utf-8', fatal: true })).toBe('é')
    expect(await util.apply(bytes(0x80), { charset: 'windows-1252', fatal: true })).toBe('€')
  })

  it('throws on invalid bytes when fatal is on', () => {
    expect(() => util.apply(bytes(0xff, 0x28), { charset: 'utf-8', fatal: true })).toThrow(
      /not valid utf-8/
    )
    expect(() => util.apply(bytes(0x00), { charset: 'utf-16be', fatal: true })).toThrow()
  })

  it('throws on an unsupported charset', () => {
    expect(() => util.apply('abc', { charset: 'ebcdic' })).toThrow(/unsupported charset/)
    expect(() => util.apply('abc', { charset: 'utf-7' })).toThrow(/unsupported charset/)
  })
})
