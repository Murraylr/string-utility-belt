import { describe, it, expect } from 'vitest'
import util from './index'
import decryptUtil from '../aes_decrypt'

const FAST = { iterations: 1000 }

const b64ToBytes = (b64: string) => {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
const rawLength = (b64: string) => b64ToBytes(b64).length

describe('aes_encrypt', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('aes_encrypt')
    expect(util.name).toBe('aes encrypt')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual([
      'password',
      'mode',
      'keyBits',
      'iterations',
      'output'
    ])
  })

  it('declares the documented defaults', () => {
    const p = util.params as Record<string, { default?: unknown; options?: string[] }>
    expect(p.password.default).toBe('')
    expect(p.mode.default).toBe('GCM')
    expect(p.mode.options).toEqual(['GCM', 'CBC'])
    expect(p.keyBits.default).toBe('256')
    expect(p.keyBits.options).toEqual(['128', '256'])
    expect(p.iterations.default).toBe(100000)
    expect(p.output.default).toBe('base64')
    expect(p.output.options).toEqual(['base64', 'hex'])
  })

  it('encrypts to base64 of salt + iv + ciphertext', async () => {
    const out = (await util.apply('hello', { password: 'hunter2', ...FAST })) as string
    expect(out).toMatch(/^[A-Za-z0-9+/]+={0,2}$/)
    // 16 salt + 12 iv + 5 plaintext + 16 gcm tag
    expect(rawLength(out)).toBe(49)
  })

  it('lays the blob out as salt(16) || iv(12) || ciphertext — checked without aes_decrypt', async () => {
    const password = 'pw'
    const plain = 'wire format'
    const raw = b64ToBytes((await util.apply(plain, { password, ...FAST })) as string)
    expect(raw.length).toBe(16 + 12 + 11 + 16)

    const salt = raw.subarray(0, 16)
    const iv = raw.subarray(16, 28)
    const ciphertext = raw.subarray(28)

    const baseKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password) as BufferSource,
      'PBKDF2',
      false,
      ['deriveKey']
    )
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations: 1000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    )
    const opened = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 },
        key,
        ciphertext as BufferSource
      )
    )
    expect(new TextDecoder().decode(opened)).toBe(plain)
  })

  it('produces a different blob every time (random salt and iv)', async () => {
    const a = (await util.apply('hello', { password: 'hunter2', ...FAST })) as string
    const b = (await util.apply('hello', { password: 'hunter2', ...FAST })) as string
    expect(a).not.toBe(b)
    // the difference starts in the salt, not just in the ciphertext
    expect(a.slice(0, 20)).not.toBe(b.slice(0, 20))
  })

  it('returns empty string for empty input without throwing', async () => {
    expect(await util.apply('', { password: 'hunter2', ...FAST })).toBe('')
    expect(await util.apply(new Uint8Array([]), { password: '', ...FAST })).toBe('')
    // empty input never throws, whatever the params say
    expect(await util.apply('', { password: '', mode: 'ECB', output: 'base85' })).toBe('')
  })

  it('round-trips text and unicode through aes_decrypt', async () => {
    const password = 'correct horse battery staple'
    const plain = 'héllo wörld 👋🏽 — 東京'
    const blob = await util.apply(plain, { password, ...FAST })
    expect(await decryptUtil.apply(blob as string, { password, ...FAST })).toBe(plain)
  })

  it('supports hex output', async () => {
    const out = (await util.apply('hello', {
      password: 'pw',
      output: 'hex',
      ...FAST
    })) as string
    expect(out).toMatch(/^[0-9a-f]+$/)
    expect(out.length).toBe(98)
    expect(
      await decryptUtil.apply(out, { password: 'pw', format: 'hex', ...FAST })
    ).toBe('hello')
  })

  it('supports CBC mode and 128-bit keys', async () => {
    const cbc = (await util.apply('hello', {
      password: 'pw',
      mode: 'CBC',
      keyBits: '128',
      ...FAST
    })) as string
    // 16 salt + 16 iv + 16 padded block
    expect(rawLength(cbc)).toBe(48)
    expect(
      await decryptUtil.apply(cbc, { password: 'pw', mode: 'CBC', keyBits: '128', ...FAST })
    ).toBe('hello')
  })

  it('encrypts raw bytes without mutating the input', async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255])
    const blob = (await util.apply(bytes, { password: 'pw', ...FAST })) as string
    expect(Array.from(bytes)).toEqual([0, 1, 2, 250, 255])
    const back = await decryptUtil.apply(blob, { password: 'pw', output: 'bytes', ...FAST })
    expect(back).toBeInstanceOf(Uint8Array)
    expect(Array.from(back as Uint8Array)).toEqual([0, 1, 2, 250, 255])
  })

  it('derives with exactly 100000 iterations when none is given', async () => {
    // decrypting with the iteration count spelled out pins the implicit default
    const blob = (await util.apply('defaults', { password: 'pw' })) as string
    expect(await decryptUtil.apply(blob, { password: 'pw', iterations: 100000 })).toBe('defaults')
    await expect(decryptUtil.apply(blob, { password: 'pw', iterations: 99999 })).rejects.toThrow(
      /decryption failed/
    )
  })

  it('throws on a missing password', async () => {
    await expect(util.apply('hello', {})).rejects.toThrow(/password is required/)
  })

  it('throws on unsupported options', async () => {
    await expect(util.apply('hello', { password: 'pw', mode: 'ECB' })).rejects.toThrow(
      /unsupported mode/
    )
    await expect(util.apply('hello', { password: 'pw', keyBits: '512' })).rejects.toThrow(
      /unsupported key size/
    )
    await expect(util.apply('hello', { password: 'pw', iterations: 0 })).rejects.toThrow(
      /iterations must be a whole number/
    )
    await expect(util.apply('hello', { password: 'pw', iterations: 2.5 })).rejects.toThrow(
      /iterations must be a whole number/
    )
    await expect(
      util.apply('hello', { password: 'pw', output: 'base85', ...FAST })
    ).rejects.toThrow(/unsupported output/)
  })
})
