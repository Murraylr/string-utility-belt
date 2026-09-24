import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { computeStats } from './stats'

describe('computeStats', () => {
  it('counts lines/words/code points/utf8 bytes for a string', () => {
    const s = computeStats('hello world\nfoo')
    expect(s.type).toBe('string')
    expect(s.lines).toBe(2)
    expect(s.words).toBe(3)
    expect(s.codePoints).toBe(15)
    expect(s.utf8Bytes).toBe(15)
  })

  it('counts an emoji as one code point but 4 utf8 bytes', () => {
    const s = computeStats('😀')
    expect(s.codePoints).toBe(1)
    expect(s.utf8Bytes).toBe(4)
  })

  it('treats an empty string as 0 lines/words', () => {
    const s = computeStats('')
    expect(s.lines).toBe(0)
    expect(s.words).toBe(0)
    expect(s.codePoints).toBe(0)
  })

  it('reports bytes for a Uint8Array as its own type', () => {
    const s = computeStats(new Uint8Array([1, 2, 3]))
    expect(s.type).toBe('bytes')
    expect(s.utf8Bytes).toBe(3)
    expect(s.codePoints).toBeUndefined()
  })

  it('stringifies a json value before measuring it', () => {
    const s = computeStats({ a: 1 })
    expect(s.type).toBe('json')
    expect(s.lines).toBeGreaterThan(0)
  })
})

describe('computeStats — single-pass counters match the obvious reference implementation', () => {
  const reference = (text: string) => {
    const trimmed = text.trim()
    return {
      codePoints: Array.from(text).length,
      words: trimmed === '' ? 0 : trimmed.split(/\s+/).length,
      lines: text === '' ? 0 : text.split('\n').length,
      utf8Bytes: new TextEncoder().encode(text).length,
    }
  }

  it('agrees on unicode, whitespace variety and lone surrogates', () => {
    for (const text of ['', ' ', ' a　b c﻿', 'x\uD800y', '\uDC00', '😀 😀\n\n', 'a\r\nb\tc  d']) {
      const { codePoints, words, lines, utf8Bytes } = computeStats(text)
      expect({ codePoints, words, lines, utf8Bytes }).toEqual(reference(text))
    }
  })

  it('agrees for arbitrary strings (property)', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary', maxLength: 200 }), text => {
      const { codePoints, words, lines, utf8Bytes } = computeStats(text)
      expect({ codePoints, words, lines, utf8Bytes }).toEqual(reference(text))
    }), { numRuns: 300 })
  })
})
