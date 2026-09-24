import { describe, it, expect } from 'vitest'
import util from './index'

describe('insert_at', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('insert_at')
    expect(util.name).toBe('insert at position')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['text', 'position', 'mode', 'perLine'])
  })

  it('inserts at a positive position', async () => {
    expect(await util.apply('abc', { text: '>', position: 0 })).toBe('>abc')
    expect(await util.apply('abc', { text: '-', position: 1 })).toBe('a-bc')
    expect(await util.apply('abc', { text: '<', position: 3 })).toBe('abc<')
  })

  it('clamps positions past either end', async () => {
    expect(await util.apply('abc', { text: '<', position: 99 })).toBe('abc<')
    expect(await util.apply('abc', { text: '>', position: -99 })).toBe('>abc')
  })

  it('counts negative positions from the end', async () => {
    expect(await util.apply('abc', { text: '-', position: -1 })).toBe('ab-c')
    expect(await util.apply('2024', { text: '-', position: -2 })).toBe('20-24')
  })

  it('overwrites instead of shifting when mode is overwrite', async () => {
    expect(await util.apply('abcdef', { text: 'XY', position: 2, mode: 'overwrite' })).toBe('abXYef')
    expect(await util.apply('abc', { text: 'XYZ', position: 2, mode: 'overwrite' })).toBe('abXYZ')
    expect(await util.apply('abcdef', { text: 'XY', position: 2, mode: 'insert' })).toBe('abXYcdef')
  })

  it('overwrites relative to the end for a negative position', async () => {
    expect(await util.apply('abcdef', { text: 'XY', position: -2, mode: 'overwrite' })).toBe('abcdXY')
    expect(await util.apply('abcdef', { text: 'XY', position: -4, mode: 'overwrite' })).toBe('abXYef')
  })

  it('works line by line', async () => {
    expect(await util.apply('a\nb', { text: '# ', position: 0, perLine: true })).toBe('# a\n# b')
    expect(await util.apply('a\nb', { text: '# ', position: 0, perLine: false })).toBe('# a\nb')
    expect(await util.apply('a\r\nb', { text: '#', position: 0, perLine: true })).toBe('#a\r\n#b')
  })

  it('never throws on empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { text: 'x', position: 5 })).toBe('x')
  })

  it('measures positions in code points, not UTF-16 units', async () => {
    expect(await util.apply('a😀b', { text: 'X', position: 2 })).toBe('a😀Xb')
    expect(await util.apply('a😀b', { text: 'X', position: 1, mode: 'overwrite' })).toBe('aXb')
    expect(await util.apply('😀😀', { text: '|', position: -1 })).toBe('😀|😀')
  })

  it('understands backslash escapes in the inserted text', async () => {
    expect(await util.apply('ab', { text: '\\n', position: 1 })).toBe('a\nb')
    expect(await util.apply('ab', { text: '\\\\', position: 1 })).toBe('a\\b')
  })

  it('is a no-op with empty text', async () => {
    expect(await util.apply('unchanged', { text: '', position: 3, mode: 'overwrite' })).toBe('unchanged')
  })

  it('throws on a non-integer position', () => {
    expect(() => util.apply('abc', { text: 'x', position: 1.5 })).toThrow(/whole number/)
    expect(() => util.apply('abc', { text: 'x', position: 'nope' })).toThrow(/whole number/)
  })
})
