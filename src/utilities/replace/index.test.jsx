import util from './index'
import { describe, it, expect } from 'vitest'

describe('replace', () => {
  it('replaces with regex', () => {
    expect(util.apply('foo bar baz', { pattern: 'ba.', regex: true, flags: 'g', replacement: 'XX' })).toBe('foo XX XX')
  })
  it('replaces plain string', () => {
    expect(util.apply('spam spam', { pattern: 'spam', regex: false, replacement: 'eggs' })).toBe('eggs eggs')
  })
})
