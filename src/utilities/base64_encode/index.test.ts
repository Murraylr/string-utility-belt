import { describe, it, expect } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

describe('base64_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base64_encode')
    expect(util.name).toBe('base64_encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('string')
  })

  it('encodes simple string', async () => {
    expect(await util.apply('hi', {})).toBe('aGk=')
  })

  it('encodes empty string', async () => {
    expect(await util.apply('', {})).toBe('')
  })

  it('encodes numeric string', async () => {
    expect(await util.apply('123', {})).toBe('MTIz')
  })

  it('encodes pangram', async () => {
    expect(await util.apply('The quick brown fox jumps over the lazy dog.', {}))
      .toBe('VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZy4=')
  })

  it('encodes bytes (Uint8Array)', async () => {
    expect(await util.apply(textToUint8Array('ok'), {})).toBe('b2s=')
  })

  it('encodes empty bytes', async () => {
    expect(await util.apply(new Uint8Array([]), {})).toBe('')
  })

  it('encodes unicode string', async () => {
    expect(await util.apply('✓', {})).toBe('4pyT')
  })

  it('encodes single character', async () => {
    expect(await util.apply('a', {})).toBe('YQ==')
  })

  it('encodes raw byte values', async () => {
    expect(await util.apply(new Uint8Array([97, 98, 99]), {})).toBe('YWJj')
  })
})
