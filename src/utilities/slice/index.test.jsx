import util from './index'
import { describe, it, expect } from 'vitest'

describe('slice', () => {
  it('slices correctly', () => {
    expect(util.apply('abcdef', { start: 1, end: 4 })).toBe('bcd')
  })
})
