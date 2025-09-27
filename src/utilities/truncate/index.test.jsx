import util from './index'
import { describe, it, expect } from 'vitest'

describe('truncate', () => {
  it('adds ellipsis by default', () => {
    expect(util.apply('hello world', { length: 5 })).toBe('he…')
  })
})
