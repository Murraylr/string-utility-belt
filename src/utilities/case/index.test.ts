import { describe, it, expect } from 'vitest'
import util from './index'

describe('case utility', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('case')
    expect(util.name).toBe('change case')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.mode).toMatchObject({ options: ['upper', 'lower', 'title', 'sentence'] })
    expect(util.params.mode.default).toBe('upper')
  })

  it('converts to upper case', () => {
    expect(util.apply('hello World', { mode: 'upper' })).toBe('HELLO WORLD')
  })

  it('converts to lower case', () => {
    expect(util.apply('Hello WORLD', { mode: 'lower' })).toBe('hello world')
  })

  it('converts to title case', () => {
    expect(util.apply('hello world', { mode: 'title' })).toBe('Hello World')
    expect(util.apply('hELLO wORLD', { mode: 'title' })).toBe('Hello World')
  })

  it('converts to sentence case (first char upper, rest lower)', () => {
    expect(util.apply('hello world', { mode: 'sentence' })).toBe('Hello world')
    expect(util.apply('HELLO WORLD', { mode: 'sentence' })).toBe('Hello world')
    expect(util.apply('hElLo wOrLd', { mode: 'sentence' })).toBe('Hello world')
    expect(util.apply('hello', { mode: 'sentence' })).toBe('Hello')
    expect(util.apply('HELLO', { mode: 'sentence' })).toBe('Hello')
  })

  it('handles empty string', () => {
    expect(util.apply('', { mode: 'upper' })).toBe('')
    expect(util.apply('', { mode: 'lower' })).toBe('')
    expect(util.apply('', { mode: 'title' })).toBe('')
    expect(util.apply('', { mode: 'sentence' })).toBe('')
  })

  it('uses default mode (upper) when mode is omitted', () => {
    expect(util.apply('abc', {})).toBe('ABC')
  })

  it('handles non-alphabetic characters', () => {
    expect(util.apply('12345!@#$', { mode: 'upper' })).toBe('12345!@#$')
    expect(util.apply('12345!@#$', { mode: 'lower' })).toBe('12345!@#$')
  })

  it('handles mixed alphanumeric (upper uppercases all letters)', () => {
    expect(util.apply('Hello 3v1l World!', { mode: 'upper' })).toBe('HELLO 3V1L WORLD!')
  })

  it('handles mixed alphanumeric (lower)', () => {
    expect(util.apply('Hello 3v1l World!', { mode: 'lower' })).toBe('hello 3v1l world!')
  })

  it('handles mixed alphanumeric (title)', () => {
    expect(util.apply('hElLo 3v1l wOrLd!', { mode: 'title' })).toBe('Hello 3v1l World!')
  })
})
