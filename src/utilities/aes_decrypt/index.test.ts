import { describe, it, expect } from 'vitest'
import util from './index'
import encryptUtil from '../aes_encrypt'

const FAST = { iterations: 1000 }

/**
 * Reference vectors produced independently by node/OpenSSL, not by this codebase:
 *
 *   key   = pbkdf2Sync('correct horse', salt, 1000, keyLen, 'sha256')
 *   blob  = salt || iv || ciphertext(|| gcm tag)
 *   salt  = 000102030405060708090a0b0c0d0e0f
 *   iv    = 101112131415161718191a1b (GCM) / 202122232425262728292a2b2c2d2e2f (CBC)
 *   plain = 'attack at dawn 🌅'
 */
const VECTOR_PASSWORD = 'correct horse'
const VECTOR_PLAIN = 'attack at dawn 🌅'
const GCM_256_B64 =
  'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaG59rpw7zSPK658NPwP3GeRDnnj2GPG5J2An9vxYgKjhdMm7s'
const GCM_256_HEX =
  '000102030405060708090a0b0c0d0e0f101112131415161718191a1b9f6ba70e' +
  'f348f2bae7c34fc0fdc67910e79e3d863c6e49d809fdbf16202a385d326eec'
const CBC_128_B64 =
  'AAECAwQFBgcICQoLDA0ODyAhIiMkJSYnKCkqKywtLi/NpRsg44bi4aoOxyVmDE7U60iznPcaHhEDaaQ2qYQOJw=='

describe('aes_decrypt', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('aes_decrypt')
    expect(util.name).toBe('aes decrypt')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'bytes'])
    expect(Object.keys(util.params)).toEqual([
      'password',
      'mode',
      'keyBits',
      'iterations',
      'format',
      'output'
    ])
    const p = util.params as Record<string, { default?: unknown; options?: string[] }>
    expect(p.mode.default).toBe('GCM')
    expect(p.keyBits.default).toBe('256')
    expect(p.iterations.default).toBe(100000)
    expect(p.format.default).toBe('auto')
    expect(p.output.default).toBe('text')
  })

  it('decrypts an externally produced AES-256-GCM vector', async () => {
    expect(
      await util.apply(GCM_256_B64, { password: VECTOR_PASSWORD, ...FAST })
    ).toBe(VECTOR_PLAIN)
    expect(
      await util.apply(GCM_256_HEX, { password: VECTOR_PASSWORD, format: 'hex', ...FAST })
    ).toBe(VECTOR_PLAIN)
  })

  it('decrypts an externally produced AES-128-CBC vector', async () => {
    expect(
      await util.apply(CBC_128_B64, {
        password: VECTOR_PASSWORD,
        mode: 'CBC',
        keyBits: '128',
        ...FAST
      })
    ).toBe(VECTOR_PLAIN)
  })

  it('accepts the url-safe alphabet and missing padding', async () => {
    const urlSafe = CBC_128_B64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(urlSafe).toMatch(/_/)
    expect(
      await util.apply(urlSafe, {
        password: VECTOR_PASSWORD,
        mode: 'CBC',
        keyBits: '128',
        ...FAST
      })
    ).toBe(VECTOR_PLAIN)
  })

  it('round-trips text encrypted by aes_encrypt', async () => {
    const blob = (await encryptUtil.apply('the eagle lands at dawn', {
      password: 'pw',
      ...FAST
    })) as string
    expect(await util.apply(blob, { password: 'pw', ...FAST })).toBe('the eagle lands at dawn')
  })

  it('round-trips unicode exactly', async () => {
    const plain = 'naïve café 🍰 — 日本語テキスト 👨‍👩‍👧‍👦'
    const blob = (await encryptUtil.apply(plain, { password: 'ünïcode', ...FAST })) as string
    expect(await util.apply(blob, { password: 'ünïcode', ...FAST })).toBe(plain)
  })

  it('returns empty output for empty input without throwing', async () => {
    expect(await util.apply('', { password: 'pw', ...FAST })).toBe('')
    const empty = await util.apply('   ', { password: '', output: 'bytes' })
    expect(empty).toBeInstanceOf(Uint8Array)
    expect((empty as Uint8Array).length).toBe(0)
    // empty input never throws, whatever the params say
    expect(await util.apply('', { password: '', mode: 'ECB', format: 'base85', output: 'json' })).toBe('')
  })

  it('reads hex and auto-detects the input format', async () => {
    const hex = (await encryptUtil.apply('hex payload', {
      password: 'pw',
      output: 'hex',
      ...FAST
    })) as string
    expect(await util.apply(hex, { password: 'pw', format: 'hex', ...FAST })).toBe('hex payload')
    expect(await util.apply(hex, { password: 'pw', format: 'auto', ...FAST })).toBe('hex payload')

    const b64 = (await encryptUtil.apply('b64 payload', { password: 'pw', ...FAST })) as string
    expect(await util.apply(b64, { password: 'pw', format: 'base64', ...FAST })).toBe('b64 payload')
  })

  it('ignores whitespace inside the blob', async () => {
    const blob = (await encryptUtil.apply('wrapped', { password: 'pw', ...FAST })) as string
    const wrapped = blob.replace(/(.{16})/g, '$1\n')
    expect(await util.apply(wrapped, { password: 'pw', ...FAST })).toBe('wrapped')
  })

  it('returns raw bytes when output is bytes', async () => {
    const blob = (await encryptUtil.apply(new Uint8Array([255, 0, 128]), {
      password: 'pw',
      ...FAST
    })) as string
    const out = await util.apply(blob, { password: 'pw', output: 'bytes', ...FAST })
    expect(out).toBeInstanceOf(Uint8Array)
    expect(Array.from(out as Uint8Array)).toEqual([255, 0, 128])
    // non-utf8 plaintext must be reported rather than mangled when text is asked for
    await expect(util.apply(blob, { password: 'pw', ...FAST })).rejects.toThrow(
      /not valid UTF-8/
    )
  })

  it('decrypts CBC with a 128-bit key', async () => {
    const blob = (await encryptUtil.apply('block mode', {
      password: 'pw',
      mode: 'CBC',
      keyBits: '128',
      ...FAST
    })) as string
    expect(
      await util.apply(blob, { password: 'pw', mode: 'CBC', keyBits: '128', ...FAST })
    ).toBe('block mode')
  })

  it('throws on the wrong password, key size, mode or iteration count', async () => {
    const blob = (await encryptUtil.apply('secret', { password: 'right', ...FAST })) as string
    await expect(util.apply(blob, { password: 'wrong', ...FAST })).rejects.toThrow(
      /decryption failed/
    )
    await expect(
      util.apply(blob, { password: 'right', keyBits: '128', ...FAST })
    ).rejects.toThrow(/decryption failed/)
    await expect(util.apply(blob, { ...FAST, password: 'right', iterations: 999 })).rejects.toThrow(
      /decryption failed/
    )
    // a GCM blob read as CBC is not a whole number of blocks
    await expect(
      util.apply(blob, { password: 'right', mode: 'CBC', ...FAST })
    ).rejects.toThrow(/not a multiple of the AES block size/)
  })

  it('throws on tampered ciphertext', async () => {
    const blob = (await encryptUtil.apply('tamper me', {
      password: 'pw',
      output: 'hex',
      ...FAST
    })) as string
    const flipped = blob.slice(0, -1) + (blob.slice(-1) === '0' ? '1' : '0')
    await expect(
      util.apply(flipped, { password: 'pw', format: 'hex', ...FAST })
    ).rejects.toThrow(/decryption failed/)
  })

  it('throws clear errors for bad configuration and malformed input', async () => {
    await expect(util.apply('AAAA', {})).rejects.toThrow(/password is required/)
    await expect(util.apply('AAAA', { password: 'pw', ...FAST })).rejects.toThrow(
      /ciphertext is too short/
    )
    await expect(util.apply('not base64 ***!', { password: 'pw', ...FAST })).rejects.toThrow(
      /not valid base64/
    )
    await expect(
      util.apply('abc', { password: 'pw', format: 'hex', ...FAST })
    ).rejects.toThrow(/not valid hex/)
    await expect(
      util.apply('zzzz', { password: 'pw', format: 'hex', ...FAST })
    ).rejects.toThrow(/not valid hex/)
    await expect(
      util.apply('a'.repeat(120), { password: 'pw', mode: 'CBC', format: 'base64', ...FAST })
    ).rejects.toThrow(/not a multiple of the AES block size/)
    await expect(
      util.apply(GCM_256_B64, { password: 'pw', format: 'base85', ...FAST })
    ).rejects.toThrow(/unsupported input format/)
    await expect(
      util.apply(GCM_256_B64, { password: 'pw', output: 'json', ...FAST })
    ).rejects.toThrow(/unsupported output/)
  })
})
