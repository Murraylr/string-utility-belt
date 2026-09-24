import { describe, it, expect } from 'vitest'
import { pseudoizeString, enXA } from './pseudo'
import { en } from './en'

describe('pseudoizeString', () => {
  it('accents vowels and brackets the result', () => {
    expect(pseudoizeString('Blog')).toBe('[Blóg]')
  })

  it('leaves {var} interpolation tokens untouched', () => {
    const out = pseudoizeString('Hello {name}, you have {count} items')
    expect(out).toContain('{name}')
    expect(out).toContain('{count}')
  })
})

describe('enXA', () => {
  it('mirrors the shape of en with every leaf transformed', () => {
    expect(enXA.blog.title).not.toBe(en.blog.title)
    expect(Object.keys(enXA.blog)).toEqual(Object.keys(en.blog))
    expect(Object.keys(enXA)).toEqual(Object.keys(en))
  })
})
