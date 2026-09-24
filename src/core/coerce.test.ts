import { describe, it, expect } from 'vitest'
import { isBytes, valueType, coerceInputFor } from './coerce'
import { isBytes as helperIsBytes } from '../utilities/helpers'

describe('isBytes', () => {
  it('accepts real Uint8Arrays, including views onto a larger buffer', () => {
    expect(isBytes(new Uint8Array([1, 2]))).toBe(true)
    expect(isBytes(new Uint8Array(new ArrayBuffer(8), 2, 3))).toBe(true)
  })

  it('rejects JSON shaped to look like bytes', () => {
    // a JSON-producing step (custom code included) could otherwise make the next step
    // treat an object as bytes and crash in TextDecoder
    const spoof = JSON.parse('{"constructor":{"name":"Uint8Array"},"byteLength":3,"buffer":{}}')
    expect(isBytes(spoof)).toBe(false)
    expect(helperIsBytes(spoof)).toBe(false)
    expect(valueType(spoof)).toBe('json')
    expect(coerceInputFor(spoof, 'string')).toBe(JSON.stringify(spoof))
  })

  it('rejects other typed arrays and array-likes', () => {
    expect(isBytes(new Uint16Array([1]))).toBe(false)
    expect(isBytes(new Int8Array([1]))).toBe(false)
    expect(isBytes([1, 2, 3])).toBe(false)
    expect(isBytes(new ArrayBuffer(4))).toBe(false)
  })
})
