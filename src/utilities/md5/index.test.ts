import { describe, it, expect } from 'vitest'
import util from './index'

describe('md5', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('md5')
    expect(util.name).toBe('md5 hash')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('hashes string to 32-char hex', () => {
    const out = util.apply('abc', {})
    expect(out).toBe('900150983cd24fb0d6963f7d28e17f72')
  })

  it('hashes empty string', () => {
    expect(util.apply('', {})).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })

  it('hashes known test vector "message digest"', () => {
    expect(util.apply('message digest', {})).toBe('f96b697d7cb7938d525a2f31aaf161d0')
  })

  it('returns bytes when input is Uint8Array', () => {
    const out = util.apply(new Uint8Array([97, 98, 99]), {})
    expect(out).toBeInstanceOf(Uint8Array)
    expect((out as Uint8Array).length).toBe(16)
  })

  it('is deterministic (same input = same output)', () => {
    const a = util.apply('test', {})
    const b = util.apply('test', {})
    expect(a).toBe(b)
  })
})
