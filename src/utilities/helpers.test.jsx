
import { describe, it, expect } from 'vitest'
import { slugify, bytesToHex, textToUint8Array } from './helpers'

describe('helpers', () => {
  it('slugify converts to kebab', () => {
    expect(slugify('Hello, World!')).toBe('hello-world')
  })
  it('bytesToHex encodes UTF-8 bytes', () => {
    const hex = bytesToHex(textToUint8Array('A'))
    expect(hex).toBe('41')
  })
})
