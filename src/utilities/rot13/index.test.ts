import { describe, it, expect } from 'vitest'
import util from './index'

describe('rot13', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('rot13')
    expect(util.category).toBe('Encoding')
  })

  it('encodes lowercase letters', () => {
    expect(util.apply('abc', {})).toBe('nop')
  })

  it('encodes uppercase letters', () => {
    expect(util.apply('ABC', {})).toBe('NOP')
  })

  it('wraps around z', () => {
    expect(util.apply('xyz', {})).toBe('klm')
    expect(util.apply('XYZ', {})).toBe('KLM')
  })

  it('leaves non-letters unchanged', () => {
    expect(util.apply('hello, world! 123', {})).toBe('uryyb, jbeyq! 123')
  })

  it('is its own inverse', () => {
    const encoded = util.apply('Hello World', {}) as string
    expect(util.apply(encoded, {})).toBe('Hello World')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles classic example', () => {
    expect(util.apply('The Quick Brown Fox Jumps Over The Lazy Dog', {}))
      .toBe('Gur Dhvpx Oebja Sbk Whzcf Bire Gur Ynml Qbt')
  })
})
