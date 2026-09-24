import { describe, it, expect } from 'vitest'
import util from './index'

describe('octal_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('octal_encode')
    expect(util.name).toBe('octal encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['separator'])
  })

  it('encodes ascii text as zero-padded triples', async () => {
    expect(await util.apply('Hi', {})).toBe('110 151')
    expect(await util.apply('A', {})).toBe('101')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('encodes non-ascii text as its utf-8 bytes', async () => {
    expect(await util.apply('é', {})).toBe('303 251')
    // one code point, four utf-8 bytes — the emoji is never split mid-character
    expect(await util.apply('😀', {})).toBe('360 237 230 200')
  })

  it('honours the separator param', async () => {
    expect(await util.apply('Hi', { separator: '' })).toBe('110151')
    expect(await util.apply('Hi', { separator: ', ' })).toBe('110, 151')
    expect(await util.apply('Hi', { separator: '\\n' })).toBe('110\n151')
    expect(await util.apply('Hi', { separator: '\\\\' })).toBe('110\\151')
    expect(await util.apply('Hi', { separator: '\\t' })).toBe('110\t151')
    expect(await util.apply('Hi', { separator: ' — ' })).toBe('110 — 151')
  })

  it('encodes raw bytes including the extremes', async () => {
    expect(await util.apply(new Uint8Array([0, 8, 255]), {})).toBe('000 010 377')
  })
})
