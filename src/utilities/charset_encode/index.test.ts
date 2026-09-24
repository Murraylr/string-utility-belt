import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../charset_decode/index'

const arr = async (input: unknown, params: Record<string, unknown>) =>
  Array.from((await util.apply(input as never, params)) as Uint8Array)

const SINGLE_BYTE = ['windows-1252', 'iso-8859-1', 'iso-8859-15']

describe('charset_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('charset_encode')
    expect(util.name).toBe('charset encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('bytes')
    expect(util.params.charset.default).toBe('utf-8')
    expect(util.params.onUnmappable.default).toBe('error')
    expect((util.params.charset as { options: string[] }).options).toEqual([
      'utf-8', 'utf-16le', 'utf-16be', 'windows-1252', 'iso-8859-1', 'iso-8859-15'
    ])
    expect((util.params.onUnmappable as { options: string[] }).options).toEqual([
      'error', 'skip', 'replace'
    ])
  })

  it('encodes utf-8 by default', async () => {
    expect(await arr('hi', {})).toEqual([0x68, 0x69])
    expect(await arr('café', { charset: 'utf-8' })).toEqual([0x63, 0x61, 0x66, 0xc3, 0xa9])
    expect(await arr('€', { charset: 'utf-8' })).toEqual([0xe2, 0x82, 0xac])
    // one, two, three and four byte sequences at their boundaries
    expect(await arr('\u007F\u0080߿ࠀ￿', { charset: 'utf-8' })).toEqual([
      0x7f, 0xc2, 0x80, 0xdf, 0xbf, 0xe0, 0xa0, 0x80, 0xef, 0xbf, 0xbf
    ])
    expect(await arr('\u{10000}\u{10FFFF}', { charset: 'utf-8' })).toEqual([
      0xf0, 0x90, 0x80, 0x80, 0xf4, 0x8f, 0xbf, 0xbf
    ])
  })

  it('returns empty bytes for empty input', async () => {
    const out = await util.apply('', {})
    expect(out).toBeInstanceOf(Uint8Array)
    expect((out as Uint8Array).length).toBe(0)
    for (const charset of ['utf-16le', 'utf-16be', ...SINGLE_BYTE]) {
      expect(await arr('', { charset })).toEqual([])
    }
  })

  it('keeps astral characters whole in utf-16le and utf-16be', async () => {
    expect(await arr('\u{1F600}', { charset: 'utf-16le' })).toEqual([0x3d, 0xd8, 0x00, 0xde])
    expect(await arr('\u{1F600}', { charset: 'utf-16be' })).toEqual([0xd8, 0x3d, 0xde, 0x00])
    expect(await arr('hi', { charset: 'utf-16le' })).toEqual([0x68, 0x00, 0x69, 0x00])
    expect(await arr('hi', { charset: 'utf-16be' })).toEqual([0x00, 0x68, 0x00, 0x69])
    // surrogate maths at both ends of the astral range
    expect(await arr('\u{10000}', { charset: 'utf-16be' })).toEqual([0xd8, 0x00, 0xdc, 0x00])
    expect(await arr('\u{10FFFF}', { charset: 'utf-16be' })).toEqual([0xdb, 0xff, 0xdf, 0xff])
  })

  it('encodes the single-byte charsets from their own tables', async () => {
    expect(await arr('café', { charset: 'windows-1252' })).toEqual([0x63, 0x61, 0x66, 0xe9])
    expect(await arr('€', { charset: 'windows-1252' })).toEqual([0x80])
    expect(await arr('’', { charset: 'windows-1252' })).toEqual([0x92])
    expect(await arr('Ÿžš', { charset: 'windows-1252' })).toEqual([0x9f, 0x9e, 0x9a])
    expect(await arr('€', { charset: 'iso-8859-15' })).toEqual([0xa4])
    expect(await arr('Œœ', { charset: 'iso-8859-15' })).toEqual([0xbc, 0xbd])
    expect(await arr('café', { charset: 'iso-8859-1' })).toEqual([0x63, 0x61, 0x66, 0xe9])
    // latin-1 keeps the C1 block, latin-9 keeps it everywhere it was not reused
    expect(await arr('\u0080ÿ', { charset: 'iso-8859-1' })).toEqual([0x80, 0xff])
    expect(await arr('\u0080ÿ', { charset: 'iso-8859-15' })).toEqual([0x80, 0xff])
  })

  it('throws on unmappable characters by default', () => {
    expect(() => util.apply('€', { charset: 'iso-8859-1' })).toThrow(/U\+20AC/)
    // iso-8859-15 reuses 0xA4 for the euro sign, so the currency sign is gone
    expect(() => util.apply('¤', { charset: 'iso-8859-15' })).toThrow(/U\+00A4/)
    expect(() => util.apply('\u{1F600}', { charset: 'windows-1252' })).toThrow(/U\+1F600/)
    // all eight bytes latin-9 reassigned are unmappable there but fine in latin-1
    for (const cp of [0xa4, 0xa6, 0xa8, 0xb4, 0xb8, 0xbc, 0xbd, 0xbe]) {
      const ch = String.fromCharCode(cp)
      expect(() => util.apply(ch, { charset: 'iso-8859-15' })).toThrow(/cannot be encoded/)
      expect(Array.from(util.apply(ch, { charset: 'iso-8859-1' }) as Uint8Array)).toEqual([cp])
    }
    // a lone surrogate is not encodable as utf-8 or utf-16 either
    expect(() => util.apply('a\uD800b', { charset: 'utf-8' })).toThrow(/U\+D800/)
    expect(() => util.apply('a\uDFFFb', { charset: 'utf-16le' })).toThrow(/U\+DFFF/)
  })

  it('skips or replaces unmappable characters on request', async () => {
    expect(await arr('a€b', { charset: 'iso-8859-1', onUnmappable: 'skip' })).toEqual([
      0x61, 0x62
    ])
    expect(await arr('a€b', { charset: 'iso-8859-1', onUnmappable: 'replace' })).toEqual([
      0x61, 0x3f, 0x62
    ])
    expect(await arr('a\uD800b', { charset: 'utf-8', onUnmappable: 'replace' })).toEqual([
      0x61, 0xef, 0xbf, 0xbd, 0x62
    ])
    expect(await arr('a\uD800b', { charset: 'utf-8', onUnmappable: 'skip' })).toEqual([0x61, 0x62])
    expect(await arr('a\uD800b', { charset: 'utf-16le', onUnmappable: 'skip' })).toEqual([
      0x61, 0x00, 0x62, 0x00
    ])
    expect(await arr('a\uD800b', { charset: 'utf-16be', onUnmappable: 'replace' })).toEqual([
      0x00, 0x61, 0xff, 0xfd, 0x00, 0x62
    ])
  })

  it('round-trips unicode through charset_decode for the utf encodings', async () => {
    for (const charset of ['utf-8', 'utf-16le', 'utf-16be']) {
      const original = 'Grüße \u{1F600} — naïve café 你好'
      const encoded = await util.apply(original, { charset })
      expect(await decoder.apply(encoded, { charset, fatal: true })).toBe(original)
    }
  })

  it('is a bijection over all 256 bytes of each single-byte charset', async () => {
    for (const charset of SINGLE_BYTE) {
      const all = new Uint8Array(256).map((_, i) => i)
      const text = (await decoder.apply(all, { charset })) as string
      // every byte decodes to exactly one code point, and encodes straight back
      expect(Array.from(text).length).toBe(256)
      expect(new Set(Array.from(text)).size).toBe(256)
      expect(await arr(text, { charset, onUnmappable: 'error' })).toEqual(Array.from(all))
    }
  })

  it('round-trips representable text through the single-byte charsets', async () => {
    const latin = 'naïve café Grüße'
    for (const charset of SINGLE_BYTE) {
      const encoded = await util.apply(latin, { charset })
      expect(await decoder.apply(encoded, { charset })).toBe(latin)
    }
    // windows-1252 alone can carry smart punctuation
    const cp1252 = await util.apply('“smart” — quotes', { charset: 'windows-1252' })
    expect(Array.from(cp1252 as Uint8Array)).toEqual([
      0x93, 0x73, 0x6d, 0x61, 0x72, 0x74, 0x94, 0x20, 0x97, 0x20, 0x71, 0x75, 0x6f, 0x74, 0x65, 0x73
    ])
    expect(await decoder.apply(cp1252, { charset: 'windows-1252' })).toBe(
      '“smart” — quotes'
    )
    // the same text in latin-1 loses exactly the three unmappable characters
    expect(await arr('“smart” — quotes', {
      charset: 'iso-8859-1',
      onUnmappable: 'replace'
    })).toEqual([
      0x3f, 0x73, 0x6d, 0x61, 0x72, 0x74, 0x3f, 0x20, 0x3f, 0x20, 0x71, 0x75, 0x6f, 0x74, 0x65, 0x73
    ])
  })

  it('rejects unknown charsets and unknown unmappable modes', () => {
    expect(() => util.apply('a', { charset: 'ebcdic' })).toThrow(/unsupported charset/)
    expect(() => util.apply('a', { charset: 'utf-8', onUnmappable: 'explode' })).toThrow(
      /unknown unmappable mode/
    )
  })
})
