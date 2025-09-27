import util from './index'
import { describe, it, expect } from 'vitest'

describe('remove diacritics', () => {
  it('strips accents', () => {
    expect(util.apply('Café')).toBe('Cafe')
  })
})
