import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../columnar_encode/index'

describe('columnar_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('columnar_decode')
    expect(util.name).toBe('columnar transposition decode')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('decodes with the default ZEBRA key', async () => {
    expect(await util.apply('EODAEASRENEIELORCEECWDVFT', {})).toBe('WEAREDISCOVEREDFLEEATONCE')
  })

  it('uses the documented ZEBRA / X defaults', async () => {
    expect(await util.apply('OLXLOXEWXLRXH D', {})).toBe('HELLO WORLD')
    expect(util.params.key.default).toBe('ZEBRA')
    expect(util.params.padChar.default).toBe('X')
  })

  it('strips the trailing pad characters', async () => {
    expect(await util.apply('OLXLOXEWXLRXH D', { key: 'ZEBRA', padChar: 'X' })).toBe('HELLO WORLD')
    expect(await util.apply('OL#LO#EW#LR#H D', { key: 'ZEBRA', padChar: '#' })).toBe('HELLO WORLD')
  })

  it('uses only the first code point of a multi-character pad', async () => {
    expect(await util.apply('OLXLOXEWXLRXH D', { key: 'ZEBRA', padChar: 'XYZ' })).toBe('HELLO WORLD')
    expect(await util.apply('OL🚀LO🚀EW🚀LR🚀H D', { key: 'ZEBRA', padChar: '🚀!' })).toBe(
      'HELLO WORLD'
    )
  })

  it('never strips more pad characters than a full grid could hold', async () => {
    // 5 columns means at most 4 pad cells, so the 5th trailing X is real text.
    expect(await util.apply('XXXXXXXXXX', { key: 'ZEBRA', padChar: 'X' })).toBe('XXXXXX')
  })

  it('keeps every character when the pad character is empty', async () => {
    expect(await util.apply('OLXLOXEWXLRXH D', { key: 'ZEBRA', padChar: '' })).toBe('HELLO WORLDXXXX')
    expect(await util.apply('OLLOEWLRH D', { key: 'ZEBRA', padChar: '' })).toBe('HELLO WORLD')
  })

  it('rebuilds ragged columns when the ciphertext is not a full grid', async () => {
    expect(await util.apply('OLLOEWLRH D', { key: 'ZEBRA', padChar: 'X' })).toBe('HELLO WORLD')
  })

  it('orders columns case-insensitively and keeps duplicate key letters stable', async () => {
    expect(await util.apply('EODAEASRENEIELORCEECWDVFT', { key: 'zebra' })).toBe('WEAREDISCOVEREDFLEEATONCE')
    expect(await util.apply('BHDJFLAGCIEK', { key: 'BANANA', padChar: 'X' })).toBe('ABCDEFGHIJKL')
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { key: '' })).toBe('')
  })

  it('keeps astral characters intact', async () => {
    expect(await util.apply('ab🌍c', { key: 'AB', padChar: 'X' })).toBe('a🌍bc')
  })

  it('round-trips the encoder output, including unicode', async () => {
    const plain = 'Résumé du 🌍 rapport'
    const cipher = await encoder.apply(plain, { key: 'CIPHER', padChar: 'X' })
    expect(cipher).not.toBe(plain)
    expect(await util.apply(cipher, { key: 'CIPHER', padChar: 'X' })).toBe(plain)
  })

  it('throws when the key is empty', async () => {
    await expect(async () => await util.apply('HELLO', { key: '' })).rejects.toThrow(/requires a key/)
  })
})
