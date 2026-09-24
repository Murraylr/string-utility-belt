import { describe, it, expect } from 'vitest'
import util from './index'

/**
 * Fixtures produced with Node's reference encoder:
 *   zlib.brotliCompressSync(Buffer.from(<source>)).toString('base64')
 * so every case below is a genuine compress -> decompress round trip.
 */
const HELLO = 'iwaASGVsbG8sIGJyb3RsaSED'
const UNICODE = 'ixGAaMOpbGxvIHfDtnJsZCDigJQg8J+YgCDDvG7Dr2NvZGUg4pyTAw=='
const EMPTY_STREAM = 'Ow=='
const BIG =
  'W1cPgsjigDcNXdl1CbF7sZKqDC3JzNgaxGUub4Oc4empsDfYgAOHBPJGgxt0WuHM4XGimoIjnHIDgX0aDA=='
const ALL_BYTES =
  'G/8A6C8O7FgZWEOqB44aNm7tQAxs295ktQ7OC7nvFAfnlZxHHIQKxwh5ryxDlCskJtjEsbu/AyDChDIupNLGOh9iyqW2Puba574PgBCMoBhOkBTNsBwviJKsqJpumJbtuJ4fhFGcpFlelFXdtF0/jNO8rNt+nNf9vN/vDyAYQTGcICmaYTleECVZUTXdMC3bcT0/CKM4SbO8KKu6abt+GKd5Wbf9OK/7eb8fQIQJZVxIpY11PgijOEmzvCirumm7fhineVm3/Tiv+3m/H8Si5pHVs/c='

const UNICODE_TEXT = 'héllo wörld — 😀 ünïcode ✓'
const BIG_TEXT = 'The quick brown fox jumps over the lazy dog. '.repeat(3000)

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

describe('brotli_decompress', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('brotli_decompress')
    expect(util.name).toBe('brotli decompress')
    expect(util.category).toBe('Compression')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toEqual(['string', 'bytes'])
    expect(util.params.output).toEqual({
      kind: 'select',
      label: 'output',
      options: ['text', 'bytes'],
      default: 'text'
    })
  })

  it('decompresses a brotli stream to text by default', async () => {
    expect(await util.apply(b64(HELLO), {})).toBe('Hello, brotli!')
    expect(await util.apply(b64(HELLO), { output: 'text' })).toBe('Hello, brotli!')
  })

  it('returns raw bytes when output is bytes', async () => {
    const out = await util.apply(b64(HELLO), { output: 'bytes' })
    expect(out).toBeInstanceOf(Uint8Array)
    expect(Array.from(out as Uint8Array)).toEqual(
      Array.from(new TextEncoder().encode('Hello, brotli!'))
    )
  })

  it('never throws on empty input', async () => {
    expect(await util.apply(new Uint8Array(0), {})).toBe('')
    expect(await util.apply('', {})).toBe('')
    const bytes = await util.apply(new Uint8Array(0), { output: 'bytes' })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect((bytes as Uint8Array).length).toBe(0)
  })

  it('decompresses a valid but empty brotli stream', async () => {
    expect(await util.apply(b64(EMPTY_STREAM), {})).toBe('')
  })

  it('round-trips unicode, keeping astral characters intact', async () => {
    const out = await util.apply(b64(UNICODE), {})
    expect(out).toBe(UNICODE_TEXT)
    // code points, not UTF-16 units: the emoji must survive as one character
    expect(Array.from(out as string)).toContain('😀')
    expect(Array.from(out as string).length).toBe(25)
    expect(new TextEncoder().encode(out as string).length).toBe(36)
  })

  it('handles a payload spanning many kilobytes', async () => {
    const out = (await util.apply(b64(BIG), {})) as string
    expect(out.length).toBe(BIG_TEXT.length)
    expect(out).toBe(BIG_TEXT)
  })

  it('accepts a binary string as well as bytes', async () => {
    const binaryString = String.fromCharCode(...b64(HELLO))
    expect(await util.apply(binaryString, {})).toBe('Hello, brotli!')
  })

  it('decodes non-text payloads only when output is bytes', async () => {
    const out = await util.apply(b64(ALL_BYTES), { output: 'bytes' })
    expect(Array.from(out as Uint8Array)).toEqual(
      Array.from({ length: 256 }, (_, i) => i)
    )
    await expect(util.apply(b64(ALL_BYTES), { output: 'text' })).rejects.toThrow(
      /not valid UTF-8/i
    )
  })

  it('throws a clear error on malformed input', async () => {
    await expect(util.apply(new Uint8Array([1, 2, 3, 4, 5]), {})).rejects.toThrow(
      /Not valid brotli data/
    )
    await expect(util.apply(new Uint8Array([0]), { output: 'bytes' })).rejects.toThrow(
      /Not valid brotli data/
    )
  })
})
