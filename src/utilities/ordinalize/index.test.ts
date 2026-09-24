import { describe, it, expect } from 'vitest'
import util from './index'

describe('ordinalize', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('ordinalize')
    expect(util.name).toBe('ordinalize')
    expect(util.category).toBe('Numbers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['perLine', 'style'])
    expect(util.params.style).toMatchObject({ kind: 'select', default: 'suffix' })
    expect(util.params.perLine).toMatchObject({ kind: 'boolean', default: true })
  })

  it('adds the right suffix (default style)', async () => {
    expect(await util.apply('1', {})).toBe('1st')
    expect(await util.apply('2', {})).toBe('2nd')
    expect(await util.apply('3', {})).toBe('3rd')
    expect(await util.apply('4', {})).toBe('4th')
    expect(await util.apply('0', {})).toBe('0th')
  })

  it('handles the 11/12/13 exceptions and their multiples', async () => {
    expect(await util.apply('11\n12\n13', {})).toBe('11th\n12th\n13th')
    expect(await util.apply('21\n22\n23', {})).toBe('21st\n22nd\n23rd')
    expect(await util.apply('111\n112\n113', {})).toBe('111th\n112th\n113th')
    expect(await util.apply('101', {})).toBe('101st')
    expect(await util.apply('1011\n1012\n1013', {})).toBe('1011th\n1012th\n1013th')
  })

  it('spells ordinals out with style: words', async () => {
    expect(await util.apply('1', { style: 'words' })).toBe('first')
    expect(await util.apply('2', { style: 'words' })).toBe('second')
    expect(await util.apply('12', { style: 'words' })).toBe('twelfth')
    expect(await util.apply('20', { style: 'words' })).toBe('twentieth')
    expect(await util.apply('42', { style: 'words' })).toBe('forty-second')
    expect(await util.apply('100', { style: 'words' })).toBe('one hundredth')
    expect(await util.apply('101', { style: 'words' })).toBe('one hundred first')
    expect(await util.apply('1000000', { style: 'words' })).toBe('one millionth')
    expect(await util.apply('0', { style: 'words' })).toBe('zeroth')
  })

  it('stays exact past Number.MAX_SAFE_INTEGER', async () => {
    expect(await util.apply('12345678901234567890', {})).toBe('12345678901234567890th')
    expect(await util.apply('12345678901234567891', {})).toBe('12345678901234567891st')
    expect(await util.apply('9007199254740993', {})).toBe('9007199254740993rd')
  })

  it('is idempotent on already-ordinal input and keeps digit grouping', async () => {
    expect(await util.apply('3rd', {})).toBe('3rd')
    expect(await util.apply('21ST', {})).toBe('21st')
    expect(await util.apply('3rd', { style: 'words' })).toBe('third')
    expect(await util.apply('1,234', {})).toBe('1,234th')
    expect(await util.apply('1,234', { style: 'words' }))
      .toBe('one thousand two hundred thirty-fourth')
  })

  it('handles non-ASCII minus signs', async () => {
    expect(await util.apply('−3', {})).toBe('-3rd')
    expect(await util.apply('–7', {})).toBe('-7th')
    expect(await util.apply('−3', { style: 'words' })).toBe('negative third')
    expect(await util.apply('+2', {})).toBe('2nd')
  })

  it('honours perLine in both states', async () => {
    expect(await util.apply('1\n2\n3', { perLine: true })).toBe('1st\n2nd\n3rd')
    expect(await util.apply('1\n\n3', { perLine: true })).toBe('1st\n\n3rd')
    expect(await util.apply('  7  ', { perLine: true })).toBe('  7th  ')
    expect(await util.apply('  7  ', { perLine: false })).toBe('  7th  ')
    expect(() => util.apply('1\n2', { perLine: false })).toThrow(/not a whole number/)
  })

  it('returns empty input untouched', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('   ')
    expect(await util.apply('\n\n', { style: 'words' })).toBe('\n\n')
  })

  it('throws on non-numeric, badly grouped and detached-suffix input', () => {
    expect(() => util.apply('abc', {})).toThrow(/not a whole number/)
    expect(() => util.apply('3.5', {})).toThrow(/not a whole number/)
    expect(() => util.apply('fourth', {})).toThrow(/not a whole number/)
    // separators are honoured only for well-formed 3-digit groups
    expect(() => util.apply('1 2', {})).toThrow(/not a whole number/)
    expect(() => util.apply('1,2', {})).toThrow(/not a whole number/)
    // the ordinal suffix has to sit on the digits, so "12 st" is not 12
    expect(() => util.apply('12 st', {})).toThrow(/not a whole number/)
    expect(() => util.apply('1', { style: 'roman' })).toThrow(/unknown style/)
  })
})
