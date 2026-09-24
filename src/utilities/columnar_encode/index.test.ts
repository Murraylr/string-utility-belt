import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../columnar_decode/index'

describe('columnar_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('columnar_encode')
    expect(util.name).toBe('columnar transposition encode')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('encodes with the default ZEBRA key', async () => {
    expect(await util.apply('WEAREDISCOVEREDFLEEATONCE', {})).toBe('EODAEASRENEIELORCEECWDVFT')
  })

  it('pads the final row with the pad character', async () => {
    expect(await util.apply('HELLO WORLD', { key: 'ZEBRA', padChar: 'X' })).toBe('OLXLOXEWXLRXH D')
    expect(await util.apply('HELLO WORLD', { key: 'ZEBRA', padChar: '#' })).toBe('OL#LO#EW#LR#H D')
  })

  it('uses the documented ZEBRA / X defaults', async () => {
    expect(await util.apply('HELLO WORLD', {})).toBe('OLXLOXEWXLRXH D')
    expect(util.params.key.default).toBe('ZEBRA')
    expect(util.params.padChar.default).toBe('X')
  })

  it('uses only the first code point of a multi-character pad', async () => {
    expect(await util.apply('HELLO WORLD', { key: 'ZEBRA', padChar: 'XYZ' })).toBe('OLXLOXEWXLRXH D')
    expect(await util.apply('HELLO WORLD', { key: 'ZEBRA', padChar: '🚀!' })).toBe(
      'OL🚀LO🚀EW🚀LR🚀H D'
    )
  })

  it('leaves ragged columns when the pad character is empty', async () => {
    expect(await util.apply('HELLO WORLD', { key: 'ZEBRA', padChar: '' })).toBe('OLLOEWLRH D')
  })

  it('round-trips losslessly with an empty pad even when the text ends in X', async () => {
    // Padding is inherently ambiguous: the ciphertext carries no length, so a
    // plaintext ending in the pad character cannot survive a padded round-trip.
    // The ragged (empty pad) mode has no such ambiguity.
    for (const plain of ['AX', 'HELLO WORLDX', 'ABCDEFGHIJKLMNOPQRSX']) {
      const ragged = await util.apply(plain, { key: 'ZEBRA', padChar: '' })
      expect(await decoder.apply(ragged, { key: 'ZEBRA', padChar: '' })).toBe(plain)
    }
  })

  it('orders columns case-insensitively and keeps duplicate key letters stable', async () => {
    expect(await util.apply('WEAREDISCOVEREDFLEEATONCE', { key: 'zebra' })).toBe('EODAEASRENEIELORCEECWDVFT')
    expect(await util.apply('ABCDEFGHIJKL', { key: 'BANANA', padChar: 'X' })).toBe('BHDJFLAGCIEK')
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { key: '' })).toBe('')
  })

  it('keeps astral characters intact', async () => {
    expect(await util.apply('a🌍bc', { key: 'AB', padChar: 'X' })).toBe('ab🌍c')
    expect(Array.from(await util.apply('🌍🚀🎉🎈', { key: 'AB' }) as string)).toHaveLength(4)
  })

  it('handles an astral key and astral pad character', async () => {
    const plain = 'Meet 🌍 at dawn'
    const cipher = (await util.apply(plain, { key: '🌍ab', padChar: '🚀' })) as string
    expect(cipher).not.toContain('�')
    expect(await decoder.apply(cipher, { key: '🌍ab', padChar: '🚀' })).toBe(plain)
  })

  it('round-trips through columnar_decode, including unicode', async () => {
    const plain = 'Meet at the café 🌍 tonight'
    const padded = await util.apply(plain, { key: 'ZEBRA', padChar: 'X' })
    expect(await decoder.apply(padded, { key: 'ZEBRA', padChar: 'X' })).toBe(plain)

    const ragged = await util.apply(plain, { key: 'SECRET', padChar: '' })
    expect(await decoder.apply(ragged, { key: 'SECRET', padChar: '' })).toBe(plain)
  })

  it('throws when the key is empty', async () => {
    await expect(async () => await util.apply('HELLO', { key: '' })).rejects.toThrow(/requires a key/)
  })
})
