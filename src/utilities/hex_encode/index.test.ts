import { describe, it, expect } from 'vitest'
import util from './index'

describe('hex_encode', () => {
  it('encodes string to hex', async () => {
    const out = await util.apply('A', {})
    expect(out).toBe('41')
  })
})
