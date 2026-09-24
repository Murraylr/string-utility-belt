import { describe, it, expect } from 'vitest'
import util from './index'

describe('diacritics', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('diacritics')
    expect(util.name).toBe('remove diacritics')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('removes accents from common characters', () => {
    expect(util.apply('café', {})).toBe('cafe')
    expect(util.apply('naïve', {})).toBe('naive')
    expect(util.apply('résumé', {})).toBe('resume')
  })

  it('removes all NFD-decomposable diacritics', () => {
    // Note: Ø/ø are standalone Unicode letters (U+00D8/U+00F8), not decomposable by NFD
    const input = 'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÇçÑñÝýÿ'
    const expected = 'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'
    expect(util.apply(input, {})).toBe(expected)
  })

  it('preserves non-diacritical characters unchanged', () => {
    // Ø and ø are NOT diacritical variants — they are distinct letters
    expect(util.apply('Ø', {})).toBe('Ø')
    expect(util.apply('ø', {})).toBe('ø')
  })

  it('handles empty string', () => {
    expect(util.apply('', {})).toBe('')
  })

  it('handles ASCII-only string', () => {
    expect(util.apply('hello world', {})).toBe('hello world')
  })

  it('handles string with numbers and symbols', () => {
    expect(util.apply('café-123!', {})).toBe('cafe-123!')
  })
})
