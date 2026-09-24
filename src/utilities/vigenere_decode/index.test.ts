import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../vigenere_encode/index'

describe('vigenere_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('vigenere_decode')
    expect(util.name).toBe('vigenère decode')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['key', 'preserveCase', 'skipNonLetters'])
  })

  it('decrypts with the default KEY keyword', async () => {
    expect(await util.apply('rijvs', {})).toBe('hello')
  })

  it('matches the classic LEMON / LXFOPVEFRNHR vector', async () => {
    expect(await util.apply('LXFOPVEFRNHR', { key: 'LEMON' })).toBe('ATTACKATDAWN')
    expect(await util.apply('LXFOPVEFRNHR', { key: 'lemon' })).toBe('ATTACKATDAWN')
  })

  it('handles empty input without throwing, even with an unusable key', async () => {
    expect(await util.apply('', { key: 'LEMON' })).toBe('')
    expect(await util.apply('', { key: '' })).toBe('')
  })

  it('honours preserveCase', async () => {
    expect(await util.apply('Rijvs', { key: 'KEY', preserveCase: true })).toBe('Hello')
    expect(await util.apply('Rijvs', { key: 'KEY', preserveCase: false })).toBe('HELLO')
  })

  it('honours skipNonLetters', async () => {
    expect(await util.apply('bd df', { key: 'BC', skipNonLetters: true })).toBe('ab cd')
    expect(await util.apply('bd ee', { key: 'BC', skipNonLetters: false })).toBe('ab cd')
  })

  it('ignores non-letters in the key itself', async () => {
    expect(await util.apply('LXFOPVEFRNHR', { key: 'L E-M.O.N!' })).toBe('ATTACKATDAWN')
    // accented letters are not part of the a-z key alphabet, so LÉMON keys on L,M,O,N
    expect(await util.apply('LFHNNWOGOMKA', { key: 'LÉMON' })).toBe('ATTACKATDAWN')
  })

  it('passes non-ascii characters through untouched', async () => {
    const out = String(await util.apply('répjy 😀 Ω', { key: 'KEY' }))
    expect(out).toBe('héllo 😀 Ω')
    expect(Array.from(out).length).toBe(Array.from('répjy 😀 Ω').length)
    // with skipNonLetters off the non-letters advance the key instead
    expect(await util.apply('réjvs 😀 Ω', { key: 'KEY', skipNonLetters: false })).toBe('héllo 😀 Ω')
  })

  it('round-trips text encrypted by vigenere_encode, including unicode', async () => {
    const source = 'Zoë typed: "meet me at 4pm" — 😀 Ωmega'
    const cipher = await encoder.apply(source, { key: 'SUPERSECRET' })
    expect(cipher).toBe('Rië icgwh: "ovim ey px 4ge" — 😀 Ωqgxe')
    expect(await util.apply(cipher, { key: 'SUPERSECRET' })).toBe(source)
    // case is discarded on purpose when preserveCase is off, so it round-trips uppercased
    const ascii = 'Meet me at 4pm!'
    const upper = await encoder.apply(ascii, { key: 'SUPERSECRET', preserveCase: false })
    expect(upper).toBe('EYTX DW EV 4GQ!')
    expect(await util.apply(upper, { key: 'SUPERSECRET', preserveCase: false }))
      .toBe('MEET ME AT 4PM!')
  })

  it('throws when the key has no letters', () => {
    expect(() => util.apply('abc', { key: '' })).toThrow(/key must contain at least one letter/)
    expect(() => util.apply('abc', { key: '-42-' })).toThrow(/key must contain at least one letter/)
  })
})
