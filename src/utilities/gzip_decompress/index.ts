import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

type Fflate = typeof import('fflate')
let _fflate: Fflate | null = null
const getFflate = async (): Promise<Fflate> => {
  if (!_fflate) _fflate = await import('fflate')
  return _fflate
}

/** RFC 1952 §2.3: ID1=0x1f, ID2=0x8b, CM=8 (deflate is the only method ever defined). */
const hasGzipMagic = (b: Uint8Array) =>
  b.length >= 3 && b[0] === 0x1f && b[1] === 0x8b && b[2] === 0x08

/** Errors that mean "this really is gzip, but the bytes are damaged" — never retried. */
const integrityError = (message: string) => Object.assign(new Error(message), { integrity: true })
const isIntegrityError = (e: unknown) => Boolean(e && (e as { integrity?: boolean }).integrity)

// --- CRC-32 (IEEE 802.3, the polynomial gzip uses) -------------------------
// fflate computes the trailer on the way in but never checks it on the way out,
// so a corrupt payload would decompress to silently wrong bytes. Verify it here.
let crcTable: Int32Array | null = null
function crc32(data: Uint8Array): number {
  if (!crcTable) {
    const table = new Int32Array(256)
    for (let i = 0; i < 256; i++) {
      let c = i
      for (let k = 0; k < 8; k++) c = c & 1 ? -306674912 ^ (c >>> 1) : c >>> 1
      table[i] = c
    }
    crcTable = table
  }
  const table = crcTable
  let c = -1
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}

const readU32LE = (b: Uint8Array, i: number) =>
  (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0

const CORRUPT =
  'gzip integrity check failed: the CRC-32/size trailer does not match the decompressed data (corrupt or truncated input)'

/** The shortest gzip member: a 10-byte header, an empty deflate block (2 bytes) and the 8-byte trailer. */
const MIN_GZIP_LENGTH = 20

/**
 * Decompress a gzip stream and check it.
 *
 * `gunzipSync` is not enough on its own: it stops after the first member (silently
 * dropping the rest of a concatenated file, RFC 1952 §2.2) and never looks at the
 * CRC-32/ISIZE trailer, so damaged bytes decompress to silently wrong output. The
 * streaming reader walks every member, and each member's trailer is then checked
 * against its slice of the output.
 */
async function gunzipVerified(bytes: Uint8Array): Promise<Uint8Array> {
  // The streaming reader checks a header only once it has all of it, so a few bytes of
  // anything (`{`, `[`, a cut-off `H4sIAAAA`) end the stream with no member and no error,
  // and the trailer check below would report them as damaged gzip. They are not gzip.
  if (!hasGzipMagic(bytes)) throw new Error('invalid gzip data')
  if (bytes.length < MIN_GZIP_LENGTH) {
    throw new Error(`only ${bytes.length} bytes, and the shortest gzip stream is ${MIN_GZIP_LENGTH}`)
  }

  const { Gunzip } = await getFflate()

  const chunks: Uint8Array[] = []
  const starts = [0]
  let total = 0
  const stream = new Gunzip((chunk: Uint8Array) => {
    chunks.push(chunk)
    total += chunk.length
  })
  stream.onmember = (offset: number) => starts.push(offset)
  stream.push(bytes, true)

  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }

  // RFC 1952 §2.3.1: each member ends with CRC-32 then ISIZE (length mod 2^32).
  let off = 0
  for (let i = 0; i < starts.length; i++) {
    const end = i + 1 < starts.length ? starts[i + 1] : bytes.length
    if (end - starts[i] < 8) throw integrityError(CORRUPT)
    const size = readU32LE(bytes, end - 4)
    if (off + size > out.length) throw integrityError(CORRUPT)
    if (readU32LE(bytes, end - 8) !== crc32(out.subarray(off, off + size))) {
      throw integrityError(CORRUPT)
    }
    off += size
  }
  if (off !== out.length) throw integrityError(CORRUPT)
  return out
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
 * transport encoding of them. Build every plausible reading, gzip-magic first.
 */
function byteCandidates(input: unknown): Uint8Array[] {
  if (isBytes(input)) return input.length ? [input] : []
  const s = input === null || input === undefined ? '' : String(input)
  const all = [fromLatin1(s), fromBase64(s), fromHex(s), new TextEncoder().encode(s)].filter(
    (b): b is Uint8Array => b !== null && b.length > 0
  )
  return [...all.filter(hasGzipMagic), ...all.filter((b) => !hasGzipMagic(b))]
}

const util: Utility = {
  id: 'gzip_decompress',
  name: 'gzip decompress',
  category: 'Compression',
  description:
    'Decompress a gzip stream — raw bytes or a base64/hex-encoded gzip string, single or multi-member — to text or bytes, verifying the CRC-32 trailer.',
  accepts: ['string', 'bytes'],
  produces: ['string', 'bytes'],
  tags: ['gzip', 'decompress', 'gunzip', 'decompression', 'gz'],
  examples: [
    {
      title: 'decompress a gzip stream to text',
      input: '1f8b0800000000000003f348cdc9c9d75148afca2c5004003e3d0f100c000000',
      inputEncoding: 'hex',
      params: { output: 'text' },
      output: 'Hello, gzip!'
    }
  ],
  params: {
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  async apply(input: any, params: any): Promise<string | Uint8Array> {
    const wantBytes = params?.output === 'bytes'
    const candidates = byteCandidates(input)
    // Empty in, empty out — an empty step should never look like a failure.
    if (candidates.length === 0) return wantBytes ? new Uint8Array(0) : ''

    let out: Uint8Array | null = null
    let firstError = ''
    for (const candidate of candidates) {
      try {
        out = await gunzipVerified(candidate)
        break
      } catch (e: any) {
        // Damaged gzip is a real answer, not a reason to reinterpret the input.
        if (isIntegrityError(e)) throw e
        if (!firstError) firstError = e?.message || String(e)
      }
    }
    if (!out) {
      throw new Error(
        `not valid gzip data (expected gzip bytes, or a base64/hex-encoded gzip stream): ${firstError}`
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
