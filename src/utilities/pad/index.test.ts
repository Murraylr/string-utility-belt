import { describe, it, expect } from 'vitest'
import util from './index'

describe('pad', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('pad')
    expect(util.category).toBe('String Ops')
    expect(util.params.length.default).toBe(10)
    expect(util.params.char.default).toBe(' ')
    expect(util.params.side.default).toBe('end')
  })

  it('pads end by default', () => {
    expect(util.apply('hi', { length: 5, char: '.', side: 'end' })).toBe('hi...')
  })

  it('pads start', () => {
    expect(util.apply('42', { length: 5, char: '0', side: 'start' })).toBe('00042')
  })

  it('pads both sides', () => {
    const out = util.apply('hi', { length: 6, char: '-', side: 'both' })
    expect(out).toBe('--hi--')
  })

  it('pads both sides with odd padding', () => {
    const out = util.apply('hi', { length: 7, char: '-', side: 'both' })
    // 5 total padding: 2 left, 3 right
    expect(out).toBe('--hi---')
  })

  it('does not truncate if string is longer than target', () => {
    expect(util.apply('hello', { length: 3, char: '.', side: 'end' })).toBe('hello')
  })

  it('handles empty string', () => {
    expect(util.apply('', { length: 3, char: 'x', side: 'end' })).toBe('xxx')
  })

  it('handles zero length', () => {
    expect(util.apply('abc', { length: 0, char: '.', side: 'end' })).toBe('abc')
  })
})
