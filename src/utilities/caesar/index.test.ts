import { describe, it, expect } from 'vitest'
import util from './index'

describe('caesar', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('caesar')
    expect(util.name).toBe('caesar / rot-n')
    expect(util.category).toBe('Ciphers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['mode', 'preserveCase', 'shift'])
  })

  it('shifts by 13 by default (rot13) and is self-inverse', async () => {
    expect(await util.apply('Hello, World!', {})).toBe('Uryyb, Jbeyq!')
    expect(await util.apply(await util.apply('Hello, World!', {}), {})).toBe('Hello, World!')
  })

  it('handles empty input without throwing, even with unusable params', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { shift: 5, mode: 'rot47' })).toBe('')
    // a freshly added step must not report an error before anything is typed
    expect(await util.apply('', { mode: 'bogus' })).toBe('')
    expect(await util.apply('', { shift: 'nope' })).toBe('')
  })

  it('coerces a shift arriving as a string or blank from the params editor', async () => {
    expect(await util.apply('abc', { shift: '3' })).toBe('def')
    expect(await util.apply('abc', { shift: ' -3 ' })).toBe('xyz')
    // a cleared number field falls back to the declared default of 13
    expect(await util.apply('abc', { shift: '' })).toBe('nop')
    expect(await util.apply('abc', { shift: 3.9 })).toBe('def')
  })

  it('supports custom, negative, zero and wrapping shifts', async () => {
    expect(await util.apply('attack at dawn', { shift: 3 })).toBe('dwwdfn dw gdzq')
    expect(await util.apply('dwwdfn dw gdzq', { shift: -3 })).toBe('attack at dawn')
    expect(await util.apply('attack', { shift: 0 })).toBe('attack')
    expect(await util.apply('attack', { shift: 26 })).toBe('attack')
  })

  it('uppercases the output when preserveCase is off', async () => {
    expect(await util.apply('Hello', { shift: 3, preserveCase: true })).toBe('Khoor')
    expect(await util.apply('Hello', { shift: 3, preserveCase: false })).toBe('KHOOR')
  })

  it('rotates printable ascii in rot47 mode', async () => {
    expect(await util.apply('Hello, World!', { shift: 47, mode: 'rot47' })).toBe('w6==@[ (@C=5P')
    // shift 47 over a 94-character alphabet is self-inverse
    expect(await util.apply('w6==@[ (@C=5P', { shift: 47, mode: 'rot47' })).toBe('Hello, World!')
    // the shift is honoured verbatim, it is not forced to 47
    expect(await util.apply('A', { shift: 13, mode: 'rot47' })).toBe('N')
    // wraps at the ends of the printable range, and leaves space (0x20) alone
    expect(await util.apply('~ !', { shift: 1, mode: 'rot47' })).toBe('! "')
    expect(await util.apply('! ~', { shift: -1, mode: 'rot47' })).toBe('~ }')
  })

  it('rotates digits only in alphanumeric mode', async () => {
    expect(await util.apply('abc123', { shift: 5, mode: 'alphanumeric' })).toBe('fgh678')
    expect(await util.apply('abc123', { shift: 5, mode: 'letters' })).toBe('fgh123')
    expect(await util.apply('789', { shift: 5, mode: 'alphanumeric' })).toBe('234')
  })

  it('leaves non-ascii characters and emoji intact', async () => {
    expect(await util.apply('héllo 😀 Ω', { shift: 1 })).toBe('iémmp 😀 Ω')
    // the emoji is one code point, not two surrogate halves to be shifted separately
    const out = String(await util.apply('a😀b', { shift: 47, mode: 'rot47' }))
    expect(out).toBe('2😀3')
    expect(Array.from(out).length).toBe(3)
  })

  it('throws on a non-numeric shift or an unknown mode', () => {
    expect(() => util.apply('abc', { shift: 'nope' })).toThrow(/shift must be a number/)
    expect(() => util.apply('abc', { mode: 'bogus' })).toThrow(/unknown mode/)
  })
})
