import { describe, it, expect } from 'vitest'
import util from './index'

describe('xor_cipher', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('xor_cipher')
    expect(util.name).toBe('xor cipher')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toEqual(['string', 'bytes'])
  })

  it('xors with a repeating text key', async () => {
    expect(await util.apply('hi', { key: 'k' })).toBe('0302')
    expect(await util.apply('abcd', { key: 'xy' })).toBe('191b1b1d')
  })

  it('accepts every key format', async () => {
    expect(await util.apply('hi', { key: 'k', keyFormat: 'text' })).toBe('0302')
    expect(await util.apply('hi', { key: '6b', keyFormat: 'hex' })).toBe('0302')
    expect(await util.apply('hi', { key: 'aw==', keyFormat: 'base64' })).toBe('0302')
    expect(await util.apply('hi', { key: '107', keyFormat: 'decimal' })).toBe('0302')
    expect(await util.apply('abcd', { key: '120, 121', keyFormat: 'decimal' })).toBe('191b1b1d')
  })

  it('tolerates separators in a hex key and the url-safe base64 alphabet', async () => {
    // 'hi' ^ de ad -> 0x68^0xde = 0xb6, 0x69^0xad = 0xc4
    expect(await util.apply('hi', { key: 'dead', keyFormat: 'hex' })).toBe('b6c4')
    expect(await util.apply('hi', { key: 'de:ad', keyFormat: 'hex' })).toBe('b6c4')
    expect(await util.apply('hi', { key: 'DE AD', keyFormat: 'hex' })).toBe('b6c4')
    // '-_8' url-safe and '+/8=' standard both decode to the key bytes fb ff
    expect(await util.apply('hi', { key: '-_8', keyFormat: 'base64' })).toBe(
      await util.apply('hi', { key: '+/8=', keyFormat: 'base64' })
    )
    expect(await util.apply('hi', { key: '-_8', keyFormat: 'base64' })).toBe('9396')
  })

  it('supports every output format', async () => {
    expect(await util.apply('hi', { key: 'k', output: 'hex' })).toBe('0302')
    expect(await util.apply('hi', { key: 'k', output: 'base64' })).toBe('AwI=')
    expect(await util.apply('hi', { key: 'k', output: 'text' })).toBe('\u0003\u0002')
    const bytes = await util.apply('hi', { key: 'k', output: 'bytes' })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(bytes as Uint8Array)).toEqual([3, 2])
  })

  it('accepts raw bytes as input', async () => {
    expect(await util.apply(new Uint8Array([0xff, 0x00]), { key: 'ff00', keyFormat: 'hex' })).toBe('0000')
    expect(await util.apply(new Uint8Array([0x00, 0x01]), { key: 'ff', keyFormat: 'hex' })).toBe('fffe')
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', { key: 'k' })).toBe('')
    expect(await util.apply('', {})).toBe('')
    const empty = await util.apply(new Uint8Array([]), { key: 'k', output: 'bytes' })
    expect(Array.from(empty as Uint8Array)).toEqual([])
  })

  it('is involutive, including for unicode', async () => {
    const original = 'héllo 🌍 café'
    const enciphered = await util.apply(original, { key: 'sécret 🔑', output: 'bytes' })
    expect(enciphered).toBeInstanceOf(Uint8Array)
    const back = await util.apply(enciphered, { key: 'sécret 🔑', output: 'text' })
    expect(back).toBe(original)
  })

  it('round-trips ascii through the text output', async () => {
    const once = await util.apply('hi', { key: 'k', output: 'text' })
    expect(await util.apply(once, { key: 'k', output: 'text' })).toBe('hi')
  })

  it('rejects a text output that is not valid utf-8 instead of emitting U+FFFD', async () => {
    // 0xff 0xfe 0x80 is not decodable as utf-8; a lenient decoder would silently
    // return three replacement characters and destroy the ciphertext.
    await expect(async () =>
      util.apply(new Uint8Array([0xff, 0xfe, 0x80]), {
        key: '00',
        keyFormat: 'hex',
        output: 'text'
      })
    ).rejects.toThrow(/not valid utf-8/)
    expect(await util.apply(new Uint8Array([0xff, 0xfe, 0x80]), {
      key: '00',
      keyFormat: 'hex',
      output: 'hex'
    })).toBe('fffe80')
  })

  it('does not mutate the input bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    await util.apply(bytes, { key: 'k', output: 'bytes' })
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4])
  })

  it('throws on a missing or malformed key', async () => {
    await expect(async () => await util.apply('hi', { key: '' })).rejects.toThrow(/requires a key/)
    await expect(async () => await util.apply('hi', { key: 'zz', keyFormat: 'hex' })).rejects.toThrow(/valid hex/)
    await expect(async () => await util.apply('hi', { key: 'abc', keyFormat: 'hex' })).rejects.toThrow(/even number/)
    await expect(async () => await util.apply('hi', { key: '300', keyFormat: 'decimal' })).rejects.toThrow(/out of range/)
    await expect(async () => await util.apply('hi', { key: 'x1', keyFormat: 'decimal' })).rejects.toThrow(/decimal byte list/)
    await expect(async () => await util.apply('hi', { key: '!!!!', keyFormat: 'base64' })).rejects.toThrow(/valid base64/)
  })
})
