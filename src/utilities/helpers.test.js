
import { describe, it, expect } from 'vitest'
import { slugify, normalizeCase } from './helpers'

describe('helpers', () => {
  it('slugify works', () => {
    expect(slugify('Héllo World!')).toBe('hello-world')
  })
  it('normalizeCase upper', () => {
    expect(normalizeCase('abc', 'upper')).toBe('ABC')
  })
})
