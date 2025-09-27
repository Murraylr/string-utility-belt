import util from './index'
import { describe, it, expect } from 'vitest'

describe('unicode normalize', () => {
  it('normalizes using NFC', () => {
    const combined = '\u00E9' // é
    const decomposed = 'e\u0301'
    expect(util.apply(decomposed, { form: 'NFC' })).toBe(combined.normalize('NFC'))
  })
})
