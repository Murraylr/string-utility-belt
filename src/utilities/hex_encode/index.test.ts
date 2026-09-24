import { describe, it, expect } from 'vitest'
import util from './index'

describe('hex_encode', () => {
  it('encodes string to hex', async () => {
    const out = await util.apply('Hello world my name is Murray', {})
    expect(out).toBe('48656c6c6f20776f726c64206d79206e616d65206973204d7572726179');
  })
})
