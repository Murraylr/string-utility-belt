import { describe, it, expect } from 'vitest'
import util from './index'

describe('chunk', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('chunk')
    expect(util.name).toBe('chunk')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['size', 'unit', 'separator', 'padLast', 'padChar'])
  })

  it('chunks characters with the default newline separator', async () => {
    expect(await util.apply('abcdefghij', { size: 3 })).toBe('abc\ndef\nghi\nj')
    expect(await util.apply('4111111111111111', { size: 4, separator: ' ' })).toBe('4111 1111 1111 1111')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { unit: 'words', size: 2, padLast: true })).toBe('')
  })

  it('uses the declared defaults when no params are supplied', async () => {
    expect(await util.apply('abcdefghijklm', {})).toBe('abcdefghij\nklm')
  })

  it('chunks words', async () => {
    expect(await util.apply('one two three four five', { unit: 'words', size: 2 }))
      .toBe('one two\nthree four\nfive')
  })

  it('chunks lines and ignores a trailing newline', async () => {
    expect(await util.apply('a\nb\nc\nd\ne\n', { unit: 'lines', size: 2, separator: '---\n' }))
      .toBe('a\nb---\nc\nd---\ne')
  })

  it('pads the last chunk when padLast is on', async () => {
    expect(await util.apply('abcdefgh', { size: 5, padLast: true })).toBe('abcde\nfgh  ')
    expect(await util.apply('abcdefgh', { size: 5, padLast: true, padChar: '.' })).toBe('abcde\nfgh..')
    expect(await util.apply('one two three', { unit: 'words', size: 2, padLast: true, padChar: '-' }))
      .toBe('one two\nthree -')
    expect(await util.apply('a\nb\nc', { unit: 'lines', size: 2, padLast: true, padChar: 'x' }))
      .toBe('a\nb\nc\nx')
  })

  it('leaves the last chunk short when padLast is off', async () => {
    expect(await util.apply('abcdefgh', { size: 5, padLast: false })).toBe('abcde\nfgh')
  })

  it('adds no padding when the last chunk is already full', async () => {
    expect(await util.apply('abcdef', { size: 3, padLast: true })).toBe('abc\ndef')
    expect(await util.apply('one two', { unit: 'words', size: 2, padLast: true, padChar: '-' })).toBe('one two')
  })

  it('treats cleared param fields as their declared defaults', async () => {
    // The params editor emits '' for a cleared number field and Number('') is 0.
    expect(await util.apply('abcdefghijklm', { size: '' })).toBe('abcdefghij\nklm')
    expect(await util.apply('abcdef', { size: 3, unit: '' })).toBe('abc\ndef')
  })

  it('chunks non-ASCII words and lines', async () => {
    expect(await util.apply('привет мир как дела', { unit: 'words', size: 2 })).toBe('привет мир\nкак дела')
    expect(await util.apply('日本\n語\nテスト', { unit: 'lines', size: 2, separator: '|' })).toBe('日本\n語|テスト')
  })

  it('decodes backslash escapes in the separator', async () => {
    expect(await util.apply('abcd', { size: 2, separator: '\\t' })).toBe('ab\tcd')
    expect(await util.apply('abcd', { size: 2, separator: '\\\\n' })).toBe('ab\\ncd')
  })

  it('chunks by code point so astral characters survive', async () => {
    const out = String(await util.apply('👍🎉🚀🌟', { size: 2, separator: '|' }))
    expect(out).toBe('👍🎉|🚀🌟')
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out)).toBe(false)
    expect(await util.apply('café', { size: 2, separator: '-' })).toBe('ca-fé')
  })

  it('throws on an invalid size or unit', () => {
    expect(() => util.apply('abc', { size: 0 })).toThrow(/at least 1/)
    expect(() => util.apply('abc', { size: -3 })).toThrow(/at least 1/)
    expect(() => util.apply('abc', { size: 'nope' })).toThrow(/at least 1/)
    expect(() => util.apply('abc', { size: 2, unit: 'paragraphs' })).toThrow(/unknown unit/)
  })
})
