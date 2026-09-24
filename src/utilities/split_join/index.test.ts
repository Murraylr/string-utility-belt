import { describe, it, expect } from 'vitest'
import util from './index'

describe('split_join', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('split_join')
    expect(util.category).toBe('String Ops')
    expect(util.params.splitBy.default).toBe(',')
    expect(util.params.joinWith.default).toBe('\n')
  })

  it('splits by comma and joins by newline', () => {
    expect(util.apply('a,b,c', { splitBy: ',', joinWith: '\n' })).toBe('a\nb\nc')
  })

  it('splits by space and joins by dash', () => {
    expect(util.apply('hello world foo', { splitBy: ' ', joinWith: '-' })).toBe('hello-world-foo')
  })

  it('handles no matches for splitter', () => {
    expect(util.apply('hello', { splitBy: ',', joinWith: '-' })).toBe('hello')
  })

  it('handles empty string', () => {
    expect(util.apply('', { splitBy: ',', joinWith: '-' })).toBe('')
  })

  it('handles empty splitter (splits every char)', () => {
    expect(util.apply('abc', { splitBy: '', joinWith: '-' })).toBe('a-b-c')
  })

  it('joins with empty string', () => {
    expect(util.apply('a,b,c', { splitBy: ',', joinWith: '' })).toBe('abc')
  })
})
