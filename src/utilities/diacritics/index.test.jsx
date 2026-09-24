import util from './index'
import { describe, it, expect } from 'vitest'

describe('remove diacritics', () => {
  it('strips accents', () => {
    expect(util.apply('Café')).toBe('Cafe')
  })
  it('handles empty string', () => {
    expect(util.apply('')).toBe('')
  })
  it('handles null', () => {
    expect(util.apply(null)).toBe('')
  })
  it('handles undefined', () => {
    expect(util.apply(undefined)).toBe('')
  })
  it('has correct metadata', () => {
    expect(util.id).toBe('diacritics')
    expect(util.name).toBe('remove diacritics')
    expect(util.description).toBeTypeOf('string')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })    
  it ('should remove all diacritics', () => {
    const input = 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÇçÑñÝýÿ'
    const expected = 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuCcNnYyy'
    expect(util.apply(input)).toBe(expected)
  });
})
