import { describe, it, expect } from 'vitest'
import util from './index'

// 16 salt bytes 00 01 02 … 0f, in each of the accepted spellings.
const SALT_HEX = '000102030405060708090a0b0c0d0e0f'
const SALT_BCRYPT_B64 = '..CA.uOD/eaGAOmJB.yMBu'
const SALT_TEXT = 'a-16-byte-salt!!'

describe('bcrypt_hash', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('bcrypt_hash')
    expect(util.name).toBe('bcrypt hash')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['cost', 'salt'])
  })

  it('hashes a password with a fixed salt', async () => {
    expect(await util.apply('correct horse battery staple', { cost: 4, salt: SALT_HEX }))
      .toBe('$2a$04$..CA.uOD/eaGAOmJB.yMBuaOWmnNUFfwORoH..MfuhEhaBiFsYEfG')
  })

  // Ground truth, not self-derived: these are the published OpenBSD/jBCrypt
  // bcrypt test vectors. If the salt decoding or the wiring into hash-wasm ever
  // drifts, these break even though the implementation stays self-consistent.
  it('reproduces the published OpenBSD bcrypt test vectors', async () => {
    expect(await util.apply('a', { cost: 6, salt: 'm0CrhHm10qJ3lXRY.5zDGO' }))
      .toBe('$2a$06$m0CrhHm10qJ3lXRY.5zDGO3rS2KdeeWLuGmsfGlMfOxih58VYVfxe')
    expect(await util.apply('abc', { cost: 6, salt: 'If6bvum7DFjUnE9p2uDeDu' }))
      .toBe('$2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i')
    expect(await util.apply('abcdefghijklmnopqrstuvwxyz', { cost: 6, salt: '.rCVZVOThsIa97pEDOxvGu' }))
      .toBe('$2a$06$.rCVZVOThsIa97pEDOxvGuRRgzG64bvtJ0938xuqzv18d3ZpQhstC')
    expect(await util.apply('~!@#$%^&*()      ~!@#$%^&*()PNBFRD', { cost: 6, salt: 'fPIsBO8qRqkjj273rfaOI.' }))
      .toBe('$2a$06$fPIsBO8qRqkjj273rfaOI.HtSV9jLDpTbZn782DC6/t7qT67P6FfO')
    expect(await util.apply('abc', { cost: 8, salt: 'Ro0CUfOqk6cXEKf3dyaM7O' }))
      .toBe('$2a$08$Ro0CUfOqk6cXEKf3dyaM7OhSCvnwM9s4wIX9JeLapehKK5YdLxKcm')
  })

  it('returns an empty string for empty input', async () => {
    expect(await util.apply('', { cost: 4, salt: SALT_HEX })).toBe('')
    expect(await util.apply('', {})).toBe('')
  })

  it('hashes non-ASCII passwords by their UTF-8 bytes', async () => {
    expect(await util.apply('пароль🔐', { cost: 4, salt: SALT_HEX }))
      .toBe('$2a$04$..CA.uOD/eaGAOmJB.yMBu18hWFFv0ibHu447OSm87zIEO/NAXPU6')
    // an emoji must not collide with the same string minus the emoji
    expect(await util.apply('пароль', { cost: 4, salt: SALT_HEX }))
      .not.toBe(await util.apply('пароль🔐', { cost: 4, salt: SALT_HEX }))
  })

  it('accepts a 22-character bcrypt salt copied out of an existing hash', async () => {
    const fromB64 = await util.apply('hunter2', { cost: 4, salt: SALT_BCRYPT_B64 })
    const fromHex = await util.apply('hunter2', { cost: 4, salt: SALT_HEX })
    expect(fromB64).toBe(fromHex)
    expect(fromB64).toBe('$2a$04$..CA.uOD/eaGAOmJB.yMBurkTM.teJW4P/NXJXOT49X8IHvXALk4i')
  })

  it('accepts 16 bytes of plain text as the salt', async () => {
    const hash = await util.apply('hunter2', { cost: 4, salt: SALT_TEXT })
    expect(hash).toMatch(/^\$2a\$04\$[./A-Za-z0-9]{53}$/)
    expect(hash).not.toBe(await util.apply('hunter2', { cost: 4, salt: SALT_HEX }))
    expect(await util.apply('hunter2', { cost: 4, salt: '0123456789abcdef' }))
      .toBe('$2a$04$KBCwKxOzLha2MUDgW0PjXeFaAPh7cxmjSZ5c00P8D0A2tzxy8Lhdy')
  })

  it('respects the cost factor', async () => {
    const cost5 = await util.apply('hunter2', { cost: 5, salt: SALT_HEX })
    expect(cost5).toBe('$2a$05$..CA.uOD/eaGAOmJB.yMBug2q2CK1LPMlnGrOl3jjoYwsl5.AMMFW')
    expect(cost5).not.toBe(await util.apply('hunter2', { cost: 4, salt: SALT_HEX }))
  })

  it('generates a random salt when none is supplied', async () => {
    const a = await util.apply('hunter2', { cost: 4 })
    const b = await util.apply('hunter2', { cost: 4, salt: '   ' })
    expect(a).toMatch(/^\$2a\$04\$[./A-Za-z0-9]{53}$/)
    expect(b).toMatch(/^\$2a\$04\$[./A-Za-z0-9]{53}$/)
    expect(a).not.toBe(b)
  })

  it('defaults to cost 10', async () => {
    expect(await util.apply('hunter2', {})).toMatch(/^\$2a\$10\$[./A-Za-z0-9]{53}$/)
  })

  it('rejects an out-of-range or non-integer cost', async () => {
    await expect(util.apply('hunter2', { cost: 3, salt: SALT_HEX })).rejects.toThrow(/between 4 and 31/)
    await expect(util.apply('hunter2', { cost: 32, salt: SALT_HEX })).rejects.toThrow(/between 4 and 31/)
    await expect(util.apply('hunter2', { cost: 4.5, salt: SALT_HEX })).rejects.toThrow(/whole number/)
  })

  it('accepts a 0x- or 0X-prefixed hex salt', async () => {
    const plain = await util.apply('hunter2', { cost: 4, salt: SALT_HEX })
    expect(await util.apply('hunter2', { cost: 4, salt: `0x${SALT_HEX}` })).toBe(plain)
    expect(await util.apply('hunter2', { cost: 4, salt: `0X${SALT_HEX}` })).toBe(plain)
    // whitespace inside a hex salt is ignored too
    expect(await util.apply('hunter2', { cost: 4, salt: '00010203 04050607 08090a0b 0c0d0e0f' })).toBe(plain)
  })

  it('pulls the salt out of a whole hash or settings string pasted into the salt field', async () => {
    const full = '$2a$04$..CA.uOD/eaGAOmJB.yMBuaOWmnNUFfwORoH..MfuhEhaBiFsYEfG'
    expect(await util.apply('hunter2', { cost: 4, salt: full }))
      .toBe(await util.apply('hunter2', { cost: 4, salt: SALT_HEX }))
    // the bare `$2b$06$<salt>` settings string works the same way, and the cost
    // in the pasted string does not override the cost param
    expect(await util.apply('abc', { cost: 6, salt: '$2b$12$If6bvum7DFjUnE9p2uDeDu' }))
      .toBe('$2a$06$If6bvum7DFjUnE9p2uDeDu0YHzrHM6tf.iqN8.yx.jNN1ILEf7h0i')
  })

  it('refuses a password containing a NUL rather than silently truncating it', async () => {
    // bcrypt is C-string based, so "abc\0def" would otherwise hash as "abc"
    await expect(util.apply('abc\0def', { cost: 4, salt: SALT_HEX })).rejects.toThrow(/NUL/)
    expect(await util.apply('abc', { cost: 4, salt: SALT_HEX }))
      .toBe('$2a$04$..CA.uOD/eaGAOmJB.yMBufJvSTjTdkBYlZeYThHDpJ4wbwLwg8EG')
  })

  it('rejects a salt that is not 16 bytes', async () => {
    await expect(util.apply('hunter2', { cost: 4, salt: 'too short' })).rejects.toThrow(/16 bytes/)
    await expect(util.apply('hunter2', { cost: 4, salt: 'abc' })).rejects.toThrow(/16 bytes/)
    // a hash-shaped string with a corrupt salt section is not silently accepted
    await expect(util.apply('hunter2', { cost: 4, salt: '$2a$04$short' })).rejects.toThrow(/16 bytes/)
  })

  it('rejects passwords longer than bcrypt supports', async () => {
    await expect(util.apply('a'.repeat(73), { cost: 4, salt: SALT_HEX })).rejects.toThrow(/72 bytes/)
    // 72 characters of ASCII is fine, but 72 characters of emoji is 288 bytes
    await expect(util.apply('🔐'.repeat(19), { cost: 4, salt: SALT_HEX })).rejects.toThrow(/72 bytes/)
  })
})
