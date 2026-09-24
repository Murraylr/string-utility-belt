
import { describe, it, expect } from 'vitest'
import { bytesToHex, textToUint8Array } from './helpers'

describe('helpers', () => {
  it('bytesToHex encodes UTF-8 bytes', () => {
    const hex = bytesToHex(textToUint8Array('A'))
    expect(hex).toBe('41')
  })
  it('bytesToHex encodes multi-byte', () => {
    const hex = bytesToHex(new Uint8Array([0xde, 0xad]))
    expect(hex).toBe('dead')
  })
})
