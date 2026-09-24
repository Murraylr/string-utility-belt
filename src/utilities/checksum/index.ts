import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/**
 * Non-cryptographic checksums / fast hashes.
 *
 * CRC-32, CRC-32C, Adler-32, xxHash-32 and xxHash-64 come from hash-wasm when
 * run with their standard starting value; everything else is hand-rolled here
 * and never touches the dependency — the pipeline re-runs on every keystroke,
 * so hash-wasm is only imported by the branches that actually need it.
 *
 * `seed` semantics — 0 always means "the algorithm's standard start", so the
 * default parameters produce textbook values:
 *   CRC-32 / CRC-32C  running CRC of everything hashed so far (so
 *                     crc(b, seed = crc(a)) === crc(a + b))
 *   Adler-32          running Adler value so far (standard start is 1)
 *   CRC-16-*          initial register value (standard start is 0xFFFF)
 *   FNV-1a-32/64      offset basis override
 *   djb2              initial accumulator (standard start is 5381)
 *   MurmurHash3 / xxHash / Java-hashCode / sdbm
 *                     the algorithm's own seed, used verbatim
 */

type HashWasm = typeof import('hash-wasm')
let _hashWasm: HashWasm | null = null
const getHashWasm = async (): Promise<HashWasm> => (_hashWasm ??= await import('hash-wasm'))

const ALGORITHMS = [
  'CRC-32',
  'CRC-32C',
  'CRC-16-CCITT',
  'CRC-16-MODBUS',
  'Adler-32',
  'FNV-1a-32',
  'FNV-1a-64',
  'MurmurHash3-32',
  'xxHash-32',
  'xxHash-64',
  'Java-hashCode',
  'djb2',
  'sdbm'
] as const

const OUTPUTS = ['hex', 'decimal'] as const

const CRC32_POLY = 0xedb88320
const CRC32C_POLY = 0x82f63b78

// ---------------------------------------------------------------- input

const toBytes = (input: unknown): Uint8Array =>
  isBytes(input) ? (input as Uint8Array) : new TextEncoder().encode(String(input ?? ''))

/** Java's String.hashCode is defined over UTF-16 code units, so it needs text. */
const toText = (input: unknown): string =>
  isBytes(input) ? new TextDecoder().decode(input as Uint8Array) : String(input ?? '')

// ---------------------------------------------------------------- CRCs

const crcTables = new Map<number, Uint32Array>()

const crcTable = (poly: number): Uint32Array => {
  const cached = crcTables.get(poly)
  if (cached) return cached
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? (poly ^ (c >>> 1)) >>> 0 : c >>> 1
    table[i] = c >>> 0
  }
  crcTables.set(poly, table)
  return table
}

/** Reflected table-driven CRC-32 (init/xorout 0xFFFFFFFF). */
const crc32 = (bytes: Uint8Array, poly: number, seed: number): number => {
  const table = crcTable(poly)
  let crc = ~(seed >>> 0) >>> 0
  for (let i = 0; i < bytes.length; i++) crc = (table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)) >>> 0
  return ~crc >>> 0
}

/** CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflection. */
const crc16Ccitt = (bytes: Uint8Array, init: number): number => {
  let crc = init & 0xffff
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc ^ (bytes[i] << 8)) & 0xffff
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc & 0xffff
}

/** CRC-16/MODBUS: poly 0xA001 (reflected 0x8005), init 0xFFFF. */
const crc16Modbus = (bytes: Uint8Array, init: number): number => {
  let crc = init & 0xffff
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i]
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1
  }
  return crc & 0xffff
}

// ---------------------------------------------------------------- others

/** `init` is a packed running Adler state (b<<16 | a); the standard start is 1. */
const adler32 = (bytes: Uint8Array, init: number): number => {
  let a = init & 0xffff
  let b = (init >>> 16) & 0xffff
  for (let i = 0; i < bytes.length; i++) {
    a = (a + bytes[i]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

const fnv1a32 = (bytes: Uint8Array, basis: number): number => {
  let h = basis >>> 0
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ bytes[i]) >>> 0
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

const FNV64_PRIME = 0x100000001b3n
const FNV64_MASK = 0xffffffffffffffffn

const fnv1a64 = (bytes: Uint8Array, basis: bigint): bigint => {
  let h = basis & FNV64_MASK
  for (let i = 0; i < bytes.length; i++) {
    h = (h ^ BigInt(bytes[i])) & FNV64_MASK
    h = (h * FNV64_PRIME) & FNV64_MASK
  }
  return h
}

const murmur3_32 = (bytes: Uint8Array, seed: number): number => {
  const c1 = 0xcc9e2d51
  const c2 = 0x1b873593
  const len = bytes.length
  const nblocks = len >>> 2
  let h1 = seed | 0

  for (let i = 0; i < nblocks; i++) {
    const o = i << 2
    let k1 = (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) | 0
    k1 = Math.imul(k1, c1)
    k1 = (k1 << 15) | (k1 >>> 17)
    k1 = Math.imul(k1, c2)
    h1 ^= k1
    h1 = (h1 << 13) | (h1 >>> 19)
    h1 = (Math.imul(h1, 5) + 0xe6546b64) | 0
  }

  const rem = len & 3
  if (rem > 0) {
    const tail = nblocks << 2
    let k1 = 0
    if (rem === 3) k1 ^= bytes[tail + 2] << 16
    if (rem >= 2) k1 ^= bytes[tail + 1] << 8
    k1 ^= bytes[tail]
    k1 = Math.imul(k1, c1)
    k1 = (k1 << 15) | (k1 >>> 17)
    k1 = Math.imul(k1, c2)
    h1 ^= k1
  }

  h1 ^= len
  h1 ^= h1 >>> 16
  h1 = Math.imul(h1, 0x85ebca6b)
  h1 ^= h1 >>> 13
  h1 = Math.imul(h1, 0xc2b2ae35)
  h1 ^= h1 >>> 16
  return h1 >>> 0
}

/** java.lang.String.hashCode — 31 * h + char, over UTF-16 code units, signed. */
const javaHashCode = (text: string, seed: number): number => {
  let h = seed | 0
  for (let i = 0; i < text.length; i++) h = (Math.imul(31, h) + text.charCodeAt(i)) | 0
  return h | 0
}

/** Bernstein djb2: h = h * 33 + c. */
const djb2 = (bytes: Uint8Array, init: number): number => {
  let h = init >>> 0
  for (let i = 0; i < bytes.length; i++) h = (Math.imul(h, 33) + bytes[i]) >>> 0
  return h >>> 0
}

/** sdbm: h = c + (h << 6) + (h << 16) - h. */
const sdbm = (bytes: Uint8Array, init: number): number => {
  let h = init >>> 0
  for (let i = 0; i < bytes.length; i++) h = (bytes[i] + (h << 6) + (h << 16) - h) >>> 0
  return h >>> 0
}

// ---------------------------------------------------------------- output

/** `decimal` is only set when it differs from the unsigned value (Java-hashCode). */
type Digest = { value: bigint; hexDigits: number; decimal?: string }

const unsigned = (value: number, hexDigits: number): Digest => ({
  value: BigInt(value >>> 0),
  hexDigits
})

const fromHex = (hex: string, hexDigits: number): Digest => ({
  value: BigInt('0x' + hex),
  hexDigits
})

const util: Utility = {
  id: 'checksum',
  name: 'checksum',
  category: 'Hashing',
  description:
    'Compute a non-cryptographic checksum (CRC-32/32C, CRC-16, Adler-32, FNV-1a, MurmurHash3, xxHash, Java hashCode, djb2, sdbm) as hex or decimal, with an optional seed.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['crc', 'crc32', 'hash', 'fingerprint', 'fast hash', 'non-cryptographic', 'fnv', 'murmurhash', 'xxhash'],
  aliases: ['cksum', 'crc32'],
  examples: [
    {
      title: 'CRC-32 of "hello"',
      input: 'hello',
      output: '3610a686'
    },
    {
      title: 'same digest as a decimal',
      input: 'hello',
      params: { output: 'decimal' },
      output: '907060870'
    }
  ],
  params: {
    algorithm: {
      kind: 'select',
      label: 'algorithm',
      options: [...ALGORITHMS],
      default: 'CRC-32'
    },
    output: {
      kind: 'select',
      label: 'output',
      options: [...OUTPUTS],
      default: 'hex'
    },
    seed: {
      kind: 'number',
      label: 'seed (0 = algorithm default)',
      default: 0
    }
  },
  apply: async (input: any, params: any) => {
    const algorithm = String(params?.algorithm ?? 'CRC-32')
    const output = String(params?.output ?? 'hex')
    const rawSeed = params?.seed === '' || params?.seed === undefined || params?.seed === null
      ? 0
      : Number(params.seed)

    if (!(ALGORITHMS as readonly string[]).includes(algorithm)) {
      throw new Error(`unknown algorithm: ${algorithm} (expected ${ALGORITHMS.join(', ')})`)
    }
    if (!(OUTPUTS as readonly string[]).includes(output)) {
      throw new Error(`unknown output format: ${output} (expected ${OUTPUTS.join(', ')})`)
    }
    if (!Number.isFinite(rawSeed)) throw new Error('seed must be a finite number')
    const seed = Math.trunc(rawSeed)
    if (!Number.isSafeInteger(seed)) throw new Error('seed is too large to represent exactly')

    const bytes = toBytes(input)
    if (bytes.length === 0) return ''

    let digest: Digest
    switch (algorithm) {
      // hash-wasm covers the standard-seed cases; the hand-rolled versions carry
      // a caller-supplied starting value.
      case 'CRC-32':
      case 'CRC-32C': {
        const poly = algorithm === 'CRC-32C' ? CRC32C_POLY : CRC32_POLY
        digest =
          seed === 0
            ? fromHex(await (await getHashWasm()).crc32(bytes, poly), 8)
            : unsigned(crc32(bytes, poly, seed), 8)
        break
      }
      case 'CRC-16-CCITT':
        digest = unsigned(crc16Ccitt(bytes, seed === 0 ? 0xffff : seed & 0xffff), 4)
        break
      case 'CRC-16-MODBUS':
        digest = unsigned(crc16Modbus(bytes, seed === 0 ? 0xffff : seed & 0xffff), 4)
        break
      case 'Adler-32':
        // seed 0 means "standard start", which for Adler is the state a=1,b=0
        digest =
          seed === 0
            ? fromHex(await (await getHashWasm()).adler32(bytes), 8)
            : unsigned(adler32(bytes, seed >>> 0), 8)
        break
      case 'FNV-1a-32':
        digest = unsigned(fnv1a32(bytes, seed === 0 ? 0x811c9dc5 : seed >>> 0), 8)
        break
      case 'FNV-1a-64': {
        const basis = seed === 0 ? 0xcbf29ce484222325n : BigInt.asUintN(64, BigInt(seed))
        digest = { value: fnv1a64(bytes, basis), hexDigits: 16 }
        break
      }
      case 'MurmurHash3-32':
        digest = unsigned(murmur3_32(bytes, seed | 0), 8)
        break
      case 'xxHash-32':
        digest = fromHex(await (await getHashWasm()).xxhash32(bytes, seed >>> 0), 8)
        break
      case 'xxHash-64': {
        const big = BigInt.asUintN(64, BigInt(seed))
        const low = Number(big & 0xffffffffn)
        const high = Number((big >> 32n) & 0xffffffffn)
        digest = fromHex(await (await getHashWasm()).xxhash64(bytes, low, high), 16)
        break
      }
      case 'Java-hashCode': {
        // signed 32-bit in decimal, like Java prints it; unsigned in hex
        const h = javaHashCode(toText(input), seed | 0)
        digest = { value: BigInt(h >>> 0), hexDigits: 8, decimal: String(h) }
        break
      }
      case 'djb2':
        digest = unsigned(djb2(bytes, seed === 0 ? 5381 : seed >>> 0), 8)
        break
      case 'sdbm':
        digest = unsigned(sdbm(bytes, seed >>> 0), 8)
        break
      default:
        throw new Error(`unknown algorithm: ${algorithm}`)
    }

    if (output === 'decimal') return digest.decimal ?? digest.value.toString(10)
    return digest.value.toString(16).padStart(digest.hexDigits, '0')
  }
}

export default util
