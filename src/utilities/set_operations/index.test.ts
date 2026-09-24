import { describe, it, expect } from 'vitest'
import util from './index'

describe('set_operations', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('set_operations')
    expect(util.name).toBe('line set operations')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['other', 'operation', 'ignoreCase', 'trim', 'sort'])
  })

  it('intersects by default, keeping input order', async () => {
    expect(await util.apply('apple\nbanana\ncherry', { other: 'cherry\nbanana\ndate' }))
      .toBe('banana\ncherry')
  })

  it('supports union, difference and symmetric-difference', async () => {
    const args = { other: 'b\nd' }
    expect(await util.apply('a\nb\nc', { ...args, operation: 'union' })).toBe('a\nb\nc\nd')
    expect(await util.apply('a\nb\nc', { ...args, operation: 'difference' })).toBe('a\nc')
    expect(await util.apply('a\nb\nc', { ...args, operation: 'symmetric-difference' })).toBe('a\nc\nd')
    expect(await util.apply('a\nb\nc', { ...args, operation: 'intersection' })).toBe('b')
  })

  it('de-duplicates members and ignores blank lines', async () => {
    expect(await util.apply('a\na\n\nb\n', { other: 'a\n\n', operation: 'union' })).toBe('a\nb')
    expect(await util.apply('a\na\nb', { other: 'a' })).toBe('a')
  })

  it('honours ignoreCase while preserving the original casing', async () => {
    expect(await util.apply('Apple\nBanana', { other: 'apple', ignoreCase: true })).toBe('Apple')
    expect(await util.apply('Apple\nBanana', { other: 'apple', ignoreCase: false })).toBe('')
    expect(await util.apply('Apple\napple', { other: '', operation: 'union', ignoreCase: true })).toBe('Apple')
  })

  it('honours trim', async () => {
    expect(await util.apply('  a  \nb', { other: 'a', trim: true })).toBe('a')
    expect(await util.apply('  a  \nb', { other: 'a', trim: false })).toBe('')
  })

  it('honours sort', async () => {
    expect(await util.apply('c\na\nb', { other: 'a\nb\nc', sort: true })).toBe('a\nb\nc')
    expect(await util.apply('c\na\nb', { other: 'a\nb\nc', sort: false })).toBe('c\na\nb')
    expect(await util.apply('B\na', { other: 'a\nB', sort: true, ignoreCase: true })).toBe('a\nB')
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { other: 'a\nb', operation: 'union' })).toBe('a\nb')
    expect(await util.apply('a\nb', { operation: 'difference' })).toBe('a\nb')
  })

  it('handles unicode members', async () => {
    expect(await util.apply('café\n🍕\nnaïve', { other: '🍕\ncafé' })).toBe('café\n🍕')
    expect(await util.apply('🍕\n🍔', { other: '🍕', operation: 'difference' })).toBe('🍔')
  })

  it('declares every manifest param with its default', () => {
    const p = util.params as Record<string, { default?: unknown; options?: string[]; kind?: string; as?: string }>
    expect(p.other.default).toBe('')
    expect(p.other.kind).toBe('file')
    expect(p.other.as).toBe('text')
    expect(p.operation.default).toBe('intersection')
    expect(p.operation.options).toEqual(['union', 'intersection', 'difference', 'symmetric-difference'])
    expect(p.ignoreCase.default).toBe(false)
    expect(p.trim.default).toBe(true)
    expect(p.sort.default).toBe(false)
  })

  it('sorts and de-duplicates every operation', async () => {
    expect(await util.apply('c\na', { other: 'd\nb', operation: 'union', sort: true })).toBe('a\nb\nc\nd')
    expect(await util.apply('b\na\nb', { other: 'c\na\nc', operation: 'symmetric-difference', sort: true }))
      .toBe('b\nc')
    expect(await util.apply('b\nb\na', { other: 'a\nb', operation: 'intersection', sort: true })).toBe('a\nb')
  })

  it('throws on an unknown operation', () => {
    expect(() => util.apply('a', { operation: 'nope' })).toThrow(/unknown operation/)
  })
})
