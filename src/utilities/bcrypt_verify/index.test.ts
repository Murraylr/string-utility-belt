import { describe, it, expect } from 'vitest'
import util from './index'
import hashUtil from '../bcrypt_hash/index'

// Hashes produced with a fixed 16-byte salt (00 01 02 … 0f).
const SALT = '..CA.uOD/eaGAOmJB.yMBu'
const H_ASCII = '$2a$04$..CA.uOD/eaGAOmJB.yMBuaOWmnNUFfwORoH..MfuhEhaBiFsYEfG'
const H_UNICODE = '$2a$04$..CA.uOD/eaGAOmJB.yMBu18hWFFv0ibHu447OSm87zIEO/NAXPU6'
const H_COST5 = '$2a$05$..CA.uOD/eaGAOmJB.yMBug2q2CK1LPMlnGrOl3jjoYwsl5.AMMFW'

describe('bcrypt_verify', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('bcrypt_verify')
    expect(util.name).toBe('bcrypt verify')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(Object.keys(util.params)).toEqual(['hash'])
  })

  it('matches the correct password', async () => {
    expect(await util.apply('correct horse battery staple', { hash: H_ASCII })).toEqual({
      match: true,
      algorithm: '2a',
      cost: 4,
      salt: SALT,
      reason: ''
    })
  })

  it('rejects the wrong password', async () => {
    const result: any = await util.apply('correct horse battery stapler', { hash: H_ASCII })
    expect(result.match).toBe(false)
    expect(result.reason).toMatch(/does not match/)
  })

  it('matches a non-ASCII password by its UTF-8 bytes', async () => {
    const ok: any = await util.apply('пароль🔐', { hash: H_UNICODE })
    expect(ok.match).toBe(true)
    // dropping the astral character must not still match
    const bad: any = await util.apply('пароль', { hash: H_UNICODE })
    expect(bad.match).toBe(false)
  })

  it('reports the variant, cost, and salt of the hash', async () => {
    const result: any = await util.apply('hunter2', { hash: H_COST5 })
    expect(result).toEqual({ match: true, algorithm: '2a', cost: 5, salt: SALT, reason: '' })
  })

  // Ground truth: a published OpenBSD/jBCrypt vector, not a hash this repo made.
  it('verifies a published OpenBSD bcrypt vector', async () => {
    const ok: any = await util.apply('abc', { hash: '$2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i' })
    expect(ok).toEqual({ match: true, algorithm: '2a', cost: 6, salt: 'If6bvum7DFjUnE9p2uDeDu', reason: '' })
    const no: any = await util.apply('abd', { hash: '$2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i' })
    expect(no.match).toBe(false)
  })

  // $2b$ (node bcrypt) and $2y$ (PHP password_hash) are what people actually
  // paste; they are byte-identical to $2a$ and must verify, not just parse.
  it('verifies $2b$ and $2y$ hashes, reporting the variant it was given', async () => {
    for (const prefix of ['2a', '2b', '2y'] as const) {
      const result: any = await util.apply('correct horse battery staple', { hash: `$${prefix}$${H_ASCII.slice(4)}` })
      expect(result.match).toBe(true)
      expect(result.algorithm).toBe(prefix)
    }
  })

  it('refuses $2x$ hashes it cannot check correctly', async () => {
    // $2x$ marks the buggy crypt_blowfish sign-extension behaviour; answering
    // with correct-bcrypt semantics would be confidently wrong for 8-bit input
    await expect(util.apply('correct horse battery staple', { hash: `$2x$${H_ASCII.slice(4)}` }))
      .rejects.toThrow(/crypt_blowfish/)
  })

  it('round-trips against bcrypt_hash, including a random salt and Unicode', async () => {
    for (const password of ['hunter2', 'пароль🔐', '~!@#$%^&*()']) {
      const hash = (await hashUtil.apply(password, { cost: 4 })) as string
      const ok: any = await util.apply(password, { hash })
      expect(ok.match).toBe(true)
      expect(ok.cost).toBe(4)
      expect(ok.salt).toBe(hash.slice(7, 29))
      const no: any = await util.apply(`${password}x`, { hash })
      expect(no.match).toBe(false)
    }
  })

  it('refuses a password containing a NUL instead of reporting a false match', async () => {
    // bcrypt stops at the first NUL, so 'abc\0anything' would match a hash of 'abc'
    const hashOfAbc = (await hashUtil.apply('abc', { cost: 4 })) as string
    await expect(util.apply('abc\0not-the-password', { hash: hashOfAbc })).rejects.toThrow(/NUL/)
  })

  it('returns json instead of throwing for empty input', async () => {
    const result: any = await util.apply('', { hash: H_ASCII })
    expect(result.match).toBe(false)
    expect(result.reason).toMatch(/empty/)
    expect(result.cost).toBe(4)
  })

  it('returns json instead of throwing when no hash is configured', async () => {
    expect(await util.apply('hunter2', {})).toEqual({
      match: false,
      algorithm: '',
      cost: 0,
      salt: '',
      reason: 'no bcrypt hash supplied'
    })
    expect(await util.apply('', { hash: '   ' })).toMatchObject({ match: false })
  })

  it('tolerates surrounding whitespace around the hash', async () => {
    const result: any = await util.apply('hunter2', { hash: `\n  ${H_COST5}  \n` })
    expect(result.match).toBe(true)
  })

  it('throws on a malformed hash', async () => {
    await expect(util.apply('hunter2', { hash: 'not-a-hash' })).rejects.toThrow(/not a bcrypt hash/)
    await expect(util.apply('hunter2', { hash: H_ASCII.slice(0, -1) })).rejects.toThrow(/not a bcrypt hash/)
    await expect(util.apply('hunter2', { hash: `$2c$04$${'a'.repeat(53)}` })).rejects.toThrow(/not a bcrypt hash/)
  })

  it('throws on a hash with an impossible cost factor', async () => {
    await expect(util.apply('hunter2', { hash: `$2b$99$${'a'.repeat(53)}` })).rejects.toThrow(/cost factor/)
    await expect(util.apply('hunter2', { hash: `$2b$00$${'a'.repeat(53)}` })).rejects.toThrow(/cost factor/)
  })

  it('throws on passwords longer than bcrypt supports', async () => {
    await expect(util.apply('a'.repeat(73), { hash: H_ASCII })).rejects.toThrow(/72 bytes/)
  })
})
