import { describe, it, expect } from 'vitest'
import util from './index'

describe('length', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('length')
    expect(util.category).toBe('Analysis')
  })

  it('returns length of a string', () => {
    expect(util.apply('hello', {})).toBe('5')
  })

  it('returns 0 for empty string', () => {
    expect(util.apply('', {})).toBe('0')
  })

  it('counts spaces', () => {
    expect(util.apply('a b c', {})).toBe('5')
  })

  it('counts unicode characters', () => {
    expect(util.apply('café', {})).toBe('4')
  })

  it('returns a string, not a number', () => {
    const out = util.apply('hello', {})
    expect(typeof out).toBe('string')
  })
})
