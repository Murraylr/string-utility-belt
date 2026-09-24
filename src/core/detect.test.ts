import { describe, it, expect, vi } from 'vitest'
import { staticRegistry } from '@/utilities/static-registry'
import { autoDecode, suggestDecoders } from './detect'
import type { Utility, Value } from '../types/utility'

const load = staticRegistry.load

describe('suggestDecoders', () => {
  it('suggests and validates base64 decode for base64 text', async () => {
    const value = btoa('Hello, World!')
    const suggestions = await suggestDecoders(value, { load })
    const base64 = suggestions.find(s => s.step.utilityId === 'base64_decode')
    expect(base64).toBeTruthy()
    expect(base64!.preview).toContain('Hello, World!')
    expect(base64!.confidence).toBeGreaterThan(0)
  })

  it('drops a candidate that fails when actually run', async () => {
    // valid base64 characters, but the decoded bytes are not valid UTF-8 text —
    // detect_format still calls this "base64", but base64_decode must throw on it.
    const invalidUtf8 = btoa(String.fromCharCode(0xff, 0xfe, 0xfd, 0xfc))
    const util = await load('base64_decode')
    expect(() => util.apply(invalidUtf8, {})).toThrow()

    const suggestions = await suggestDecoders(invalidUtf8, { load })
    expect(suggestions.find(s => s.step.utilityId === 'base64_decode')).toBeUndefined()
  })

  it('returns nothing for empty input', async () => {
    expect(await suggestDecoders('', { load })).toEqual([])
  })

  it('respects the limit, keeping the most confident', async () => {
    // base64 without + or / also reads as base64url, so there are two candidates
    const value = btoa('plain text payload!')
    const all = await suggestDecoders(value, { load })
    expect(all.length).toBeGreaterThan(1)
    const one = await suggestDecoders(value, { load, limit: 1 })
    expect(one).toEqual([all[0]])
    expect(one[0].step.utilityId).toBe('base64_decode')
  })
})

describe('autoDecode', () => {
  it('decodes base64(urlencode(json)) down to the parsed JSON', async () => {
    const obj = { a: 1, b: 'x y', c: true }
    const json = JSON.stringify(obj)
    const value = btoa(encodeURIComponent(json))

    const result = await autoDecode(value, { load, maxDepth: 8 })

    expect(result.steps.map(s => s.utilityId)).toEqual(['base64_decode', 'url_decode', 'json_pretty'])
    expect(JSON.parse(String(result.value))).toEqual(obj)
  })

  it('stops instead of looping forever (cycle guard)', async () => {
    // A minimal, deterministic host that always "detects" the same format and
    // whose decoder simply toggles between two values — a worst-case cycle that
    // would spin forever without the guard.
    const fakeUtils: Record<string, Utility> = {
      detect_format: {
        id: 'detect_format', name: 'detect format', category: 'Analysis', params: {},
        apply: () => [{ format: 'base64', confidence: 0.9, note: 'fake' }],
      },
      base64_decode: {
        id: 'base64_decode', name: 'base64 decode', category: 'Decoding', params: {},
        apply: (input: Value) => (input === 'A' ? 'B' : 'A'),
      },
    }
    const fakeLoad = (id: string): Utility => {
      const u = fakeUtils[id]
      if (!u) throw new Error(`unknown: ${id}`)
      return u
    }

    const result = await autoDecode('A', { load: fakeLoad, maxDepth: 50 })

    // A -> B is one real step; B -> A would repeat a value already seen, so the
    // guard must stop there instead of alternating forever.
    expect(result.steps).toEqual([{ utilityId: 'base64_decode', params: undefined }])
    expect(result.value).toBe('B')
  })

  it('respects maxDepth', async () => {
    // Each application increments the number, so the value never repeats — this
    // would run forever without a depth cap; the cycle guard alone would not stop it.
    const fakeUtils: Record<string, Utility> = {
      detect_format: {
        id: 'detect_format', name: 'detect format', category: 'Analysis', params: {},
        apply: () => [{ format: 'base64', confidence: 0.9, note: 'fake' }],
      },
      base64_decode: {
        id: 'base64_decode', name: 'base64 decode', category: 'Decoding', params: {},
        apply: (input: Value) => String(Number(input) + 1),
      },
    }
    const fakeLoad = (id: string): Utility => {
      const u = fakeUtils[id]
      if (!u) throw new Error(`unknown: ${id}`)
      return u
    }

    const result = await autoDecode('1', { load: fakeLoad, maxDepth: 4 })
    expect(result.steps.length).toBe(4)
  })

  it('returns no steps for input nothing can decode', async () => {
    const result = await autoDecode('just plain english text', { load })
    expect(result.steps).toEqual([])
    expect(result.value).toBe('just plain english text')
  })

  it('prefers the most confident decoder — a unix timestamp is converted, not hex-decoded', async () => {
    // detect_format: timestamp 0.7, hex 0.4 (all-digit). hex_decode "succeeds" into
    // control-character garbage, so a pretty-last rule that ignores confidence picks it.
    const result = await autoDecode('1700000000', { load })
    expect(result.steps.map(s => s.utilityId)).toEqual(['timestamp_convert'])
    expect(result.value).toBe('2023-11-14T22:13:20.000Z')
  })

  it('does not url-decode inside confidently detected JSON (that corrupts it)', async () => {
    const json = '{"q":"a%20b","r":"%22"}'
    const result = await autoDecode(json, { load })
    expect(result.steps.map(s => s.utilityId)).toEqual(['json_pretty'])
    expect(JSON.parse(String(result.value))).toEqual(JSON.parse(json))
  })

  it('does not auto-apply a low-confidence guess', async () => {
    // all-digit hex scores 0.4; hex_decode would turn this into bytes 12 34 56 78
    const result = await autoDecode('12345678', { load })
    expect(result.steps).toEqual([])
    expect(result.value).toBe('12345678')
  })

  it('peels nested layers and keeps unicode intact', async () => {
    const text = 'héllo 🎉 wörld — 日本語'
    const utf8b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    const result = await autoDecode(utf8b64(utf8b64(text)), { load })
    expect(result.steps.map(s => s.utilityId)).toEqual(['base64_decode', 'base64_decode'])
    expect(result.value).toBe(text)
  })

  it('decodes bytes input (e.g. an imported file holding base64 text)', async () => {
    const result = await autoDecode(new TextEncoder().encode(btoa('from a file')), { load })
    expect(result.steps.map(s => s.utilityId)).toEqual(['base64_decode'])
    expect(result.value).toBe('from a file')
  })

  it('decompresses base64-wrapped gzip in one step', async () => {
    const result = await autoDecode('H4sIAAAAAAAAA/NIzcnJBwCCidH3BQAAAA==', { load })
    expect(result.steps.map(s => s.utilityId)).toEqual(['gzip_decompress'])
    expect(result.value).toBe('Hello')
  })
})

describe('suggestDecoders ranking', () => {
  it('ranks by detection confidence even when the detector does not sort', async () => {
    const fakeUtils: Record<string, Utility> = {
      detect_format: {
        id: 'detect_format', name: 'detect format', category: 'Analysis', params: {},
        apply: () => [
          { format: 'hex', confidence: 0.3, note: '' },
          { format: 'base64', confidence: 0.9, note: '' },
        ],
      },
      hex_decode: { id: 'hex_decode', name: 'hex', category: 'Decoding', params: {}, apply: () => 'from hex' },
      base64_decode: { id: 'base64_decode', name: 'b64', category: 'Decoding', params: {}, apply: () => 'from b64' },
    }
    const fakeLoad = (id: string): Utility => fakeUtils[id]
    const suggestions = await suggestDecoders('abcd', { load: fakeLoad })
    expect(suggestions.map(s => s.step.utilityId)).toEqual(['base64_decode', 'hex_decode'])
  })

  it('previews a large bytes result without formatting all of it', async () => {
    const big = new Uint8Array(2_000_000).fill(65)
    const fakeUtils: Record<string, Utility> = {
      detect_format: {
        id: 'detect_format', name: 'detect format', category: 'Analysis', params: {},
        apply: () => [{ format: 'hex', confidence: 0.9, note: '' }],
      },
      hex_decode: { id: 'hex_decode', name: 'hex', category: 'Decoding', params: {}, apply: () => big },
    }
    // formatForDisplay(bytes) expands every byte via Array.from — seconds for MBs
    const from = vi.spyOn(Array, 'from')
    try {
      const [s] = await suggestDecoders('41', { load: (id: string) => fakeUtils[id] })
      expect(s.preview.startsWith('bytes[65, 65, 65')).toBe(true)
      expect(s.preview.length).toBe(200)
      expect(from.mock.calls.some(([arg]) => (arg as ArrayLike<unknown>)?.length > 10_000)).toBe(false)
    } finally {
      from.mockRestore()
    }
  })
})
