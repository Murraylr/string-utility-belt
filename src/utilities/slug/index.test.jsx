import util from './index'
import { describe, it, expect } from 'vitest'

describe('slug', () => {
  it('slugifies', () => {
    expect(util.apply('Hello, Café World!', {})).toBe('hello-cafe-world')
  })
})
