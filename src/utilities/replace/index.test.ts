import { describe, it, expect } from 'vitest'
import util from './index'

describe('replace', () => {
  it('regex replace', async () => {
    const out = await util.apply('aba', { pattern: 'a', replacement: 'x', regex: true, flags: 'g' })
    expect(out).toBe('xbx')
  })
})
