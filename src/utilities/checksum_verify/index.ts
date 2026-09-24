import type { Utility } from '@/types/utility'
import { bytesToHex, isBytes, textToUint8Array } from '../helpers'

const ALGORITHMS = ['MD5', 'SHA-1', 'SHA-256', 'SHA-384', 'SHA-512', 'CRC-32'] as const
type Algorithm = (typeof ALGORITHMS)[number]

const toBytes = (value: unknown): Uint8Array =>
  isBytes(value) ? value : textToUint8Array(value === null || value === undefined ? '' : String(value))

/* ------------------------------------------------------------------ CRC-32 */

let crcTable: Uint32Array | null = null

const getCrcTable = (): Uint32Array => {
  if (crcTable) return crcTable
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) >>> 0 : c >>> 1
    table[n] = c >>> 0
  }
  crcTable = table
  return table
}

const crc32Hex = (bytes: Uint8Array): string => {
  const table = getCrcTable()
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = (table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0
  return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0')
}

/* --------------------------------------------------------------------- MD5 */
// crypto.subtle has no MD5, so it is hand-rolled here (RFC 1321).

const MD5_SHIFTS = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21
]

// RFC 1321 K table, written out literally. Deriving it from
// `Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32)` is the textbook trick, but
// Math.sin is implementation-defined in ECMAScript: a one-ULP difference
// between engines can shift a constant across an integer boundary and change
// every digest this utility produces. Constants must not depend on the engine.
const MD5_K = new Uint32Array([
  0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
  0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
  0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
  0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
  0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
  0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
  0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
  0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
  0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
  0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
  0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
  0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
  0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
  0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
  0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
  0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
])

const rotl32 = (value: number, bits: number): number => ((value << bits) | (value >>> (32 - bits))) >>> 0

const wordToLittleEndianHex = (word: number): string => {
  let out = ''
  for (let i = 0; i < 4; i++) out += ((word >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
  return out
}

const md5Hex = (bytes: Uint8Array): string => {
  const k = MD5_K
  const length = bytes.length
  const padded = new Uint8Array((((length + 8) >>> 6) + 1) << 6)
  padded.set(bytes)
  padded[length] = 0x80

  const view = new DataView(padded.buffer)
  // 64-bit little-endian bit length, split so huge inputs stay exact
  view.setUint32(padded.length - 8, (length * 8) % 4294967296 >>> 0, true)
  view.setUint32(padded.length - 4, Math.floor(length / 536870912) >>> 0, true)

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const block = new Uint32Array(16)
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let j = 0; j < 16; j++) block[j] = view.getUint32(offset + j * 4, true)

    let a = a0
    let b = b0
    let c = c0
    let d = d0

    for (let i = 0; i < 64; i++) {
      let f: number
      let g: number
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      const tmp = d
      d = c
      c = b
      const sum = (((f >>> 0) + a) >>> 0) + ((k[i] + block[g]) >>> 0)
      b = (b + rotl32(sum >>> 0, MD5_SHIFTS[i])) >>> 0
      a = tmp
    }

    a0 = (a0 + a) >>> 0
    b0 = (b0 + b) >>> 0
    c0 = (c0 + c) >>> 0
    d0 = (d0 + d) >>> 0
  }

  return (
    wordToLittleEndianHex(a0) +
    wordToLittleEndianHex(b0) +
    wordToLittleEndianHex(c0) +
    wordToLittleEndianHex(d0)
  )
}

/* ------------------------------------------------------------- digest util */

const digestHex = async (algorithm: Algorithm, bytes: Uint8Array): Promise<string> => {
  if (algorithm === 'CRC-32') return crc32Hex(bytes)
  if (algorithm === 'MD5') return md5Hex(bytes)
  const digest = await crypto.subtle.digest(algorithm, bytes as BufferSource)
  return bytesToHex(new Uint8Array(digest))
}

/** Pull the digest out of a bare hash, a `hash  filename` line, or `MD5 (file) = hash`. */
export const parseExpected = (raw: unknown): string => {
  const text = raw === null || raw === undefined ? '' : String(raw)
  const line = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0)
  if (!line) return ''
  const bsd = /^[A-Za-z0-9-]+\s*\(.+\)\s*=\s*(\S+)\s*$/.exec(line)
  if (bsd) return bsd[1]
  return line.split(/\s+/)[0]
}

const base64ToHex = (token: string): string | null => {
  const clean = token.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/(?<!=)=+$/, '')
  if (!clean || !/^[A-Za-z0-9+/]+$/.test(clean) || clean.length % 4 === 1) return null
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  try {
    const bin = atob(padded)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return bytesToHex(bytes)
  } catch {
    return null
  }
}

/** Reduce an expected digest to lowercase hex for comparison, or null if unreadable. */
const toComparableHex = (token: string, isCrc: boolean): string | null => {
  if (!token) return null
  const stripped = token.replace(/^0x/i, '').replace(/[\s:-]/g, '')
  if (!stripped) return null
  if (/^[0-9a-fA-F]+$/.test(stripped)) {
    // CRC-32 is habitually written as a plain number with its leading zeros
    // dropped ('f86c29' for 00f86c29), so widen it back to four bytes. This
    // has to happen for any short form, not just odd-digit ones.
    if (isCrc && stripped.length <= 8) return stripped.toLowerCase().padStart(8, '0')
    if (stripped.length % 2 === 0) return stripped.toLowerCase()
  }
  return base64ToHex(token.trim())
}

const util: Utility = {
  id: 'checksum_verify',
  name: 'checksum verify',
  category: 'Hashing',
  description:
    'Hash the input with MD5, SHA-1, SHA-256, SHA-384, SHA-512 or CRC-32 and report whether it matches an expected digest.',
  accepts: ['string', 'bytes'],
  produces: 'json',
  tags: ['hash check', 'verify checksum', 'integrity', 'sha256sum', 'md5sum', 'compare hash'],
  aliases: ['sha256sum', 'md5sum', 'shasum'],
  examples: [
    {
      title: 'matching SHA-256 digest',
      input: 'hello',
      params: { algorithm: 'SHA-256', expected: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' },
      output: '{\n  "algorithm": "SHA-256",\n  "actual": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",\n  "expected": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",\n  "match": true\n}'
    },
    {
      title: 'mismatched digest',
      input: 'hello',
      params: { algorithm: 'MD5', expected: 'deadbeef' },
      output: '{\n  "algorithm": "MD5",\n  "actual": "5d41402abc4b2a76b9719d911017c592",\n  "expected": "deadbeef",\n  "match": false\n}'
    }
  ],
  params: {
    algorithm: {
      kind: 'select',
      label: 'algorithm',
      options: [...ALGORITHMS],
      default: 'SHA-256'
    },
    expected: {
      kind: 'string',
      label: 'expected digest',
      default: '',
      placeholder: 'expected hash (or a `hash  filename` line)'
    }
  },
  apply: async (input: any, params: any) => {
    const p = params || {}
    const requested = p.algorithm === undefined || p.algorithm === null || p.algorithm === ''
      ? 'SHA-256'
      : String(p.algorithm).trim()
    const algorithm = ALGORITHMS.find((a) => a.toLowerCase() === requested.toLowerCase())
    if (!algorithm) throw new Error(`unsupported checksum algorithm: ${requested}`)

    const actual = await digestHex(algorithm, toBytes(input))
    const expected = parseExpected(p.expected)
    const comparable = toComparableHex(expected, algorithm === 'CRC-32')

    return {
      algorithm,
      actual,
      expected,
      match: comparable !== null && comparable === actual
    }
  }
}

export default util
