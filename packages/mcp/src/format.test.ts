// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  TimeoutError, checkInputSize, decodeInput, paramSummary, plainParams, renderOutput, shareToPayload, withTimeout,
} from './format'

const utf8 = (v: unknown) => Buffer.from(v as Uint8Array).toString('utf8')

describe('checkInputSize', () => {
  it('passes under the limit and throws over it, counting UTF-8 bytes', () => {
    expect(() => checkInputSize('a'.repeat(10), 10)).not.toThrow()
    expect(() => checkInputSize('a'.repeat(11), 10)).toThrow(/exceeds/)
    expect(() => checkInputSize('é'.repeat(6), 10)).toThrow(/exceeds/) // 12 bytes, 6 chars
  })
})

describe('decodeInput', () => {
  it('passes text through as-is by default', () => {
    expect(decodeInput('hello')).toBe('hello')
    expect(decodeInput('hello', 'text')).toBe('hello')
  })

  it('decodes base64 to bytes: standard, URL-safe, unpadded, with whitespace, and empty', () => {
    expect(utf8(decodeInput(Buffer.from('hi?>').toString('base64'), 'base64'))).toBe('hi?>')
    expect(utf8(decodeInput('aGk_Pg', 'base64'))).toBe('hi?>')
    expect(utf8(decodeInput('aGk/\nPg==', 'base64'))).toBe('hi?>')
    expect(decodeInput('', 'base64')).toEqual(new Uint8Array())
  })

  it('rejects malformed base64', () => {
    expect(() => decodeInput('not base64!!', 'base64')).toThrow(/base64/)
    expect(() => decodeInput('aGk=aGk=', 'base64')).toThrow(/base64/)
    expect(() => decodeInput('aGk9a', 'base64')).toThrow(/base64/) // 5 chars: a dangling 6-bit unit
  })

  it('decodes hex (spaces and 0x prefix allowed) and rejects odd or non-hex digits', () => {
    expect(Array.from(decodeInput('00 01 ff', 'hex') as Uint8Array)).toEqual([0, 1, 255])
    expect(utf8(decodeInput('0x4869', 'hex'))).toBe('Hi')
    expect(() => decodeInput('abc', 'hex')).toThrow(/hex/)
    expect(() => decodeInput('zz', 'hex')).toThrow(/hex/)
  })

  it('parses json', () => {
    expect(decodeInput('{"a":1}', 'json')).toEqual({ a: 1 })
    expect(() => decodeInput('{not json', 'json')).toThrow(/JSON/)
  })
})

describe('renderOutput', () => {
  it('leaves strings as text with no outputEncoding', () => {
    expect(renderOutput('hi')).toEqual({ output: 'hi' })
    expect(renderOutput(undefined as never)).toEqual({ output: '' })
  })

  it('base64-encodes bytes and flags outputEncoding', () => {
    const bytes = new TextEncoder().encode('hi')
    expect(renderOutput(bytes)).toEqual({ output: Buffer.from(bytes).toString('base64'), outputEncoding: 'base64' })
  })

  it('pretty-prints JSON as plain text', () => {
    expect(renderOutput({ a: 1 })).toEqual({ output: JSON.stringify({ a: 1 }, null, 2) })
  })

  it('truncates long text without splitting a surrogate pair', () => {
    expect(renderOutput('abcdef', 4)).toEqual({ output: 'abcd', truncated: true, fullLength: 6 })
    expect(renderOutput('abc😀def', 4)).toEqual({ output: 'abc', truncated: true, fullLength: 8 })
  })

  it('truncates long bytes on a whole-byte boundary so the base64 prefix still decodes', () => {
    const bytes = new Uint8Array(10).map((_, i) => i)
    const out = renderOutput(bytes, 8)
    expect(out).toMatchObject({ outputEncoding: 'base64', truncated: true, fullLength: 16 })
    expect(Array.from(Buffer.from(out.output, 'base64'))).toEqual([0, 1, 2, 3, 4, 5])
  })
})

describe('paramSummary', () => {
  it('copies only the fields a spec actually has', () => {
    expect(paramSummary({ kind: 'boolean', label: 'x', default: true })).toEqual({ kind: 'boolean', label: 'x', default: true })
    expect(paramSummary({ kind: 'select', label: 'mode', options: ['a', 'b'], default: 'a' }))
      .toEqual({ kind: 'select', label: 'mode', options: ['a', 'b'], default: 'a' })
    expect(paramSummary({ kind: 'range', label: 'n', min: 0, max: 10, step: 1 }))
      .toEqual({ kind: 'range', label: 'n', min: 0, max: 10, step: 1 })
  })
})

describe('plainParams', () => {
  it('keeps JSON data and drops prototype-polluting keys', () => {
    const raw = JSON.parse('{"a":1,"__proto__":{"x":1},"constructor":2,"list":[1,"b"]}')
    const out = plainParams(raw)
    expect(out).toEqual({ a: 1, list: [1, 'b'] })
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
  })

  it('returns {} for anything that is not an object', () => {
    expect(plainParams(undefined)).toEqual({})
    expect(plainParams([1, 2])).toEqual({})
    expect(plainParams('x')).toEqual({})
  })
})

describe('shareToPayload', () => {
  it('extracts the payload from a #/p/ or #/embed/ link, and passes a bare payload through', () => {
    expect(shareToPayload('#/p/abc123')).toBe('abc123')
    expect(shareToPayload('https://example.com/#/embed/xyz')).toBe('xyz')
    expect(shareToPayload('#/p/old\nhttps://example.com/#/p/new')).toBe('new')
    expect(shareToPayload(`${'#/p/a'.repeat(100_000)}\nbare`)).toBe(`${'#/p/a'.repeat(100_000)}\nbare`)
    expect(shareToPayload('  bare-payload \n')).toBe('bare-payload')
  })
})

describe('withTimeout', () => {
  it('resolves normally when the work finishes in time', async () => {
    await expect(withTimeout(() => Promise.resolve(42), 100)).resolves.toBe(42)
  })

  it('rejects with a TimeoutError and aborts the signal once the timeout fires', async () => {
    let aborted = false
    const run = withTimeout(signal => {
      signal.addEventListener('abort', () => { aborted = true })
      return new Promise(() => {}) // never resolves on its own
    }, 20)
    await expect(run).rejects.toBeInstanceOf(TimeoutError)
    await expect(run).rejects.toThrow(/timed out after 20ms/)
    expect(aborted).toBe(true)
  })

  it('rejects as cancelled when the caller signal aborts, before or during the run', async () => {
    const pre = new AbortController()
    pre.abort()
    await expect(withTimeout(() => new Promise(() => {}), 1000, pre.signal)).rejects.toThrow(/cancelled/)
    const mid = new AbortController()
    const run = withTimeout(() => new Promise(() => {}), 1000, mid.signal)
    mid.abort()
    await expect(run).rejects.toThrow(/cancelled/)
  })
})
