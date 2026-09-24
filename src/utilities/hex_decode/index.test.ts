import { describe, it, expect } from 'vitest'
import util from './index'

describe('hex_decode', () => {
  it('decodes hex to bytes', async () => {
    const out: any = await util.apply('48656c6c6f20776f726c64206d79206e616d65206973204d7572726179', {})
    expect(out).toBeInstanceOf(Uint8Array)
    expect(new TextDecoder().decode(out)).toBe('Hello world my name is Murray');
  })
})
