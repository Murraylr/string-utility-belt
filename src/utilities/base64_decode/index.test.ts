import { describe, it, expect } from 'vitest'
import util from './index'

describe('base64_decode', () => {
  it('decodes string', async () => {
    const out = await util.apply('aGk=', {})
    expect(out).toBe('hi')
  })
  it('decodes empty string', async () => {
    const out = await util.apply('', {})
    expect(out).toBe('')
  })
  it('decodes numbers', async () => {
    const input = 'MTIz';
    const expectedOutput = '123';
    const out = await util.apply(input, {});
    expect(out).toBe(expectedOutput);
  })
  it('decodes a string correctly', async () => {
    const input = 'VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZy4=';
    const expectedOutput = 'The quick brown fox jumps over the lazy dog.';
    const out = await util.apply(input, {});
    expect(out).toBe(expectedOutput);
  })
})
