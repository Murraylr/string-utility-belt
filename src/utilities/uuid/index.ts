import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ */
/* randomness                                                          */
/* ------------------------------------------------------------------ */

/** mulberry32 — tiny deterministic PRNG, yields a uint32 per call. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return (t ^ (t >>> 14)) >>> 0
  }
}

/** seed 0 ⇒ crypto.getRandomValues; any other seed ⇒ reproducible output. */
function makeRng(seed: unknown): () => number {
  const s = Math.floor(Number(seed)) || 0
  if (s !== 0) return mulberry32(s >>> 0)
  let pool: Uint32Array | null = null
  let i = 0
  return () => {
    if (!pool || i >= pool.length) {
      pool = new Uint32Array(32)
      crypto.getRandomValues(pool)
      i = 0
    }
    return pool[i++] >>> 0
  }
}

function randomBytes(rng: () => number, n: number): Uint8Array {
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i += 4) {
    let v = rng()
    for (let j = 0; j < 4 && i + j < n; j++) {
      out[i + j] = v & 0xff
      v >>>= 8
    }
  }
  return out
}

/** `bits` uniformly random bits as a BigInt (drawn 32 at a time). */
function randomBits(rng: () => number, bits: number): bigint {
  let v = 0n
  for (let i = 0; i < Math.ceil(bits / 32); i++) v = (v << 32n) | BigInt(rng())
  return v & ((1n << BigInt(bits)) - 1n)
}

/* ------------------------------------------------------------------ */
/* uuid building blocks                                                */
/* ------------------------------------------------------------------ */

const VERSIONS = ['v4', 'v7', 'v1', 'nil', 'max']
const MAX_COUNT = 10000

/** Reproducible time anchor used when a non-zero seed is supplied: 2020-01-01T00:00:00Z. */
const SEEDED_EPOCH_MS = 1577836800000

/** 100-nanosecond intervals between 1582-10-15 (Gregorian epoch) and 1970-01-01. */
const GREGORIAN_OFFSET = 122192928000000000n

/** v7 carries 74 random bits: 12 in `rand_a`, 62 in `rand_b`. */
const MASK74 = (1n << 74n) - 1n
const MASK62 = (1n << 62n) - 1n

const intOf = (v: unknown, dflt: number): number => {
  if (v === undefined || v === null || v === '') return dflt
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? n : dflt
}

const boolOf = (v: unknown, dflt: boolean): boolean => {
  if (v === undefined || v === null || v === '') return dflt
  if (v === 'false') return false
  return Boolean(v)
}

const toHex = (bytes: Uint8Array): string => {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/** Write a non-negative integer big-endian into `bytes[offset .. offset+len-1]`. */
function writeBE(bytes: Uint8Array, offset: number, len: number, value: bigint): void {
  let v = value
  for (let i = len - 1; i >= 0; i--) {
    bytes[offset + i] = Number(v & 0xffn)
    v >>= 8n
  }
}

function v4Bytes(rng: () => number): Uint8Array {
  const b = randomBytes(rng, 16)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  return b
}

/**
 * RFC 9562 §5.7 — 48-bit unix millisecond prefix, then 74 random bits split
 * across `rand_a` (12) and `rand_b` (62). `rand` is supplied by the caller so a
 * batch sharing one millisecond can increment it and stay sortable (§6.2).
 */
function v7Bytes(ms: number, rand: bigint): Uint8Array {
  const b = new Uint8Array(16)
  writeBE(b, 0, 6, BigInt(ms))
  writeBE(b, 6, 2, 0x7000n | ((rand >> 62n) & 0x0fffn))
  writeBE(b, 8, 8, 0x8000000000000000n | (rand & MASK62))
  return b
}

/**
 * RFC 9562 §5.1 — 60-bit count of 100ns intervals since 1582-10-15. `clockSeq`
 * and `node` identify the generator, so they are fixed for a batch and only
 * `tick` advances.
 */
function v1Bytes(ms: number, tick: number, clockSeq: number, node: Uint8Array): Uint8Array {
  const ts = BigInt(ms) * 10000n + GREGORIAN_OFFSET + BigInt(tick)
  const b = new Uint8Array(16)
  writeBE(b, 0, 4, ts & 0xffffffffn)
  writeBE(b, 4, 2, (ts >> 32n) & 0xffffn)
  writeBE(b, 6, 2, ((ts >> 48n) & 0x0fffn) | 0x1000n)
  b[8] = 0x80 | (clockSeq >> 8)
  b[9] = clockSeq & 0xff
  b.set(node, 10)
  return b
}

function format(bytes: Uint8Array, uppercase: boolean, hyphens: boolean, braces: boolean): string {
  const hex = toHex(bytes)
  let s = hyphens
    ? `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
    : hex
  if (uppercase) s = s.toUpperCase()
  if (braces) s = `{${s}}`
  return s
}

/* ------------------------------------------------------------------ */

const util: Utility = {
  id: 'uuid',
  name: 'uuid',
  category: 'Generators',
  description:
    'Generate UUIDs (v4 random, v7 time-ordered, v1, nil or max) with optional uppercase, hyphens, braces and a seed for repeatable output.',
  accepts: 'string',
  produces: 'string',
  tags: ['guid', 'unique id', 'identifier', 'uuidv4', 'uuidv7'],
  aliases: ['guid', 'uuidgen'],
  examples: [
    {
      title: 'nil uuid',
      input: '',
      params: { version: 'nil' },
      output: '00000000-0000-0000-0000-000000000000'
    },
    {
      title: 'max uuid, uppercase with braces',
      input: '',
      params: { version: 'max', uppercase: true, braces: true },
      output: '{FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF}'
    },
    {
      title: 'seeded v4 uuid',
      input: '',
      params: { version: 'v4', seed: 42 },
      output: '8a2bc372-c032-4bda-adb0-73ab8a9ac02c'
    }
  ],
  params: {
    version: { kind: 'select', label: 'version', options: ['v4', 'v7', 'v1', 'nil', 'max'], default: 'v4' },
    count: { kind: 'number', label: 'count', default: 1, min: 1, max: MAX_COUNT, integer: true },
    uppercase: { kind: 'boolean', label: 'uppercase', default: false },
    hyphens: { kind: 'boolean', label: 'hyphens', default: true },
    braces: { kind: 'boolean', label: 'braces', default: false },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (_input: any, params: any) => {
    const p = params || {}
    const version = String(p.version ?? 'v4')
    if (!VERSIONS.includes(version)) throw new Error(`unknown uuid version "${version}" (use ${VERSIONS.join(', ')})`)

    const count = intOf(p.count, 1)
    if (count < 1) throw new Error('count must be at least 1')
    if (count > MAX_COUNT) throw new Error(`count must be ${MAX_COUNT} or less`)

    const uppercase = boolOf(p.uppercase, false)
    const hyphens = boolOf(p.hyphens, true)
    const braces = boolOf(p.braces, false)

    const seed = intOf(p.seed, 0)
    const rng = makeRng(seed)
    // A seeded run must be fully reproducible, so the clock is replaced by a
    // single seed-derived instant near 2020-01-01 rather than the real wall clock.
    const seededMs = seed !== 0 ? SEEDED_EPOCH_MS + rng() : 0
    const now = () => (seed !== 0 ? seededMs : Date.now())

    // Per-batch generator state. v1 keeps one clock sequence and node id (a batch
    // is one generator instance); v7 keeps one random field that is incremented
    // per id so the batch stays time-ordered even inside a single millisecond.
    let clockSeq = 0
    let node: Uint8Array = new Uint8Array(6)
    let batchMs = 0
    let v7Rand = 0n
    if (version === 'v1') {
      clockSeq = rng() & 0x3fff
      node = randomBytes(rng, 6)
      node[0] |= 0x01 // random node id ⇒ set the multicast bit
      batchMs = now()
    } else if (version === 'v7') {
      batchMs = now()
      // Leave headroom for `count - 1` increments so the batch can never wrap.
      v7Rand = randomBits(rng, 74) % (MASK74 + 1n - BigInt(count - 1))
    }

    const out: string[] = []
    for (let i = 0; i < count; i++) {
      let bytes: Uint8Array
      if (version === 'v4') bytes = v4Bytes(rng)
      else if (version === 'v7') bytes = v7Bytes(batchMs, v7Rand + BigInt(i))
      else if (version === 'v1') bytes = v1Bytes(batchMs, i, clockSeq, node)
      else if (version === 'nil') bytes = new Uint8Array(16)
      else bytes = new Uint8Array(16).fill(0xff)
      out.push(format(bytes, uppercase, hyphens, braces))
    }
    return out.join('\n')
  }
}

export default util
