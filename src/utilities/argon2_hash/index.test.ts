import { describe, it, expect } from 'vitest'
import util from './index'

// Small work factors so the suite stays fast; the defaults are exercised separately.
const P = { iterations: 2, memoryKiB: 64, parallelism: 1, hashLength: 32, salt: 'saltysaltysalty!' }

/** Pull the raw digest out of a PHC string as hex, so tests can assert against
 *  the published reference vectors (which are distributed as hex, not PHC). */
const digestHex = (encoded: string): string => {
  const b64 = encoded.split('$').pop()!.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return [...bin].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
}

describe('argon2_hash', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('argon2_hash')
    expect(util.name).toBe('argon2 hash')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'hashLength', 'iterations', 'memoryKiB', 'parallelism', 'salt', 'variant'
    ])
  })

  it('hashes a password with argon2id', async () => {
    expect(await util.apply('correct horse battery staple', { ...P, variant: 'argon2id' }))
      .toBe('$argon2id$v=19$m=64,t=2,p=1$c2FsdHlzYWx0eXNhbHR5IQ$7ZtL/1jF+KmJBVI04GFYtj/MvcTekBEilnf+5JUECnQ')
  })

  it('supports the argon2i and argon2d variants', async () => {
    expect(await util.apply('correct horse battery staple', { ...P, variant: 'argon2i' }))
      .toBe('$argon2i$v=19$m=64,t=2,p=1$c2FsdHlzYWx0eXNhbHR5IQ$vsKl9ahZWYLPEa+fwk7dIUtCD+/QjkZok71IFcLmiJA')
    expect(await util.apply('correct horse battery staple', { ...P, variant: 'argon2d' }))
      .toBe('$argon2d$v=19$m=64,t=2,p=1$c2FsdHlzYWx0eXNhbHR5IQ$2loeBLi3QTxdhRf78vbAsVsZy9ArQf4Izf7bu8h1pyk')
  })

  // Ground truth, not self-derived: the phc-winner-argon2 reference vectors for
  // v=19, password "password", salt "somesalt".
  it('reproduces the published argon2 reference vectors', async () => {
    const ref = { variant: 'argon2i', iterations: 2, memoryKiB: 256, hashLength: 32, salt: 'somesalt' }
    expect(digestHex((await util.apply('password', { ...ref, parallelism: 1 })) as string))
      .toBe('89e9029f4637b295beb027056a7336c414fadd43f6b208645281cb214a56452f')
    expect(digestHex((await util.apply('password', { ...ref, parallelism: 2 })) as string))
      .toBe('4ff5ce2769a1d7f4c8a491df09d41a9fbe90e5eb02155a13e4c01e20cd4eab61')
    // the reference implementation's headline vector, PHC string and all
    expect(await util.apply('password', {
      variant: 'argon2i', iterations: 2, memoryKiB: 65536, parallelism: 4, hashLength: 24, salt: 'somesalt'
    })).toBe('$argon2i$v=19$m=65536,t=2,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG')
  })

  it('produces a PHC string that argon2 itself accepts', async () => {
    const { argon2Verify } = await import('hash-wasm')
    for (const variant of ['argon2id', 'argon2i', 'argon2d']) {
      const encoded = (await util.apply('пароль🔐', { ...P, variant })) as string
      expect(await argon2Verify({ password: 'пароль🔐', hash: encoded })).toBe(true)
      expect(await argon2Verify({ password: 'пароль', hash: encoded })).toBe(false)
    }
  })

  it('returns an empty string for empty input', async () => {
    expect(await util.apply('', P)).toBe('')
    expect(await util.apply('', {})).toBe('')
  })

  it('hashes non-ASCII passwords by their UTF-8 bytes', async () => {
    expect(await util.apply('пароль🔐', P))
      .toBe('$argon2id$v=19$m=64,t=2,p=1$c2FsdHlzYWx0eXNhbHR5IQ$jBVxfGzoCjQBcq+4WINk1aMHu4MQCb1vEhkB/bDoDnE')
    expect(await util.apply('пароль', P)).not.toBe(await util.apply('пароль🔐', P))
  })

  it('honours iterations, parallelism, and hash length', async () => {
    expect(await util.apply('hunter2', { ...P, iterations: 3 }))
      .toBe('$argon2id$v=19$m=64,t=3,p=1$c2FsdHlzYWx0eXNhbHR5IQ$NSoBS4ScgCa6Fb1CmOyqTbQezeYp/OD67KWSD6sAN9o')
    expect(await util.apply('hunter2', { ...P, parallelism: 2 }))
      .toBe('$argon2id$v=19$m=64,t=2,p=2$c2FsdHlzYWx0eXNhbHR5IQ$rwsL5jk9HzXLzVlGit08zCLFwUOZcrfk8AdZgnPh+IU')
    expect(await util.apply('hunter2', { ...P, hashLength: 16 }))
      .toBe('$argon2id$v=19$m=64,t=2,p=1$c2FsdHlzYWx0eXNhbHR5IQ$0ZTiwPuPrDDd/uRIV/Rp6g')
  })

  it('honours the memory cost', async () => {
    const big = await util.apply('hunter2', { ...P, memoryKiB: 128 })
    expect(big).toContain('m=128,t=2,p=1')
    expect(big).not.toBe(await util.apply('hunter2', P))
  })

  it('accepts a hex salt as well as a text salt', async () => {
    expect(await util.apply('hunter2', { ...P, salt: '000102030405060708090a0b0c0d0e0f' }))
      .toBe('$argon2id$v=19$m=64,t=2,p=1$AAECAwQFBgcICQoLDA0ODw$VeEsRGPvloVpuwR/8FH/9wD038HGMv6WWWAPcWjX9OI')
  })

  it('generates a random salt and uses argon2id defaults when nothing is configured', async () => {
    const a = await util.apply('hunter2', {})
    const b = await util.apply('hunter2', { salt: '  ' })
    expect(a).toMatch(/^\$argon2id\$v=19\$m=4096,t=3,p=1\$[A-Za-z0-9+/]+\$[A-Za-z0-9+/]{43}$/)
    expect(a).not.toBe(b)
  })

  it('rejects an unknown variant', async () => {
    await expect(util.apply('hunter2', { ...P, variant: 'argon2x' })).rejects.toThrow(/unknown argon2 variant/)
  })

  it('rejects a salt shorter than 8 bytes', async () => {
    await expect(util.apply('hunter2', { ...P, salt: 'short' })).rejects.toThrow(/at least 8 bytes/)
  })

  it('rejects impossible work factors', async () => {
    await expect(util.apply('hunter2', { ...P, iterations: 0 })).rejects.toThrow(/iterations must be at least 1/)
    await expect(util.apply('hunter2', { ...P, parallelism: 0 })).rejects.toThrow(/parallelism must be at least 1/)
    await expect(util.apply('hunter2', { ...P, memoryKiB: 4 })).rejects.toThrow(/memory must be at least/)
    await expect(util.apply('hunter2', { ...P, memoryKiB: 2097152 })).rejects.toThrow(/capped at/)
    await expect(util.apply('hunter2', { ...P, hashLength: 2 })).rejects.toThrow(/at least 4 bytes/)
    await expect(util.apply('hunter2', { ...P, hashLength: 2048 })).rejects.toThrow(/capped at/)
    await expect(util.apply('hunter2', { ...P, iterations: 1.5 })).rejects.toThrow(/whole number/)
  })

  it('caps iterations and parallelism so one stray digit cannot wedge the pipeline', async () => {
    // the pipeline re-runs on every keystroke; t=1e6 would never return
    await expect(util.apply('hunter2', { ...P, iterations: 1000000 })).rejects.toThrow(/iterations is capped/)
    await expect(util.apply('hunter2', { ...P, memoryKiB: 1048576, parallelism: 100000 }))
      .rejects.toThrow(/parallelism is capped/)
    // the ceilings are well clear of anything real
    expect(await util.apply('hunter2', { ...P, iterations: 4 })).toContain('t=4')
  })

  it('scales the minimum memory with parallelism', async () => {
    // argon2 requires m >= 8 * p, so the same 8 KiB is legal at p=1 and not at p=2
    expect(await util.apply('hunter2', { ...P, memoryKiB: 8, parallelism: 1 })).toContain('m=8,t=2,p=1')
    await expect(util.apply('hunter2', { ...P, memoryKiB: 8, parallelism: 2 })).rejects.toThrow(/16 KiB/)
    expect(await util.apply('hunter2', { ...P, memoryKiB: 16, parallelism: 2 })).toContain('m=16,t=2,p=2')
  })
})
