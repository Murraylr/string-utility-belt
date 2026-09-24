import { describe, it, expect } from 'vitest'
import util from './index'

describe('normalize_line_endings', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('normalize_line_endings')
    expect(util.name).toBe('normalize line endings')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params).sort()).toEqual(['finalNewline', 'mode'])
  })

  it('normalizes every flavour to LF by default', async () => {
    expect(await util.apply('a\r\nb\rc\nd', {})).toBe('a\nb\nc\nd')
  })

  it('converts to CRLF', async () => {
    expect(await util.apply('a\nb\r\nc\rd', { mode: 'crlf' })).toBe('a\r\nb\r\nc\r\nd')
  })

  it('converts to CR', async () => {
    expect(await util.apply('a\r\nb\nc', { mode: 'cr' })).toBe('a\rb\rc')
  })

  it('keeps blank lines and the existing final newline under keep', async () => {
    expect(await util.apply('a\r\n\r\nb\r\n', { mode: 'lf', finalNewline: 'keep' })).toBe('a\n\nb\n')
  })

  it('adds a final newline only when one is missing', async () => {
    expect(await util.apply('a\nb', { mode: 'lf', finalNewline: 'add' })).toBe('a\nb\n')
    expect(await util.apply('a\nb\n', { mode: 'lf', finalNewline: 'add' })).toBe('a\nb\n')
    expect(await util.apply('a', { mode: 'crlf', finalNewline: 'add' })).toBe('a\r\n')
  })

  it('removes trailing newlines', async () => {
    expect(await util.apply('a\r\nb\r\n\r\n', { mode: 'lf', finalNewline: 'remove' })).toBe('a\nb')
  })

  it('detects mixed endings as json', async () => {
    const out = await util.apply('a\r\nb\nc\rd', { mode: 'detect' }) as Record<string, unknown>
    expect(typeof out).toBe('object')
    expect(out).toEqual({ crlf: 1, lf: 1, cr: 1, mixed: true, dominant: 'crlf' })
  })

  it('applies the final newline rule in the target flavour', async () => {
    expect(await util.apply('a\nb', { mode: 'cr', finalNewline: 'add' })).toBe('a\rb\r')
    expect(await util.apply('a\nb\n\n', { mode: 'crlf', finalNewline: 'remove' })).toBe('a\r\nb')
  })

  it('names the most common ending as dominant, not just the first one seen', async () => {
    expect(await util.apply('a\r\nb\nc\nd', { mode: 'detect' }))
      .toEqual({ crlf: 1, lf: 2, cr: 0, mixed: true, dominant: 'lf' })
    expect(await util.apply('a\rb\rc', { mode: 'detect' }))
      .toEqual({ crlf: 0, lf: 0, cr: 2, mixed: false, dominant: 'cr' })
  })

  it('detects a consistent LF document', async () => {
    expect(await util.apply('a\nb\nc', { mode: 'detect' }))
      .toEqual({ crlf: 0, lf: 2, cr: 0, mixed: false, dominant: 'lf' })
  })

  it('reports no endings for a single line and for empty input', async () => {
    expect(await util.apply('just one line', { mode: 'detect' }))
      .toEqual({ crlf: 0, lf: 0, cr: 0, mixed: false, dominant: 'none' })
    expect(await util.apply('', { mode: 'detect' }))
      .toEqual({ crlf: 0, lf: 0, cr: 0, mixed: false, dominant: 'none' })
  })

  it('preserves unicode content untouched', async () => {
    expect(await util.apply('héllo 🎉\r\nwörld', { mode: 'lf' })).toBe('héllo 🎉\nwörld')
  })

  it('returns empty string for empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { mode: 'crlf', finalNewline: 'add' })).toBe('')
  })

  it('throws on an unknown mode or final newline option', () => {
    expect(() => util.apply('a\nb', { mode: 'nel' } as any)).toThrow(/mode must be one of/)
    expect(() => util.apply('a\nb', { finalNewline: 'maybe' } as any)).toThrow(/finalNewline must be one of/)
  })
})
