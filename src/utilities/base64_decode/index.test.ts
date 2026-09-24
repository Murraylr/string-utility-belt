import { describe, it, expect } from 'vitest'
import util from './index'

describe('base64_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('base64_decode')
    expect(util.name).toBe('base64 decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('decodes simple string', () => {
    expect(util.apply('aGk=', {})).toBe('hi')
  })

  it('decodes empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('decodes numeric string', () => {
    expect(util.apply('MTIz', {})).toBe('123')
  })

  it('decodes pangram', () => {
    expect(util.apply('VGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZy4=', {}))
      .toBe('The quick brown fox jumps over the lazy dog.')
  })

  it('decodes unicode content', () => {
    expect(util.apply('4pyT', {})).toBe('✓')
  })

  it('decodes string with spaces', () => {
    expect(util.apply('aGVsbG8gd29ybGQ=', {})).toBe('hello world')
  })

  it('decodes single character', () => {
    expect(util.apply('YQ==', {})).toBe('a')
  })

  it('throws on non-UTF-8 payloads instead of silently corrupting them', () => {
    // '/wCA' decodes to bytes ff 00 80, which are not valid UTF-8
    expect(() => util.apply('/wCA', {})).toThrow()
  })
})
