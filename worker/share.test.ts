// @vitest-environment node
import fc from 'fast-check'
import LZString from 'lz-string'
import { describe, expect, it } from 'vitest'
import { decodeShare, encodeShare } from '../src/core/serialize'
import { ShareTooLargeError, decodeShareBounded, decompressUriSafe } from './share'
import { URI_SAFE_ALPHABET as URI_SAFE, bombLength, bombPayload } from './test-utils'

describe('decompressUriSafe', () => {
  it('inverts compressToEncodedURIComponent for any string', () => {
    fc.assert(fc.property(fc.string({ unit: 'binary', maxLength: 400 }), s => {
      expect(decompressUriSafe(LZString.compressToEncodedURIComponent(s), Infinity)).toBe(s)
    }), { numRuns: 300 })
  })

  it('agrees with lz-string on corrupt payloads', () => {
    fc.assert(fc.property(fc.string({ unit: fc.constantFrom(...URI_SAFE, ' ', '=', '/', 'é'), maxLength: 60 }), s => {
      // A stream opening with the invalid code 3 (top two bits of the first 6-bit value set)
      // sends lz-string on with an `undefined` entry, returning whatever falls out; we return null.
      const first = Math.max(0, URI_SAFE.indexOf(s.replace(/ /g, '+').charAt(0))) & 63
      if ((first & 0b110000) === 0b110000) {
        expect(decompressUriSafe(s, Infinity)).toBeNull()
        return
      }
      let expected: string | null | undefined
      try { expected = LZString.decompressFromEncodedURIComponent(s) } catch { return } // lz-string itself throws
      // null and "" both mean "no pipeline" to decodeShare
      expect(decompressUriSafe(s, Infinity) || null).toBe(expected || null)
    }), { numRuns: 1000 })
  })

  it('matches lz-string on the crafted worst case, then refuses it past the ceiling', () => {
    const small = bombPayload(40)
    expect(LZString.decompressFromEncodedURIComponent(small)).toBe('a'.repeat(bombLength(40)))
    expect(decompressUriSafe(small, Infinity)).toBe('a'.repeat(bombLength(40)))
    expect(() => decompressUriSafe(small, bombLength(40) - 1)).toThrow(ShareTooLargeError)
    expect(decompressUriSafe(small, bombLength(40))).toHaveLength(bombLength(40))
  })

  it('stops a 50 KB payload that would expand to 200 million characters, quickly', () => {
    const bomb = bombPayload(20_000)
    expect(bomb.length).toBeLessThan(60_000)
    expect(bombLength(20_000)).toBeGreaterThan(2e8)
    const t0 = Date.now()
    expect(() => decompressUriSafe(bomb, 2 * 1024 * 1024)).toThrow(/too large to open safely.*2,097,152 characters/)
    expect(Date.now() - t0).toBeLessThan(1_000)
  })
})

describe('decodeShareBounded', () => {
  const docs = [
    { v: 2 as const, steps: [{ id: 'a', utilityId: 'reverse', params: {} }] },
    { v: 2 as const, name: 'n', description: 'd', input: 'héllo 👋', steps: [
      { id: 'b', type: 'branch' as const, merge: { mode: 'zip' as const, separator: ',' }, branches: [[{ id: 'c', utilityId: 'trim', params: {} }], []] },
      { id: 'm', type: 'macro' as const, name: 'mac', steps: [{ id: 'd', utilityId: 'case', params: { mode: 'upper' } }] },
    ] },
  ]

  it.each(docs)('decodes what encodeShare produced exactly like decodeShare (%#)', doc => {
    const encoded = encodeShare(doc)
    expect(decodeShareBounded(encoded, Infinity)).toEqual(decodeShare(encoded))
    expect(decodeShareBounded(` ${encoded}\n`, Infinity)).toEqual(decodeShare(encoded))
  })

  it('raises decodeShare’s errors', () => {
    const newer = LZString.compressToEncodedURIComponent(JSON.stringify({ v: 9, steps: [] }))
    const notJson = LZString.compressToEncodedURIComponent('{nope')
    for (const bad of ['', '!!!', newer, notJson]) {
      let expected = ''
      try { decodeShare(bad) } catch (e) { expected = (e as Error).message }
      expect(expected, bad).not.toBe('')
      expect(() => decodeShareBounded(bad, Infinity), bad).toThrow(expected)
    }
  })

  it('refuses a share whose document is larger than the ceiling', () => {
    const encoded = encodeShare({ v: 2, input: 'x'.repeat(5_000), steps: [] })
    expect(encoded.length).toBeLessThan(500)
    expect(() => decodeShareBounded(encoded, 4_000)).toThrow(ShareTooLargeError)
    expect(decodeShareBounded(encoded, 10_000).input).toHaveLength(5_000)
  })
})
