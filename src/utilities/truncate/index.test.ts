import { describe, it, expect } from 'vitest'
import util from './index'

describe('truncate', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('truncate')
    expect(util.name).toBe('truncate')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.length.default).toBe(20)
    expect(util.params.ellipsis.default).toBe('…')
  })

  it('truncates with default ellipsis', () => {
    // length=5, ellipsis='…' (1 char), so 4 chars + '…'
    expect(util.apply('hello world', { length: 5, ellipsis: '…' })).toBe('hell…')
  })

  it('truncates with default ellipsis when ellipsis param is omitted', () => {
    expect(util.apply('hello world', { length: 5 })).toBe('hell…')
  })

  it('does not truncate when string fits within length', () => {
    expect(util.apply('hi', { length: 5, ellipsis: '…' })).toBe('hi')
  })

  it('does not truncate when string equals max length', () => {
    expect(util.apply('hello', { length: 5, ellipsis: '…' })).toBe('hello')
  })

  it('truncates with custom ellipsis', () => {
    expect(util.apply('hello world', { length: 8, ellipsis: '...' })).toBe('hello...')
  })

  it('returns input when length is 0', () => {
    expect(util.apply('hello', { length: 0, ellipsis: '…' })).toBe('hello')
  })

  it('handles length smaller than ellipsis', () => {
    // When L <= reserve, just slices to L
    expect(util.apply('hello world', { length: 1, ellipsis: '...' })).toBe('h')
  })

  it('handles empty string', () => {
    expect(util.apply('', { length: 5, ellipsis: '…' })).toBe('')
  })

  it('handles empty ellipsis', () => {
    expect(util.apply('hello world', { length: 5, ellipsis: '' })).toBe('hello')
  })
})
