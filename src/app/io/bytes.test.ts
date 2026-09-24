import { describe, expect, it } from 'vitest'
import { bytesToBase64, bytesToHex, decodeUtf8Lossy, decodeUtf8Prefix, looksLikeText, tryDecodeUtf8Strict, utf8Encode } from './bytes'

describe('bytesToHex', () => {
  it('lowercases and zero-pads each byte', () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
  })
  it('is empty for an empty array', () => {
    expect(bytesToHex(new Uint8Array())).toBe('')
  })
})

describe('bytesToBase64', () => {
  it('matches btoa for a small input', () => {
    const bytes = utf8Encode('hello')
    expect(bytesToBase64(bytes)).toBe(btoa('hello'))
  })
  it('handles inputs larger than the chunk size without overflowing the call stack', () => {
    const bytes = new Uint8Array(200_000).fill(65) // 'A'
    const b64 = bytesToBase64(bytes)
    expect(atob(b64).length).toBe(200_000)
    expect(atob(b64)[0]).toBe('A')
  })
})

describe('utf8Encode / tryDecodeUtf8Strict / decodeUtf8Lossy', () => {
  it('round-trips multi-byte text', () => {
    const bytes = utf8Encode('café 日本語')
    expect(tryDecodeUtf8Strict(bytes)).toBe('café 日本語')
  })
  it('rejects invalid UTF-8 strictly', () => {
    const invalid = new Uint8Array([0xff, 0xfe, 0x00])
    expect(tryDecodeUtf8Strict(invalid)).toBeNull()
  })
  it('decodes invalid UTF-8 lossily with replacement characters', () => {
    const invalid = new Uint8Array([0x41, 0xff, 0x42])
    const out = decodeUtf8Lossy(invalid)
    expect(out).toContain('�')
    expect(out.startsWith('A')).toBe(true)
    expect(out.endsWith('B')).toBe(true)
  })
})

describe('BOM handling', () => {
  it('keeps a leading UTF-8 BOM instead of silently stripping it', () => {
    const withBom = new Uint8Array([0xef, 0xbb, 0xbf, 0x68, 0x69])
    expect(tryDecodeUtf8Strict(withBom)).toBe('﻿hi')
    expect(decodeUtf8Lossy(withBom)).toBe('﻿hi')
  })
})

describe('looksLikeText', () => {
  it('accepts UTF-8 text, including tabs/newlines and multi-byte characters', () => {
    expect(looksLikeText(utf8Encode('héllo\tworld\r\n日本語 😀'))).toBe(true)
    expect(looksLikeText(new Uint8Array())).toBe(true)
  })
  it('rejects invalid UTF-8 and control bytes typical of binary data', () => {
    expect(looksLikeText(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe(false)
    expect(looksLikeText(new Uint8Array([0x00, 0x61, 0x73, 0x6d]))).toBe(false) // wasm header: valid UTF-8, but NUL
  })
  it('only probes the head, and a multi-byte character cut at the probe edge is not "invalid"', () => {
    const head = utf8Encode('a'.repeat(9) + 'é') // 11 bytes; a 10-byte probe splits the é
    expect(looksLikeText(head, 10)).toBe(true)
    const tailGarbage = new Uint8Array([...utf8Encode('abc'), 0xff])
    expect(looksLikeText(tailGarbage, 3)).toBe(true)
  })
})

describe('decodeUtf8Prefix', () => {
  it('decodes at most `max` bytes without a stray U+FFFD for a character cut at the edge', () => {
    const bytes = utf8Encode('ab€cd') // € is 3 bytes: a b [e2 82 ac] c d
    expect(decodeUtf8Prefix(bytes, 3)).toBe('ab')
    expect(decodeUtf8Prefix(bytes, 5)).toBe('ab€')
    expect(decodeUtf8Prefix(bytes, 100)).toBe('ab€cd')
  })
  it('still replaces genuinely invalid bytes', () => {
    expect(decodeUtf8Prefix(new Uint8Array([0x41, 0xff, 0x42]), 10)).toBe('A�B')
  })
})
