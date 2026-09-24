import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../base91_encode/index'

describe('base91_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base91_decode')
    expect(util.name).toBe('basE91 decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('decodes the reference basE91 vectors', async () => {
    expect(await util.apply('fPNKd', {})).toBe('test')
    expect(await util.apply('TPwJh>Io2Tv!lE', {})).toBe('hello world')
    expect(await util.apply('GB', {})).toBe('a')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(Array.from(await util.apply('', { output: 'bytes' }) as Uint8Array)).toEqual([])
  })

  it('ignores line breaks and other whitespace', async () => {
    expect(await util.apply('TPwJh>Io\n2Tv!lE', {})).toBe('hello world')
    expect(await util.apply('  fPNKd  ', {})).toBe('test')
  })

  it('decodes non-ASCII text', async () => {
    expect(await util.apply('1J_OX<oC*n1bnBW4@aE', {})).toBe('héllo ✓ 🎉')
  })

  it('emits raw bytes when output is bytes', async () => {
    expect(Array.from(await util.apply('S|H', { output: 'bytes' }) as Uint8Array)).toEqual([0xff, 0xfe])
    expect(Array.from(await util.apply('fPNKd', { output: 'bytes' }) as Uint8Array))
      .toEqual([116, 101, 115, 116])
    expect(Array.from(await util.apply(':C#(h",^_~#', { output: 'bytes' }) as Uint8Array))
      .toEqual([0, 1, 2, 127, 128, 200, 253, 254, 255])
  })

  it('round-trips the encoder output', async () => {
    const source = 'ünïcödé 🚀 round-trip'
    expect(await util.apply(await encoder.apply(source, {}), { output: 'text' })).toBe(source)
  })

  it('throws on characters outside the basE91 alphabet', () => {
    expect(() => util.apply('fPNK-d', {})).toThrow(/invalid basE91 character/)
    expect(() => util.apply('fP🎉Kd', {})).toThrow(/invalid basE91 character/)
    expect(() => util.apply("fPNK'd", {})).toThrow(/invalid basE91 character/)
  })

  it('reports binary payloads instead of mangling them as text', () => {
    expect(() => util.apply('S|H', { output: 'text' })).toThrow(/not valid UTF-8/)
  })
})
