import { describe, it, expect } from 'vitest'
import { previewWindow, PREVIEW_LIMIT } from './previewWindow'

describe('previewWindow', () => {
  it('passes short strings through unchanged', () => {
    expect(previewWindow('hello')).toEqual({ value: 'hello', cut: false })
  })

  it('cuts a long string at the last newline within the window', () => {
    const line = 'x'.repeat(100)
    // enough repeats of `line + \n` to exceed PREVIEW_LIMIT
    const lines = Array.from({ length: Math.ceil(PREVIEW_LIMIT / 101) + 5 }, () => line)
    const input = lines.join('\n') + '\nTAIL'
    const { value, cut } = previewWindow(input)
    const s = value as string
    expect(cut).toBe(true)
    // whole lines, cut AT the last newline inside the window: the newline itself is
    // dropped, so line-oriented steps (sort/number/count lines) see no phantom empty line
    const lastNl = input.slice(0, PREVIEW_LIMIT).lastIndexOf('\n')
    expect(s).toBe(input.slice(0, lastNl))
    expect(s.endsWith('\n')).toBe(false)
    expect(s.split('\n').every(l => l === line)).toBe(true)
  })

  it('uses a newline sitting exactly at the last position of the window', () => {
    const input = 'a'.repeat(PREVIEW_LIMIT - 1) + '\n' + 'b'.repeat(10)
    expect(previewWindow(input)).toEqual({ value: 'a'.repeat(PREVIEW_LIMIT - 1), cut: true })
  })

  it('ignores newlines after the window', () => {
    const input = 'a'.repeat(PREVIEW_LIMIT + 5) + '\nrest'
    expect(previewWindow(input).value).toBe('a'.repeat(PREVIEW_LIMIT))
  })

  it('is not cut at exactly the limit', () => {
    const input = 'a'.repeat(PREVIEW_LIMIT)
    expect(previewWindow(input)).toEqual({ value: input, cut: false })
  })

  it('cuts at exactly the limit when there is no newline in the window', () => {
    const input = 'a'.repeat(PREVIEW_LIMIT + 10)
    const { value, cut } = previewWindow(input)
    expect(cut).toBe(true)
    expect(value).toBe('a'.repeat(PREVIEW_LIMIT))
  })

  it('never splits a surrogate pair at the boundary', () => {
    // an astral character (2 code units) positioned to straddle the cut point
    const pair = '\u{1F600}' // 😀, high+low surrogate
    const input = 'a'.repeat(PREVIEW_LIMIT - 1) + pair + 'b'.repeat(50)
    const { value } = previewWindow(input)
    // the pair straddles the limit, so the cut moves back before it
    expect(value).toBe('a'.repeat(PREVIEW_LIMIT - 1))
  })

  it('keeps a surrogate pair that ends exactly at the limit', () => {
    const input = 'a'.repeat(PREVIEW_LIMIT - 2) + '\u{1F600}' + 'b'.repeat(50)
    expect(previewWindow(input).value).toBe('a'.repeat(PREVIEW_LIMIT - 2) + '\u{1F600}')
  })

  it('cuts bytes input at exactly PREVIEW_LIMIT bytes', () => {
    const bytes = new Uint8Array(PREVIEW_LIMIT + 100).fill(7)
    const { value, cut } = previewWindow(bytes)
    expect(cut).toBe(true)
    expect((value as Uint8Array).length).toBe(PREVIEW_LIMIT)
  })

  it('passes short bytes input through unchanged', () => {
    const bytes = new Uint8Array([1, 2, 3])
    const { value, cut } = previewWindow(bytes)
    expect(cut).toBe(false)
    expect(value).toBe(bytes)
  })

  it('passes JSON values through unchanged (no meaningful prefix)', () => {
    const obj = { a: 1 }
    expect(previewWindow(obj)).toEqual({ value: obj, cut: false })
  })
})
