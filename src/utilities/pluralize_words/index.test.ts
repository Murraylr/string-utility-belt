import { describe, it, expect } from 'vitest'
import util from './index'

describe('pluralize_words', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('pluralize_words')
    expect(util.name).toBe('pluralize / singularize')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['count', 'mode', 'scope'])
    expect(util.params.mode).toMatchObject({ kind: 'select', default: 'plural' })
    expect(util.params.scope).toMatchObject({ kind: 'select', default: 'whole' })
    expect(util.params.count).toMatchObject({ kind: 'number', default: 0 })
  })

  it('pluralizes every word by default (scope: whole)', async () => {
    expect(await util.apply('cat', {})).toBe('cats')
    expect(await util.apply('one goose, one box', {})).toBe('ones geese, ones boxes')
  })

  it('singularizes with mode: singular', async () => {
    expect(await util.apply('mice', { mode: 'singular' })).toBe('mouse')
    expect(await util.apply('Boxes and geese', { mode: 'singular' })).toBe('Box and goose')
    expect(await util.apply('shopping carts\nuser profiles', { mode: 'singular', scope: 'each-line' }))
      .toBe('shopping cart\nuser profile')
  })

  it('scope last-word only touches the final word', async () => {
    expect(await util.apply('shopping cart', { scope: 'last-word' })).toBe('shopping carts')
    expect(await util.apply('shopping cart', { scope: 'whole' })).toBe('shoppings carts')
    expect(await util.apply('shopping cart!', { scope: 'last-word' })).toBe('shopping carts!')
  })

  it('scope each-line pluralizes the last word of every line', async () => {
    expect(await util.apply('shopping cart\nuser profile', { scope: 'each-line' }))
      .toBe('shopping carts\nuser profiles')
    expect(await util.apply('user profile\n\nlast box', { scope: 'each-line' }))
      .toBe('user profiles\n\nlast boxes')
  })

  it('count > 0 picks the form by count and prefixes the number', async () => {
    expect(await util.apply('box', { count: 5 })).toBe('5 boxes')
    expect(await util.apply('box', { count: 1 })).toBe('1 box')
    expect(await util.apply('child', { count: 1, mode: 'singular' })).toBe('1 child')
    expect(await util.apply('shopping cart', { scope: 'last-word', count: 3 })).toBe('3 shopping carts')
    expect(await util.apply('shopping cart', { scope: 'whole', count: 3 })).toBe('3 shoppings carts')
  })

  it('count applies per line under scope each-line', async () => {
    expect(await util.apply('box\nchild', { scope: 'each-line', count: 2 })).toBe('2 boxes\n2 children')
    expect(await util.apply('  box', { count: 4 })).toBe('  4 boxes')
  })

  it('prefixes the count consistently when a segment holds no inflectable word', async () => {
    // "123" has nothing to inflect, but it is still a value: every scope must
    // prefix the count rather than silently dropping it
    for (const scope of ['whole', 'last-word', 'each-line']) {
      expect(await util.apply('123', { scope, count: 5 }), scope).toBe('5 123')
    }
    expect(await util.apply('🍎', { scope: 'last-word', count: 2 })).toBe('2 🍎')
  })

  it('leaves emoji and other non-word characters intact', async () => {
    const out = await util.apply('🍎 apple', {}) as string
    expect(out).toBe('🍎 apples')
    expect(Array.from(out)[0]).toBe('🍎')
    expect(await util.apply('naïve', {})).toBe('naïves')
    expect(await util.apply('café ☕ box', { scope: 'last-word' })).toBe('café ☕ boxes')
  })

  it('returns empty string for empty input and passes blank lines through', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('   ')
    expect(await util.apply('\n\n', { scope: 'each-line' })).toBe('\n\n')
    expect(await util.apply('', { count: 3 })).toBe('')
  })

  it('throws on invalid params', async () => {
    await expect(util.apply('cat', { count: -2 })).rejects.toThrow(/non-negative/)
    await expect(util.apply('cat', { count: 1.5 })).rejects.toThrow(/whole number/)
    await expect(util.apply('cat', { count: 'abc' })).rejects.toThrow(/non-negative/)
    await expect(util.apply('cat', { mode: 'nope' })).rejects.toThrow(/unknown mode/)
    await expect(util.apply('cat', { scope: 'nope' })).rejects.toThrow(/unknown scope/)
  })
})
