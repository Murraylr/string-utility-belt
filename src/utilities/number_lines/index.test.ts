import { describe, it, expect } from 'vitest'
import util from './index'

describe('number_lines', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('number_lines')
    expect(util.category).toBe('Formatting')
    expect(util.params.start.default).toBe(1)
    expect(util.params.separator.default).toBe(': ')
  })

  it('numbers lines starting from 1', () => {
    expect(util.apply('a\nb\nc', { start: 1, separator: ': ' }))
      .toBe('1: a\n2: b\n3: c')
  })

  it('numbers lines starting from custom number', () => {
    expect(util.apply('a\nb', { start: 10, separator: ': ' }))
      .toBe('10: a\n11: b')
  })

  it('uses custom separator', () => {
    expect(util.apply('a\nb', { start: 1, separator: '. ' }))
      .toBe('1. a\n2. b')
  })

  it('handles single line', () => {
    expect(util.apply('hello', { start: 1, separator: ': ' }))
      .toBe('1: hello')
  })

  it('handles empty string', () => {
    expect(util.apply('', { start: 1, separator: ': ' }))
      .toBe('1: ')
  })

  it('handles zero start', () => {
    expect(util.apply('a\nb', { start: 0, separator: ': ' }))
      .toBe('0: a\n1: b')
  })
})
