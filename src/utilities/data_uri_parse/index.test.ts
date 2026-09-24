import { describe, it, expect } from 'vitest'
import util from './index'
import builder from '../data_uri_build/index'

describe('data_uri_parse', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('data_uri_parse')
    expect(util.name).toBe('data uri parse')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['json', 'string', 'bytes'])
    expect(util.params.output.default).toBe('json')
    expect((util.params.output as { options: string[] }).options).toEqual(['json', 'text', 'bytes'])
  })

  it('parses a base64 text data uri into json', async () => {
    expect(await util.apply('data:text/plain;charset=utf-8;base64,SGVsbG8sIFdvcmxkIQ==', {})).toEqual(
      {
        mime: 'text/plain',
        charset: 'utf-8',
        base64: true,
        data: 'Hello, World!',
        size: 13
      }
    )
  })

  it('parses percent-encoded payloads and defaults the mime type', async () => {
    expect(await util.apply('data:,Hello%20World', {})).toEqual({
      mime: 'text/plain',
      charset: '',
      base64: false,
      data: 'Hello World',
      size: 11
    })
    expect(await util.apply('data:text/css;charset=iso-8859-1,a%7Bcolor%3Ared%7D', {})).toEqual({
      mime: 'text/css',
      charset: 'iso-8859-1',
      base64: false,
      data: 'a{color:red}',
      size: 12
    })
    // an unencoded payload is legal too, and `+` is a literal plus here
    expect(await util.apply('data:text/plain,a+b c', {})).toEqual({
      mime: 'text/plain',
      charset: '',
      base64: false,
      data: 'a+b c',
      size: 5
    })
  })

  it('normalises the header: case, quotes, order and unknown params', async () => {
    expect(await util.apply('DATA:TEXT/Plain;CHARSET=UTF-8;BASE64,aGk=', {})).toEqual({
      mime: 'text/plain',
      charset: 'utf-8',
      base64: true,
      data: 'hi',
      size: 2
    })
    expect(await util.apply('data:text/plain;charset="utf-8",hi', {})).toEqual({
      mime: 'text/plain',
      charset: 'utf-8',
      base64: false,
      data: 'hi',
      size: 2
    })
    // base64 need not be last, and unrecognised parameters are ignored
    expect(await util.apply('data:text/plain;base64;charset=utf-8;foo=bar,aGk=', {})).toEqual({
      mime: 'text/plain',
      charset: 'utf-8',
      base64: true,
      data: 'hi',
      size: 2
    })
  })

  it('returns raw payloads for the text and bytes outputs', async () => {
    expect(await util.apply('data:text/plain;base64,SGVsbG8=', { output: 'text' })).toBe('Hello')
    const raw = await util.apply('data:text/plain;base64,SGVsbG8=', { output: 'bytes' })
    expect(raw).toBeInstanceOf(Uint8Array)
    expect(Array.from(raw as Uint8Array)).toEqual([0x48, 0x65, 0x6c, 0x6c, 0x6f])
    // a non-utf-8 charset label is honoured when decoding to text
    expect(await util.apply('data:text/plain;charset=iso-8859-1,caf%E9', { output: 'text' })).toBe(
      'café'
    )
    expect(
      await util.apply('data:text/plain;charset=utf-16le;base64,aABpAA==', { output: 'text' })
    ).toBe('hi')
  })

  it('handles unicode payloads', async () => {
    expect(await util.apply('data:text/plain;charset=utf-8;base64,8J+YgA==', {})).toEqual({
      mime: 'text/plain',
      charset: 'utf-8',
      base64: true,
      data: '\u{1F600}',
      size: 4
    })
    expect(
      await util.apply('data:text/plain;charset=utf-8,h%C3%A9llo%20%F0%9F%98%80', { output: 'text' })
    ).toBe('héllo \u{1F600}')
    // a literal astral character in the payload is encoded as utf-8, not split
    expect(
      Array.from((await util.apply('data:text/plain,\u{1F600}', { output: 'bytes' })) as Uint8Array)
    ).toEqual([0xf0, 0x9f, 0x98, 0x80])
  })

  it('reports binary payloads as base64', async () => {
    expect(await util.apply('data:image/png;base64,iVBORw0KGgo=', {})).toEqual({
      mime: 'image/png',
      charset: '',
      base64: true,
      data: 'iVBORw0KGgo=',
      size: 8
    })
    // decodes cleanly as windows-1252 but is plainly not text
    expect(await util.apply('data:text/plain;charset=windows-1252;base64,AAEC', {})).toEqual({
      mime: 'text/plain',
      charset: 'windows-1252',
      base64: true,
      data: 'AAEC',
      size: 3
    })
    // tabs and newlines are text, not binary
    expect(await util.apply('data:text/plain;base64,YQliCmM=', {})).toEqual({
      mime: 'text/plain',
      charset: '',
      base64: true,
      data: 'a\tb\nc',
      size: 5
    })
  })

  it('tolerates whitespace, url-safe base64 and missing padding', async () => {
    expect(await util.apply('data:text/plain;base64,SGVs\n bG8', { output: 'text' })).toBe('Hello')
    expect(await util.apply('  data:text/plain;base64,SGVsbG8=  ', { output: 'text' })).toBe('Hello')
    const urlSafe = await util.apply('data:application/octet-stream;base64,-_8=', {
      output: 'bytes'
    })
    expect(Array.from(urlSafe as Uint8Array)).toEqual([0xfb, 0xff])
    // one leftover base64 character can never be valid
    expect(() => util.apply('data:text/plain;base64,SGVsb', {})).toThrow(/not valid base64/)
  })

  it('returns the empty equivalent for empty input', async () => {
    expect(await util.apply('', {})).toEqual({})
    expect(await util.apply('   ', { output: 'text' })).toBe('')
    expect(Array.from((await util.apply('', { output: 'bytes' })) as Uint8Array)).toEqual([])
    // an empty payload is not empty input: the header still parses
    expect(await util.apply('data:text/plain;base64,', {})).toEqual({
      mime: 'text/plain',
      charset: '',
      base64: true,
      data: '',
      size: 0
    })
  })

  it('round-trips through data_uri_build', async () => {
    const original = 'naïve café \u{1F600}'
    const uri = await builder.apply(original, { mime: 'text/plain', base64: true, charset: 'utf-8' })
    expect(await util.apply(uri as string, { output: 'text' })).toBe(original)
    const parsed = (await util.apply(uri as string, {})) as Record<string, unknown>
    expect(parsed.data).toBe(original)
    expect(parsed.mime).toBe('text/plain')
    expect(parsed.charset).toBe('utf-8')
    expect(parsed.size).toBe(new TextEncoder().encode(original).length)
  })

  it('throws on malformed input', () => {
    expect(() => util.apply('hello', {})).toThrow(/not a data uri/)
    expect(() => util.apply('data:text/plain', {})).toThrow(/not a data uri/)
    expect(() => util.apply('http://example.com/,x', {})).toThrow(/not a data uri/)
    expect(() => util.apply('data:text/plain;base64,####', {})).toThrow(/not valid base64/)
    expect(() => util.apply('data:text/plain,abc%zz', {})).toThrow(/percent-escape/)
    expect(() => util.apply('data:text/plain,abc%', {})).toThrow(/percent-escape/)
    expect(() => util.apply('data:,hi', { output: 'xml' })).toThrow(/unknown output/)
  })
})
