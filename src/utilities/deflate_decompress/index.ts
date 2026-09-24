import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

type Fflate = typeof import('fflate')
let _fflate: Fflate | null = null
const getFflate = async (): Promise<Fflate> => {
  if (!_fflate) _fflate = await import('fflate')
  return _fflate
}

/** RFC 1952 §2.3: ID1=0x1f, ID2=0x8b, CM=8. No deflate stream can start this way. */
const hasGzipMagic = (b: Uint8Array) =>
  b.length >= 3 && b[0] === 0x1f && b[1] === 0x8b && b[2] === 0x08

/**
 * RFC 1950 §2.2 header: CM=8, CINFO<=7, and the CMF/FLG pair is a multiple of 31.
 * A raw deflate stream can never satisfy this: its first byte's low three bits are
 * BFINAL+BTYPE and bit 3 onward is either padding (zeroed) or Huffman data, so the
 * low nibble is never 8.
 */
const hasZlibHeader = (b: Uint8Array) =>
  b.length >= 2 && (b[0] & 0x0f) === 8 && b[0] >> 4 <= 7 && ((b[0] << 8) | b[1]) % 31 === 0

/** Errors that mean "this really is zlib, but the bytes are damaged" — never retried. */
const integrityError = (message: string) => Object.assign(new Error(message), { integrity: true })
const isIntegrityError = (e: unknown) => Boolean(e && (e as { integrity?: boolean }).integrity)

// --- Adler-32 (RFC 1950 §9) ------------------------------------------------
// fflate writes the checksum when deflating but never verifies it when inflating,
// so a corrupt payload would decompress to silently wrong bytes. Verify it here.
function adler32(data: Uint8Array): number {
  let a = 1
  let b = 0
  // 5552 is the largest block that cannot overflow the accumulators (RFC 1950 NMAX).
  for (let i = 0; i < data.length; ) {
    const end = Math.min(i + 5552, data.length)
    for (; i < end; i++) {
      a += data[i]
      b += a
    }
    a %= 65521
    b %= 65521
  }
  return ((b << 16) | a) >>> 0
}

/** The zlib trailer is a big-endian Adler-32 of the uncompressed data. */
function adlerMatches(stream: Uint8Array, out: Uint8Array): boolean {
  if (stream.length < 6) return false
  const n = stream.length
  const expected =
    ((stream[n - 4] << 24) | (stream[n - 3] << 16) | (stream[n - 2] << 8) | stream[n - 1]) >>> 0
  return expected === adler32(out)
}

/** Every code unit fits in a byte — the classic "binary held in a JS string" case. */
function fromLatin1(s: string): Uint8Array | null {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c > 0xff) return null
    out[i] = c
  }
  return out
}

function fromBase64(s: string): Uint8Array | null {
  const clean = s.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/(?<!=)=+$/, '')
  if (clean.length < 4 || clean.length % 4 === 1) return null
  if (!/^[A-Za-z0-9+/]+$/.test(clean)) return null
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  try {
    const bin = atob(padded)
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

function fromHex(s: string): Uint8Array | null {
  const clean = s.replace(/[\s:]+/g, '').replace(/^0x/i, '')
  if (clean.length < 4 || clean.length % 2 !== 0) return null
  if (!/^[0-9a-fA-F]+$/.test(clean)) return null
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

/**
 * A string reaching this step may be the raw bytes (latin1), or a base64 / hex
 * transport encoding of them. Build every plausible reading, zlib-header first.
 */
function byteCandidates(input: unknown): Uint8Array[] {
  if (isBytes(input)) return input.length ? [input] : []
  const s = input === null || input === undefined ? '' : String(input)
  const all = [fromLatin1(s), fromBase64(s), fromHex(s), new TextEncoder().encode(s)].filter(
    (b): b is Uint8Array => b !== null && b.length > 0
  )
  return [...all.filter(hasZlibHeader), ...all.filter((b) => !hasZlibHeader(b))]
}

const util: Utility = {
  id: 'deflate_decompress',
  name: 'deflate decompress',
  category: 'Compression',
  description:
    'Decompress DEFLATE data — zlib-wrapped or raw, auto-detected by default — to text or bytes, verifying the zlib Adler-32 trailer.',
  accepts: ['string', 'bytes'],
  produces: ['string', 'bytes'],
  tags: ['deflate', 'decompress', 'zlib', 'inflate', 'decompression'],
  examples: [
    {
      title: 'auto-detected zlib stream to text',
      input: '789cf348cdc9c9d751707175f3710c7155040025c40457',
      inputEncoding: 'hex',
      params: { format: 'auto', output: 'text' },
      output: 'Hello, DEFLATE!'
    }
  ],
  params: {
    format: { kind: 'select', label: 'format', options: ['auto', 'raw', 'zlib'], default: 'auto' },
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  async apply(input: any, params: any): Promise<string | Uint8Array> {
    const format = params?.format === 'raw' || params?.format === 'zlib' ? params.format : 'auto'
    const wantBytes = params?.output === 'bytes'
    const candidates = byteCandidates(input)
    // Empty in, empty out — an empty step should never look like a failure.
    if (candidates.length === 0) return wantBytes ? new Uint8Array(0) : ''

    if (format !== 'raw' && candidates.some(hasGzipMagic)) {
      throw new Error('input looks like gzip data — use the "gzip decompress" utility instead')
    }

    const { inflateSync, unzlibSync } = await getFflate()
    const raw = (b: Uint8Array) => inflateSync(b)
    const zlib = (b: Uint8Array) => {
      const out = unzlibSync(b)
      if (!adlerMatches(b, out)) {
        throw integrityError(
          'zlib integrity check failed: the Adler-32 trailer does not match the decompressed data (corrupt or truncated input)'
        )
      }
      return out
    }

    let out: Uint8Array | null = null
    let firstError = ''
    for (const candidate of candidates) {
      // `auto` is decided by the header, never by trial and error: falling back from
      // zlib to raw on the same bytes can "succeed" with garbage (raw deflate has no
      // checksum), and no real raw stream can carry a valid zlib header.
      const decode = format === 'raw' ? raw : format === 'zlib' ? zlib : hasZlibHeader(candidate) ? zlib : raw
      try {
        out = decode(candidate)
        break
      } catch (e: any) {
        // Damaged zlib is a real answer, not a reason to reinterpret the input.
        if (isIntegrityError(e)) throw e
        if (!firstError) firstError = e?.message || String(e)
      }
    }
    if (!out) {
      throw new Error(
        `not valid ${format === 'auto' ? 'deflate' : format} data (expected deflate bytes, or a base64/hex-encoded deflate stream): ${firstError}`
      )
    }

    if (wantBytes) return out
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(out)
    } catch {
      throw new Error('decompressed data is not valid UTF-8 text — set output to "bytes"')
    }
  }
}

export default util
