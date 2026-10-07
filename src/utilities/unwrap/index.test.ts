import { describe, it, expect } from 'vitest'
import util from './index'

/** Spelled by code point on purpose: a literal NBSP would be invisible in the source. */
const NBSP = String.fromCharCode(0x00a0)

describe('unwrap', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('unwrap')
    expect(util.name).toBe('unwrap / reflow')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'preserveIndented',
      'preserveLists',
      'separator'
    ])
  })

  it('joins soft-wrapped lines and keeps blank lines as paragraph breaks', async () => {
    expect(await util.apply('The quick\nbrown fox', {})).toBe('The quick brown fox')
    expect(await util.apply('a\nb\n\nc\nd', {})).toBe('a b\n\nc d')
  })

  it('undoes a word_wrap-style hard wrap, trailing spaces included', async () => {
    const wrapped = 'The quick \nbrown fox \njumps over \nthe lazy dog'
    expect(await util.apply(wrapped, {})).toBe('The quick brown fox jumps over the lazy dog')
    expect(await util.apply('a\r\nb', {})).toBe('a b')
  })

  it('keeps list items on their own lines unless told not to', async () => {
    const list = '- one\n  continued\n- two\n1. numbered\n   wrapped'
    expect(await util.apply(list, { preserveLists: true }))
      .toBe('- one continued\n- two\n1. numbered wrapped')
    expect(await util.apply('- one\n  continued\n- two', { preserveLists: false }))
      .toBe('- one continued - two')
  })

  it('recognises bullet, numbered and lettered markers alike', async () => {
    const markers = '* a\n+ b\n1) c\nd. e\n- f'
    expect(await util.apply(markers, {})).toBe(markers)
    // a marker needs a space and some content after it, so a horizontal rule is text
    expect(await util.apply('para\n---\nmore', {})).toBe('para --- more')
  })

  it('recognises the bullets text copied from a PDF carries, and parenthesised markers', async () => {
    const docs = 'Areas:\n\u25cf Account setup\n\u25cf Importing contacts from a CSV\nfile or a CRM\n\u25cb nested\n\u25a0 square\n\uf0b7 Word symbol bullet'
    expect(await util.apply(docs, {}))
      .toBe('Areas:\n\u25cf Account setup\n\u25cf Importing contacts from a CSV file or a CRM\n\u25cb nested\n\u25a0 square\n\uf0b7 Word symbol bullet')
    const clauses = 'The Supplier shall:\n(a) deliver within 30 days of the\norder date;\n(b) keep records; and\n(iv) report yearly.\n(12) Notices.'
    expect(await util.apply(clauses, {}))
      .toBe('The Supplier shall:\n(a) deliver within 30 days of the order date;\n(b) keep records; and\n(iv) report yearly.\n(12) Notices.')
    // a parenthesised word is prose, not a marker
    expect(await util.apply('wrapped\n(see below) more', {})).toBe('wrapped (see below) more')
  })

  it('keeps indented blocks verbatim unless told not to', async () => {
    const src = 'intro text\n    code();\ntail'
    expect(await util.apply(src, { preserveIndented: true })).toBe('intro text\n    code();\ntail')
    expect(await util.apply(src, { preserveIndented: false })).toBe('intro text code(); tail')
    // a tab counts as a full 4-column stop, so one tab is already an indented block
    expect(await util.apply('intro\n\tcode();\ntail', {})).toBe('intro\n\tcode();\ntail')
    // three columns is still a soft-wrapped continuation
    expect(await util.apply('intro\n   three\ntail', {})).toBe('intro three tail')
  })

  it('joins with a custom separator, taken literally', async () => {
    expect(await util.apply('one\ntwo', { separator: ' | ' })).toBe('one | two')
    expect(await util.apply('日本\n語です', { separator: '' })).toBe('日本語です')
    // '$&' is a replacement pattern, not a separator directive
    expect(await util.apply('a\nb', { separator: '$& ' })).toBe('a$& b')
  })

  it('keeps non-breaking spaces that a plain trim would swallow', async () => {
    expect(await util.apply('a\n' + NBSP + 'b', {})).toBe('a ' + NBSP + 'b')
    expect(await util.apply('10' + NBSP + '\n000 kr', {})).toBe('10' + NBSP + ' 000 kr')
  })

  it('handles empty input, trailing newlines and unicode', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('a\nb\n', {})).toBe('a b\n')
    expect(await util.apply('emoji 😀\ncontinues 漢字', {})).toBe('emoji 😀 continues 漢字')
  })

  it('throws when the separator would defeat the unwrap', () => {
    expect(() => util.apply('a\nb', { separator: '\n' })).toThrow(/line break/)
    expect(() => util.apply('a\nb', { separator: '\r\n' })).toThrow(/separator/)
  })
})
