import { describe, it, expect } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

describe('pbkdf2', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('pbkdf2')
    expect(util.name).toBe('pbkdf2')
    expect(util.category).toBe('Hashing')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort())
      .toEqual(['algorithm', 'iterations', 'keyLength', 'output', 'salt'])
  })

  it('matches RFC 6070 vectors for SHA-1', async () => {
    expect(await util.apply('password', { algorithm: 'SHA-1', salt: 'salt', iterations: 1, keyLength: 20 }))
      .toBe('0c60c80f961f0e71f3a9b524af6012062fe037a6')
    expect(await util.apply('password', { algorithm: 'SHA-1', salt: 'salt', iterations: 4096, keyLength: 20 }))
      .toBe('4b007901b765489abead49d926f721d065a429c1')
  })

  it('derives keys for SHA-256 and SHA-512', async () => {
    expect(await util.apply('password', { salt: 'salt', iterations: 1, keyLength: 32 }))
      .toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b')
    expect(await util.apply('password', { algorithm: 'SHA-256', salt: 'salt', iterations: 4096, keyLength: 32 }))
      .toBe('c5e478d59288c841aa530db6845c4c8d962893a001ce4e11a4963873aa98134a')
    expect(await util.apply('password', { algorithm: 'SHA-512', salt: 'salt', iterations: 1, keyLength: 64 }))
      .toBe(
        '867f70cf1ade02cff3752599a3a53dc4af34c7a669815ae5d513554e1c8cf252' +
          'c02d470a285a0501bad999bfe943c08f050235d7d68b1da55e63f73b60a57fce'
      )
  })

  it('honours key length and both output encodings', async () => {
    expect(await util.apply('password', { salt: 'salt', iterations: 2, keyLength: 16 }))
      .toBe('ae4d0c95af6b46d32d0adff928f06dd0')
    const hex = await util.apply('password', { salt: 'salt', iterations: 1, keyLength: 32, output: 'hex' })
    expect(hex).toBe('120fb6cffcf8b32c43e7225256c4f837a86548c92ccc35480805987cb70be17b')
    expect(await util.apply('password', { salt: 'salt', iterations: 1, keyLength: 32, output: 'base64' }))
      .toBe('Eg+2z/z4syxD5yJSVsT4N6hlSMkszDVICAWYfLcL4Xs=')
  })

  it('handles empty input and an empty salt without throwing', async () => {
    expect(await util.apply('', { salt: '', iterations: 1, keyLength: 32 }))
      .toBe('f7ce0b653d2d72a4108cf5abe912ffdd777616dbbb27a70e8204f3ae2d0f6fad')
    expect(await util.apply(new Uint8Array([]), { salt: '', iterations: 1, keyLength: 32 }))
      .toBe('f7ce0b653d2d72a4108cf5abe912ffdd777616dbbb27a70e8204f3ae2d0f6fad')
  })

  it('treats unicode passwords and salts as utf-8', async () => {
    expect(
      await util.apply('pässwörd\u{1F510}', { salt: 'sält', iterations: 1000, keyLength: 16 })
    ).toBe('32b258b24e1fdc31ae357a664d23257b')
    // byte input equals the utf-8 encoding of the same text
    expect(await util.apply(textToUint8Array('pässwörd\u{1F510}'), { salt: 'sält', iterations: 1000, keyLength: 16 }))
      .toBe('32b258b24e1fdc31ae357a664d23257b')
  })

  it('uses the documented defaults when params are omitted', async () => {
    // Pins SHA-256 + empty salt + 100000 iterations + 32 bytes + hex output by
    // value, so a drifted default cannot pass by merely looking like a digest.
    expect(await util.apply('correct horse', {}))
      .toBe('c0921865c3557ec5906c04fe7178f533f0f1565885561a6485f8d6d30fdc8487')
    // ...and the same call written out in full must agree
    expect(
      await util.apply('correct horse', {
        algorithm: 'SHA-256',
        salt: '',
        iterations: 100000,
        keyLength: 32,
        output: 'hex'
      })
    ).toBe('c0921865c3557ec5906c04fe7178f533f0f1565885561a6485f8d6d30fdc8487')
  })

  it('throws on invalid iteration counts and key lengths', async () => {
    await expect(util.apply('password', { iterations: 0 })).rejects.toThrow('at least 1')
    await expect(util.apply('password', { iterations: -5 })).rejects.toThrow('at least 1')
    await expect(util.apply('password', { iterations: 1.5 })).rejects.toThrow('whole number')
    await expect(util.apply('password', { iterations: 1, keyLength: 0 })).rejects.toThrow('at least 1 byte')
    await expect(util.apply('password', { iterations: 1, keyLength: 99999 })).rejects.toThrow('at most 1024')
  })

  it('throws on unknown algorithm or output options', async () => {
    await expect(util.apply('password', { algorithm: 'SHA-384' })).rejects.toThrow('unsupported pbkdf2 algorithm')
    await expect(util.apply('password', { output: 'base64url' })).rejects.toThrow('unsupported pbkdf2 output')
  })
})
