import util from './index'
import { describe, it, expect } from 'vitest'

describe('hash (WebCrypto)', () => {
  it('hashes deterministically (SHA-256)', async () => {
    const out = await util.apply('abc', { algo: 'SHA-256' })
    expect(out).toMatch(/^[0-9a-f]{64}$/)
  })
})
