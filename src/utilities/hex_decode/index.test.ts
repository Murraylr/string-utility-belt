import { describe, it, expect } from 'vitest'
import util from './index'

describe('hex_decode', () => {
  it('decodes hex to bytes', async () => {
    const out: any = await util.apply('41', {})
    expect(out instanceof Uint8Array).toBe(true)
    expect(out[0]).toBe(0x41)
  })
})
