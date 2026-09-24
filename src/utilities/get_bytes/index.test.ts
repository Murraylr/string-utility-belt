import { describe, it, expect } from 'vitest'
import util from './index'
import { isBytes } from '../helpers'

describe('get_bytes', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('get_bytes')
    expect(util.name).toBe('Get bytes')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string'])
    expect(util.produces).toBe('bytes')
    expect(util.params.mode).toMatchObject({ options: ['utf8', 'hex', 'unicode'] })
    expect(util.params.mode.default).toBe('utf8')
  })

  it('utf8: converts ASCII to bytes', async () => {
    const out = await util.apply('abc', { mode: 'utf8' })
    expect(isBytes(out)).toBe(true)
    expect(Array.from(out as Uint8Array)).toEqual([97, 98, 99])
  })

  it('utf8: converts unicode checkmark', async () => {
    const out = await util.apply('✓', { mode: 'utf8' })
    expect(isBytes(out)).toBe(true)
    expect(Array.from(out as Uint8Array)).toEqual([0xe2, 0x9c, 0x93])
  })

  it('utf8: handles empty string', async () => {
    const out = await util.apply('', { mode: 'utf8' })
    expect(isBytes(out)).toBe(true)
    expect((out as Uint8Array).length).toBe(0)
  })

  it('hex: decodes hex string to bytes', async () => {
    const out = await util.apply('deadbeef', { mode: 'hex' })
    expect(isBytes(out)).toBe(true)
    expect(Array.from(out as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef])
  })

  it('hex: throws on odd-length hex', async () => {
    await expect(util.apply('abc', { mode: 'hex' })).rejects.toThrow()
  })

  it('unicode: converts to 2-byte pairs', async () => {
    const out = await util.apply('A', { mode: 'unicode' })
    expect(isBytes(out)).toBe(true)
    // 'A' = U+0041 -> [0x00, 0x41]
    expect(Array.from(out as Uint8Array)).toEqual([0x00, 0x41])
  })

  it('defaults to utf8 when mode is omitted', async () => {
    const out = await util.apply('a', {})
    expect(Array.from(out as Uint8Array)).toEqual([97])
  })
})
