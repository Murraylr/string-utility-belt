import { describe, it, expect } from 'vitest'
import util from './index'

describe('indent', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('indent')
    expect(util.name).toBe('indent / dedent')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['amount', 'character', 'mode', 'skipBlank'])
  })

  it('adds indentation to every line by default', async () => {
    expect(await util.apply('one\ntwo', {})).toBe('  one\n  two')
    expect(await util.apply('one', { mode: 'add', amount: 4 })).toBe('    one')
    expect(await util.apply('  keep\n  me', { amount: 0 })).toBe('  keep\n  me')
  })

  it('indents with tab characters', async () => {
    expect(await util.apply('a\nb', { character: 'tab', amount: 1 })).toBe('\ta\n\tb')
    expect(await util.apply('a', { character: 'tab', amount: 2 })).toBe('\t\ta')
  })

  it('honours skipBlank in both states', async () => {
    expect(await util.apply('a\n\nb', {})).toBe('  a\n\n  b')
    expect(await util.apply('a\n\nb', { skipBlank: false })).toBe('  a\n  \n  b')
  })

  it('removes up to `amount` leading units', async () => {
    expect(await util.apply('    a\n  b\nc', { mode: 'remove', amount: 2 })).toBe('  a\nb\nc')
    expect(await util.apply('\t\tx', { mode: 'remove', character: 'tab', amount: 1 })).toBe('\tx')
    // spaces are not tabs: removing tabs leaves a space-indented line alone
    expect(await util.apply('    a', { mode: 'remove', character: 'tab', amount: 2 })).toBe('    a')
  })

  it('honours skipBlank when removing too', async () => {
    expect(await util.apply('    a\n    \n    b', { mode: 'remove', amount: 2, skipBlank: true }))
      .toBe('  a\n    \n  b')
    expect(await util.apply('    a\n    \n    b', { mode: 'remove', amount: 2, skipBlank: false }))
      .toBe('  a\n  \n  b')
  })

  it('auto-dedents by the common leading whitespace', async () => {
    expect(await util.apply('    a\n      b\n\n    c', { mode: 'auto-dedent' })).toBe('a\n  b\n\nc')
    expect(await util.apply('a\n  b', { mode: 'auto-dedent' })).toBe('a\n  b')
    expect(await util.apply('\t\ta\n\t\t\tb', { mode: 'auto-dedent' })).toBe('a\n\tb')
    // blank lines shorter than the common prefix simply lose their whitespace
    expect(await util.apply('    a\n  \n    b', { mode: 'auto-dedent' })).toBe('a\n\nb')
  })

  it('preserves CRLF line endings and never indents past a trailing newline', async () => {
    expect(await util.apply('a\r\nb', {})).toBe('  a\r\n  b')
    expect(await util.apply('a\n', {})).toBe('  a\n')
    expect(await util.apply('a\n', { skipBlank: false })).toBe('  a\n')
  })

  it('handles empty input and unicode without corrupting characters', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('😀\n漢字', {})).toBe('  😀\n  漢字')
    expect(Array.from(String(await util.apply('😀', { amount: 1 })))).toEqual([' ', '😀'])
  })

  it('throws on invalid params', () => {
    expect(() => util.apply('a', { amount: -1 })).toThrow(/amount/)
    expect(() => util.apply('a', { mode: 'sideways' })).toThrow(/unknown mode/)
    expect(() => util.apply('a', { character: 'emdash' })).toThrow(/unknown character/)
    expect(() => util.apply('a', { amount: 1.5 })).toThrow(/whole number/)
  })
})
