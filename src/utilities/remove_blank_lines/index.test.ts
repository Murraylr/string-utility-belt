import { describe, it, expect } from 'vitest'
import util from './index'

describe('remove_blank_lines', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('remove_blank_lines')
    expect(util.category).toBe('String Ops')
  })

  it('removes empty lines', () => {
    expect(util.apply('a\n\nb\n\nc', {})).toBe('a\nb\nc')
  })

  it('removes whitespace-only lines', () => {
    expect(util.apply('a\n   \nb\n\t\nc', {})).toBe('a\nb\nc')
  })

  it('handles no blank lines', () => {
    expect(util.apply('a\nb\nc', {})).toBe('a\nb\nc')
  })

  it('handles all blank lines', () => {
    expect(util.apply('\n\n\n', {})).toBe('')
  })

  it('handles empty input', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles single line', () => {
    expect(util.apply('hello', {})).toBe('hello')
  })

  it('handles leading and trailing blank lines', () => {
    expect(util.apply('\nhello\n\nworld\n', {})).toBe('hello\nworld')
  })
})
