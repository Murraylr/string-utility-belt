import { describe, it, expect } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

describe('base64_encode', () => {
  it('encodes string', async () => {
    const out = await util.apply('hi', {})
    expect(out).toBe('aGk=')
  })
  it('encodes bytes', async () => {
    const out = await util.apply(textToUint8Array('ok'), {})
    expect(out).toBe('b2s=')
  })
  it('encodes empty string', async () => {
    const out = await util.apply('', {})
    expect(out).toBe('')
  })
  it('encodes empty bytes', async () => {
    const out = await util.apply(new Uint8Array([]), {})
    expect(out).toBe('')
  })
  it('encodes numbers', async () => {
    const input = '123';
    const expectedOutput = 'MTIz';
    const out = await util.apply(input, {});
    expect(out).toBe(expectedOutput);
  })
  it('encodes a string correctly', async () => {
    const input = 'The quick brown fox jumps over the lazy dog.';
    const expectedOutput = 'VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZy4=';
    const out = await util.apply(input, {});
    expect(out).toBe(expectedOutput);
  })
})
