
import { describe, it, expect } from 'vitest'
import { md5, slugify, normalizeCase } from './helpers'

describe('helpers', () => {
  it('md5 hashes correctly for known case', () => {
    expect(md5('hello')).toBe('5d41402abc4b2a76b9719d911017c592')
  })
  it('slugify works', () => {
    expect(slugify('Héllo World!')).toBe('hello-world')
  })
  it('normalizeCase upper', () => {
    expect(normalizeCase('abc', 'upper')).toBe('ABC')
  })
})
