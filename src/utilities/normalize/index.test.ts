import { describe, it, expect } from 'vitest'
import util from './index'

describe('normalize', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('normalize')
    expect(util.name).toBe('normalize')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.form).toMatchObject({ options: ['NFC', 'NFD', 'NFKC', 'NFKD'] })
    expect(util.params.form.default).toBe('NFC')
  })

  it('NFC: composes decomposed characters', () => {
    // e + combining acute = é
    const decomposed = 'e\u0301'
    expect(util.apply(decomposed, { form: 'NFC' })).toBe('é')
  })

  it('NFD: decomposes composed characters', () => {
    const out = util.apply('é', { form: 'NFD' }) as string
    expect(out).toBe('e\u0301')
    expect(out.length).toBe(2)
  })

  it('NFKC: normalizes compatibility characters', () => {
    // ﬁ ligature -> fi
    expect(util.apply('\uFB01', { form: 'NFKC' })).toBe('fi')
  })

  it('NFKD: decomposes compatibility characters', () => {
    expect(util.apply('\uFB01', { form: 'NFKD' })).toBe('fi')
  })

  it('handles empty string', () => {
    expect(util.apply('', { form: 'NFC' })).toBe('')
  })

  it('handles ASCII-only string (no change)', () => {
    expect(util.apply('hello', { form: 'NFC' })).toBe('hello')
  })

  it('defaults to NFC when form is omitted', () => {
    const decomposed = 'e\u0301'
    expect(util.apply(decomposed, {})).toBe('é')
  })
})
