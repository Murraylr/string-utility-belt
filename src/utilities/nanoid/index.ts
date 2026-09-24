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

/** Uniform index in [0, n) — rejection sampling keeps the alphabet unbiased. */
function randomIndex(rng: () => number, n: number): number {
  if (n <= 1) return 0
  const limit = Math.floor(0x100000000 / n) * n
  for (let i = 0; i < 64; i++) {
    const v = rng()
    if (v < limit) return v % n
  }
  return rng() % n
}

/* ------------------------------------------------------------------ */
/* alphabet                                                            */
/* ------------------------------------------------------------------ */

const MAX_SIZE = 4096
const MAX_COUNT = 10000
const MAX_OUTPUT = 1000000
const MAX_ALPHABET = 65536

const intOf = (v: unknown, dflt: number): number => {
  if (v === undefined || v === null || v === '') return dflt
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? n : dflt
}

/** U+D800..U+DFFF are surrogate halves — never valid characters on their own. */
const isSurrogate = (cp: number): boolean => cp >= 0xd800 && cp <= 0xdfff

/**
 * Expand a character-set spec into code points. `a-z` is a range; a leading or
 * trailing `-` is a literal dash. Iterates code points, so astral characters
 * (emoji) stay whole, and skips surrogate halves so a range spanning U+D800
 * cannot emit broken output.
 */
export function expandAlphabet(spec: string): string[] {
  const chars = Array.from(spec ?? '')
  const out: string[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i + 1] === '-' && i + 2 < chars.length) {
      const start = chars[i].codePointAt(0) as number
      const end = chars[i + 2].codePointAt(0) as number
      if (start > end) throw new Error(`invalid character range "${chars[i]}-${chars[i + 2]}"`)
      if (out.length + (end - start + 1) > MAX_ALPHABET) throw new Error('alphabet is too large')
      for (let cp = start; cp <= end; cp++) {
        if (isSurrogate(cp)) continue
        out.push(String.fromCodePoint(cp))
      }
      i += 2
      continue
    }
    if (isSurrogate(chars[i].codePointAt(0) as number)) continue
    if (out.length >= MAX_ALPHABET) throw new Error('alphabet is too large')
    out.push(chars[i])
  }
  return out
}

/* ------------------------------------------------------------------ */

const util: Utility = {
  id: 'nanoid',
  name: 'nanoid',
  category: 'Generators',
  description:
    'Generate URL-safe Nano IDs of any size from a custom alphabet (a-z ranges supported), with a count and a seed for repeatable output.',
  accepts: 'string',
  produces: 'string',
  tags: ['id', 'unique id', 'random id', 'url safe', 'identifier', 'short id'],
  aliases: ['nano id'],
  examples: [
    {
      title: 'seeded id, default alphabet',
      input: '',
      params: { size: 10, seed: 42 },
      output: '8KAtKTUBeB'
    },
    {
      title: 'digits-only id',
      input: '',
      params: { size: 6, alphabet: '0-9', seed: 42 },
      output: '604587'
    }
  ],
  params: {
    size: { kind: 'number', label: 'size', default: 21, min: 0, max: MAX_SIZE, integer: true },
    alphabet: { kind: 'string', label: 'alphabet (a-z ranges ok)', default: 'A-Za-z0-9_-' },
    count: { kind: 'number', label: 'count', default: 1, min: 1, max: MAX_COUNT, integer: true },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (_input: any, params: any) => {
    const p = params || {}

    const size = intOf(p.size, 21)
    if (size < 0) throw new Error('size must be 0 or more')
    if (size > MAX_SIZE) throw new Error(`size must be ${MAX_SIZE} or less`)

    const count = intOf(p.count, 1)
    if (count < 1) throw new Error('count must be at least 1')
    if (count > MAX_COUNT) throw new Error(`count must be ${MAX_COUNT} or less`)
    if (size * count > MAX_OUTPUT) throw new Error(`size x count must be ${MAX_OUTPUT} or less`)

    const spec = p.alphabet === undefined || p.alphabet === null ? 'A-Za-z0-9_-' : String(p.alphabet)
    const alphabet = expandAlphabet(spec)
    if (alphabet.length === 0) throw new Error('alphabet must contain at least one character')

    const rng = makeRng(intOf(p.seed, 0))

    const out: string[] = []
    for (let i = 0; i < count; i++) {
      let id = ''
      for (let j = 0; j < size; j++) id += alphabet[randomIndex(rng, alphabet.length)]
      out.push(id)
    }
    return out.join('\n')
  }
}

export default util
