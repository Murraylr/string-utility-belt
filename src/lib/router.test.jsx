import { describe, it, expect } from 'vitest'
import { getRoute } from './router'

describe('router', () => {
  it('defaults to home when no hash', () => {
    const r = getRoute()
    expect(r.name).toBe('home')
  })
})

describe('router docs route', () => {
  it('matches #/docs', () => {
    location.hash = '#/docs'
    expect(getRoute().name).toBe('docs')
    location.hash = ''
  })
})
