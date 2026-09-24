import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../vigenere_decode/index'

describe('vigenere_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('vigenere_encode')
    expect(util.name).toBe('vigenère encode')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['key', 'preserveCase', 'skipNonLetters'])
  })

  it('encrypts with the default KEY keyword', async () => {
    expect(await util.apply('hello', {})).toBe('rijvs')
  })

  it('matches the classic LEMON / ATTACKATDAWN vector', async () => {
    expect(await util.apply('ATTACKATDAWN', { key: 'LEMON' })).toBe('LXFOPVEFRNHR')
    // a lower-case keyword produces the same shifts
    expect(await util.apply('ATTACKATDAWN', { key: 'lemon' })).toBe('LXFOPVEFRNHR')
  })

  it('handles empty input without throwing, even with an unusable key', async () => {
    expect(await util.apply('', { key: 'LEMON' })).toBe('')
    expect(await util.apply('', { key: '' })).toBe('')
  })

  it('honours preserveCase', async () => {
    expect(await util.apply('Hello', { key: 'KEY', preserveCase: true })).toBe('Rijvs')
    expect(await util.apply('Hello', { key: 'KEY', preserveCase: false })).toBe('RIJVS')
  })

  it('honours skipNonLetters', async () => {
    expect(await util.apply('ab cd', { key: 'BC', skipNonLetters: true })).toBe('bd df')
    expect(await util.apply('ab cd', { key: 'BC', skipNonLetters: false })).toBe('bd ee')
  })

  it('ignores non-letters in the key itself', async () => {
    // punctuation and spaces in the keyword are dropped, so this is still LEMON
    expect(await util.apply('ATTACKATDAWN', { key: 'L E-M.O.N!' })).toBe('LXFOPVEFRNHR')
    // accented letters are not part of the a-z key alphabet, so LÉMON keys on L,M,O,N
    expect(await util.apply('ATTACKATDAWN', { key: 'LÉMON' })).toBe('LFHNNWOGOMKA')
  })

  it('passes non-ascii characters through untouched', async () => {
    const out = String(await util.apply('héllo 😀 Ω', { key: 'KEY' }))
    // é, the emoji and Ω are not a-z, so with skipNonLetters they do not consume key positions
    expect(out).toBe('répjy 😀 Ω')
    expect(Array.from(out).length).toBe(Array.from('héllo 😀 Ω').length)
    // with skipNonLetters off they each advance the key instead
    expect(await util.apply('héllo 😀 Ω', { key: 'KEY', skipNonLetters: false })).toBe('réjvs 😀 Ω')
  })

  it('round-trips through vigenere_decode, including unicode', async () => {
    const source = 'Attack at dawn, Zoë! 😀 Ωmega'
    const cipher = await util.apply(source, { key: 'LEMON' })
    expect(cipher).toBe('Lxfopv ef rnhr, Lcë! 😀 Ωzpkm')
    expect(await decoder.apply(cipher, { key: 'LEMON' })).toBe(source)
    const cipher2 = await util.apply(source, { key: 'LEMON', skipNonLetters: false })
    expect(cipher2).toBe('Lxfopv mh oeib, Daë! 😀 Ωzpkm')
    expect(cipher2).not.toBe(cipher)
    expect(await decoder.apply(cipher2, { key: 'LEMON', skipNonLetters: false })).toBe(source)
  })

  it('throws when the key has no letters', () => {
    expect(() => util.apply('abc', { key: '' })).toThrow(/key must contain at least one letter/)
    expect(() => util.apply('abc', { key: '123 !' })).toThrow(/key must contain at least one letter/)
  })
})
