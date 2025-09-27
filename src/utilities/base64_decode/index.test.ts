import { describe, it, expect } from 'vitest'
import util from './index'

describe('base64_decode', () => {
  it('decodes string', async () => {
    const out = await util.apply('aGk=', {})
    expect(out).toBe('hi')
  })
})
