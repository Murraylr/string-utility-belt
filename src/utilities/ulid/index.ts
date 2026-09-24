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

/* ------------------------------------------------------------------ */
/* ulid building blocks                                                */
/* ------------------------------------------------------------------ */

/** Crockford base32 — no I, L, O or U. */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

const TIME_CHARS = 10 // 48 bits of milliseconds
const RANDOM_CHARS = 16 // 80 bits of entropy
const MAX_TIME = 281474976710655 // 2^48 - 1
const MASK80 = (1n << 80n) - 1n
const MAX_COUNT = 10000

/** Reproducible time anchor used when a non-zero seed is supplied: 2020-01-01T00:00:00Z. */
const SEEDED_EPOCH_MS = 1577836800000

const intOf = (v: unknown, dflt: number): number => {
  if (v === undefined || v === null || v === '') return dflt
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? n : dflt
}

/** Big-endian Crockford base32 of `value`, left-padded to `length` characters. */
function encodeBase32(value: bigint, length: number): string {
  let v = value
  let out = ''
  for (let i = 0; i < length; i++) {
    out = CROCKFORD[Number(v & 31n)] + out
    v >>= 5n
  }
  return out
}

/* ------------------------------------------------------------------ */

const util: Utility = {
  id: 'ulid',
  name: 'ulid',
  category: 'Generators',
  description:
    'Generate lexicographically sortable ULIDs (48-bit timestamp + 80 random bits in Crockford base32), monotonic within a batch and repeatable with a seed.',
  accepts: 'string',
  produces: 'string',
  tags: ['id', 'sortable id', 'lexicographic', 'unique id', 'timestamp id'],
  examples: [
    {
      title: 'seeded ulid at a fixed timestamp',
      input: '',
      params: { timestamp: 1700000000000, seed: 42 },
      output: '01HF7YAT00XXY75GSBHBD3PCP0'
    },
    {
      title: 'a monotonic batch of three',
      input: '',
      params: { count: 3, timestamp: 1700000000000, seed: 42 },
      output: '01HF7YAT00XXY75GSBHBD3PCP0\n01HF7YAT00XXY75GSBHBD3PCP1\n01HF7YAT00XXY75GSBHBD3PCP2'
    }
  ],
  params: {
    count: { kind: 'number', label: 'count', default: 1, min: 1, max: MAX_COUNT, integer: true },
    timestamp: { kind: 'number', label: 'timestamp ms (0 = now)', default: 0, min: 0, max: MAX_TIME, integer: true },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (_input: any, params: any) => {
    const p = params || {}

    const count = intOf(p.count, 1)
    if (count < 1) throw new Error('count must be at least 1')
    if (count > MAX_COUNT) throw new Error(`count must be ${MAX_COUNT} or less`)

    const seed = intOf(p.seed, 0)
    const rng = makeRng(seed)

    const requested = intOf(p.timestamp, 0)
    if (requested < 0) throw new Error('timestamp must not be negative')
    if (requested > MAX_TIME) throw new Error(`timestamp must be ${MAX_TIME} or less (48 bits)`)

    // A seeded run must be fully reproducible, so an unset clock becomes a
    // seed-derived instant near 2020-01-01 rather than the real wall clock.
    const ms = requested !== 0 ? requested : seed !== 0 ? SEEDED_EPOCH_MS + rng() : Date.now()
    const timePart = encodeBase32(BigInt(ms), TIME_CHARS)

    // 80 bits of entropy, then +1 per entry so a batch sorts in generation order.
    // The modulus leaves headroom for `count - 1` increments, so the entropy can
    // never wrap past 2^80 and break monotonicity part-way through a batch.
    let entropy = 0n
    for (let i = 0; i < 3; i++) entropy = (entropy << 32n) | BigInt(rng())
    entropy = (entropy & MASK80) % (MASK80 + 1n - BigInt(count - 1))

    const out: string[] = []
    for (let i = 0; i < count; i++) out.push(timePart + encodeBase32(entropy + BigInt(i), RANDOM_CHARS))
    return out.join('\n')
  }
}

export default util
