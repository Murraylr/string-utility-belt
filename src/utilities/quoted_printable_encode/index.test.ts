import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../quoted_printable_decode/index'

const encodedLines = (s: unknown) => String(s).split(/\r\n|\n|\r/)

const DEL = String.fromCharCode(0x7f)

describe('quoted_printable_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('quoted_printable_encode')
    expect(util.name).toBe('quoted-printable encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['lineLength'])
    expect(util.params.lineLength).toMatchObject({ kind: 'number', default: 76 })
  })

  it('passes printable ascii through and escapes the equals sign', async () => {
    expect(await util.apply('The quick brown fox.', {})).toBe('The quick brown fox.')
    expect(await util.apply('a=b', {})).toBe('a=3Db')
    // RFC 2045 rule 2: 33-60 and 62-126 stay literal, everything else is =XX
    expect(await util.apply('!"#$%&\'()*+,-./09:;<>?@AZ[\\]^_`az{|}~', {})).toBe(
      '!"#$%&\'()*+,-./09:;<>?@AZ[\\]^_`az{|}~'
    )
    // control characters and DEL are always escaped
    expect(await util.apply(DEL, {})).toBe('=7F')
    expect(await util.apply('a' + String.fromCharCode(0, 0x1f) + 'b', {})).toBe('a=00=1Fb')
  })

  it('escapes non-ascii as utf-8 =XX groups', async () => {
    expect(await util.apply('café', {})).toBe('caf=C3=A9')
    expect(await util.apply('😀', {})).toBe('=F0=9F=98=80')
    expect(await util.apply('日本語', {})).toBe('=E6=97=A5=E6=9C=AC=E8=AA=9E')
    // hex digits are upper case per RFC 2045 rule 1
    expect(await util.apply('ÿ', {})).toBe('=C3=BF')
  })

  it('protects trailing whitespace but keeps interior whitespace literal', async () => {
    expect(await util.apply('a b', {})).toBe('a b')
    expect(await util.apply('end ', {})).toBe('end=20')
    expect(await util.apply('a\t', {})).toBe('a=09')
    expect(await util.apply('a \nb', {})).toBe('a=20\nb')
    expect(await util.apply(' leading', {})).toBe(' leading')
    // no encoded line may end in a literal space or tab
    for (const ln of encodedLines(await util.apply('a   \nb\t\t\n   ', {}))) {
      expect({ ln, endsInWs: /[ \t]$/.test(ln) }).toEqual({ ln, endsInWs: false })
    }
  })

  it('preserves hard line breaks exactly', async () => {
    expect(await util.apply('a\nb', {})).toBe('a\nb')
    expect(await util.apply('a\r\nb', {})).toBe('a\r\nb')
    expect(await util.apply('a\rb', {})).toBe('a\rb')
    expect(await util.apply('a\n\nb', {})).toBe('a\n\nb')
  })

  it('inserts soft line breaks at the line length', async () => {
    expect(await util.apply('x'.repeat(100), {})).toBe(`${'x'.repeat(75)}=\r\n${'x'.repeat(25)}`)
    expect(await util.apply('abcdefghijklm', { lineLength: 10 })).toBe('abcdefghi=\r\njklm')
    // an =XX group is never split across a soft break
    expect(await util.apply('aaaaaaaé', { lineLength: 10 })).toBe('aaaaaaa=\r\n=C3=A9')
  })

  it('never emits a line longer than lineLength', async () => {
    const source =
      'Grüße 😀 ' + 'word '.repeat(60) + '='.repeat(20) + '\n' + 'é'.repeat(80) + '\ttab\t'
    for (const lineLength of [4, 5, 9, 20, 76, 998]) {
      for (const ln of encodedLines(await util.apply(source, { lineLength }))) {
        expect({ lineLength, over: ln.length > lineLength }).toEqual({ lineLength, over: false })
      }
      // and it still decodes back to exactly the source
      expect(await decoder.apply(await util.apply(source, { lineLength }), {})).toBe(source)
    }
  })

  it('accepts raw bytes and empty input', async () => {
    expect(await util.apply(new Uint8Array([0, 255, 0x3d]), {})).toBe('=00=FF=3D')
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('falls back to the default lineLength when the field is cleared', async () => {
    expect(await util.apply('x'.repeat(100), { lineLength: '' })).toBe(
      await util.apply('x'.repeat(100), {})
    )
  })

  it('rejects an out-of-range lineLength', () => {
    expect(() => util.apply('abc', { lineLength: 2 })).toThrow(/lineLength/)
    expect(() => util.apply('abc', { lineLength: 2000 })).toThrow(/lineLength/)
    expect(() => util.apply('abc', { lineLength: 'long' })).toThrow(/lineLength/)
  })

  it('round-trips through quoted_printable_decode', async () => {
    const text = 'Grüße — naïve 😀\r\nline two with trailing space \nand a very long line: ' +
      'z'.repeat(120)
    expect(await decoder.apply(await util.apply(text, {}), {})).toBe(text)
    expect(await decoder.apply(await util.apply(text, { lineLength: 20 }), {})).toBe(text)

    const binary = new Uint8Array([0, 1, 10, 13, 32, 61, 127, 200, 255])
    const decoded = await decoder.apply(await util.apply(binary, {}), { output: 'bytes' })
    expect(Array.from(decoded as Uint8Array)).toEqual(Array.from(binary))

    // every byte value, including the 0x80-0xFF range and the CR/LF/TAB/SPACE
    // characters the line handling has to special-case
    const all = new Uint8Array(256)
    for (let i = 0; i < 256; i++) all[i] = i
    for (const lineLength of [4, 10, 76]) {
      const back = await decoder.apply(await util.apply(all, { lineLength }), { output: 'bytes' })
      expect({ lineLength, v: Array.from(back as Uint8Array) }).toEqual({
        lineLength,
        v: Array.from(all)
      })
    }
  })
})
