
import { describe, it, expect } from 'vitest'
import { normalizeCase, bytesToHex, textToUint8Array, hexToBytes, b64encode, b64decode, isBytes } from './helpers'

describe('helpers', () => {
  it('normalizeCase upper', () => {
    expect(normalizeCase('abc', 'upper')).toBe('ABC')
  })
  it('normalizeCase lower', () => {
    expect(normalizeCase('ABC', 'lower')).toBe('abc')
  })
  it('normalizeCase title', () => {
    expect(normalizeCase('hello world', 'title')).toBe('Hello World')
  })
  it('normalizeCase sentence', () => {
    expect(normalizeCase('hello WORLD', 'sentence')).toBe('Hello world')
  })
  it('bytesToHex', () => {
    expect(bytesToHex(new Uint8Array([0xde, 0xad]))).toBe('dead')
  })
  it('bytesToHex of UTF-8 text', () => {
    expect(bytesToHex(textToUint8Array('A'))).toBe('41')
  })
  it('hexToBytes', () => {
    expect(Array.from(hexToBytes('dead'))).toEqual([0xde, 0xad])
  })
  it('b64 roundtrip', () => {
    expect(b64decode(b64encode('hello'))).toBe('hello')
  })
  it('isBytes', () => {
    expect(isBytes(new Uint8Array([1]))).toBe(true)
    expect(isBytes('string')).toBe(false)
  })
})
