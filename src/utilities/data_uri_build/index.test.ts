import { describe, it, expect } from 'vitest'
import util from './index'
import parser from '../data_uri_parse/index'
import charsetEncode from '../charset_encode/index'

const allBytes = () => new Uint8Array(256).map((_, i) => i)

describe('data_uri_build', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('data_uri_build')
    expect(util.name).toBe('data uri build')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(util.params.mime.default).toBe('text/plain')
    expect(util.params.base64.default).toBe(true)
    expect(util.params.charset.default).toBe('utf-8')
  })

  it('builds a base64 data uri with the default params', async () => {
    expect(await util.apply('Hello, World!', {})).toBe(
      'data:text/plain;charset=utf-8;base64,SGVsbG8sIFdvcmxkIQ=='
    )
  })

  it('percent-encodes when base64 is off', async () => {
    expect(await util.apply('Hello, World!', { base64: false, charset: '' })).toBe(
      'data:text/plain,Hello%2C%20World%21'
    )
    expect(await util.apply('<svg/>', { mime: 'image/svg+xml', base64: false, charset: '' })).toBe(
      'data:image/svg+xml,%3Csvg%2F%3E'
    )
    // the unreserved set survives untouched, everything else is escaped
    expect(await util.apply('aZ0-._~', { base64: false, charset: '' })).toBe(
      'data:text/plain,aZ0-._~'
    )
    expect(await util.apply('a&b=c?d#e/f', { base64: false, charset: '' })).toBe(
      'data:text/plain,a%26b%3Dc%3Fd%23e%2Ff'
    )
  })

  it('handles empty input and an empty mime type', async () => {
    expect(await util.apply('', {})).toBe('data:text/plain;charset=utf-8;base64,')
    expect(await util.apply('', { mime: '', charset: '', base64: false })).toBe('data:,')
    expect(await util.apply('Hi', { mime: '', charset: '', base64: false })).toBe('data:,Hi')
    expect(await util.apply(new Uint8Array(0), { charset: '' })).toBe('data:text/plain;base64,')
  })

  it('honours the charset and mime params', async () => {
    expect(await util.apply('hi', { mime: 'text/css', charset: 'iso-8859-1' })).toBe(
      'data:text/css;charset=iso-8859-1;base64,aGk='
    )
    expect(await util.apply('hi', { mime: 'application/json', charset: '' })).toBe(
      'data:application/json;base64,aGk='
    )
    // mime types and charset labels are case-insensitive: emit canonical lower case
    expect(await util.apply('hi', { mime: ' TEXT/Plain ', charset: 'UTF-8' })).toBe(
      'data:text/plain;charset=utf-8;base64,aGk='
    )
  })

  it('encodes unicode and raw bytes', async () => {
    expect(await util.apply('\u{1F600}', { charset: '' })).toBe('data:text/plain;base64,8J+YgA==')
    expect(await util.apply('héllo \u{1F600}', { base64: false, charset: '' })).toBe(
      'data:text/plain,h%C3%A9llo%20%F0%9F%98%80'
    )
    expect(await util.apply(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), { mime: 'image/png', charset: '' }))
      .toBe('data:image/png;base64,iVBORw==')
  })

  it('round-trips through data_uri_parse', async () => {
    const original = 'héllo \u{1F600} — café'
    for (const base64 of [true, false]) {
      const uri = await util.apply(original, { mime: 'text/plain', base64, charset: 'utf-8' })
      expect(await parser.apply(uri, { output: 'text' })).toBe(original)
    }
    const raw = new Uint8Array([0x00, 0x01, 0xff, 0xfe, 0x7f])
    const uri = await util.apply(raw, { mime: 'application/octet-stream', base64: true, charset: '' })
    expect(Array.from((await parser.apply(uri, { output: 'bytes' })) as Uint8Array)).toEqual([
      0x00, 0x01, 0xff, 0xfe, 0x7f
    ])
  })

  it('round-trips every byte value 0x00-0xFF in both encodings', async () => {
    const bytes = allBytes()
    for (const base64 of [true, false]) {
      const uri = (await util.apply(bytes, {
        mime: 'application/octet-stream',
        base64,
        charset: ''
      })) as string
      const back = await parser.apply(uri, { output: 'bytes' })
      expect(Array.from(back as Uint8Array)).toEqual(Array.from(bytes))
    }
  })

  it('labels a payload honestly when charset_encode produced the bytes', async () => {
    // the documented workflow for a non-utf-8 payload: convert first, then wrap
    const bytes = await charsetEncode.apply('café', { charset: 'iso-8859-1' })
    expect(Array.from(bytes as Uint8Array)).toEqual([0x63, 0x61, 0x66, 0xe9])
    const uri = (await util.apply(bytes, { base64: false, charset: 'iso-8859-1' })) as string
    expect(uri).toBe('data:text/plain;charset=iso-8859-1,caf%E9')
    expect(await parser.apply(uri, { output: 'text' })).toBe('café')
  })

  it('rejects a malformed mime type or charset', () => {
    expect(() => util.apply('hi', { mime: 'not a mime' })).toThrow(/invalid mime type/)
    expect(() => util.apply('hi', { mime: 'text/plain,x' })).toThrow(/invalid mime type/)
    expect(() => util.apply('hi', { mime: 'text/plain;charset=utf-8' })).toThrow(/invalid mime type/)
    expect(() => util.apply('hi', { mime: 'textplain' })).toThrow(/invalid mime type/)
    expect(() => util.apply('hi', { charset: 'utf 8' })).toThrow(/invalid charset/)
    expect(() => util.apply('hi', { charset: 'utf-8;x' })).toThrow(/invalid charset/)
  })
})
