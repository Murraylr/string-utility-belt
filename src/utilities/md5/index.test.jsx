import util from './index'
import { describe, it, expect } from 'vitest'

describe('md5', () => {
  it('hashes abc', () => {
    expect(util.apply('abc', {})).toBe('900150983cd24fb0d6963f7d28e17f72')
  })
})
