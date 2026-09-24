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

/** Uniform index in [0, n) — rejection sampling keeps the character set unbiased. */
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
/* character sets                                                      */
/* ------------------------------------------------------------------ */

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'

const PRESETS: Record<string, string> = {
  alphanumeric: LOWER + UPPER + DIGITS,
  alpha: LOWER + UPPER,
  lowercase: LOWER,
  uppercase: UPPER,
  numeric: DIGITS,
  hex: '0123456789abcdef',
  symbols: SYMBOLS,
  all: LOWER + UPPER + DIGITS + SYMBOLS
}

const CHARSETS = [...Object.keys(PRESETS), 'custom']

const MAX_LENGTH = 4096
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
 * Expand a custom character-set spec into code points. `a-z` is a range; a
 * leading or trailing `-` is a literal dash. Iterates code points, so astral
 * characters (emoji) stay whole, and skips surrogate halves so a range spanning
 * U+D800 cannot emit broken output.
 */
export function expandCharset(spec: string): string[] {
  const chars = Array.from(spec ?? '')
  const out: string[] = []
  for (let i = 0; i < chars.length; i++) {
    if (chars[i + 1] === '-' && i + 2 < chars.length) {
      const start = chars[i].codePointAt(0) as number
      const end = chars[i + 2].codePointAt(0) as number
      if (start > end) throw new Error(`invalid character range "${chars[i]}-${chars[i + 2]}"`)
      if (out.length + (end - start + 1) > MAX_ALPHABET) throw new Error('character set is too large')
      for (let cp = start; cp <= end; cp++) {
        if (isSurrogate(cp)) continue
        out.push(String.fromCodePoint(cp))
      }
      i += 2
      continue
    }
    if (isSurrogate(chars[i].codePointAt(0) as number)) continue
    if (out.length >= MAX_ALPHABET) throw new Error('character set is too large')
    out.push(chars[i])
  }
  return out
}

/* ------------------------------------------------------------------ */

const util: Utility = {
  id: 'random_string',
  name: 'random string',
  category: 'Generators',
  description:
    'Generate random strings of a given length from a preset character set (alphanumeric, hex, symbols and more) or a custom one, with a count and a seed for repeatable output.',
  accepts: 'string',
  produces: 'string',
  tags: ['random', 'token', 'alphanumeric', 'custom charset', 'random text'],
  aliases: ['pwgen'],
  examples: [
    {
      title: 'seeded alphanumeric string',
      input: '',
      params: { length: 12, seed: 42 },
      output: 'KESvO50HW7tf'
    },
    {
      title: 'seeded hex string',
      input: '',
      params: { length: 8, charset: 'hex', seed: 42 },
      output: 'ca0da341'
    }
  ],
  params: {
    length: { kind: 'number', label: 'length', default: 16, min: 0, max: MAX_LENGTH, integer: true },
    charset: {
      kind: 'select',
      label: 'character set',
      options: ['alphanumeric', 'alpha', 'lowercase', 'uppercase', 'numeric', 'hex', 'symbols', 'all', 'custom'],
      default: 'alphanumeric'
    },
    custom: { kind: 'string', label: 'custom characters (a-z ranges ok)', default: '' },
    count: { kind: 'number', label: 'count', default: 1, min: 1, max: MAX_COUNT, integer: true },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (_input: any, params: any) => {
    const p = params || {}

    const length = intOf(p.length, 16)
    if (length < 0) throw new Error('length must be 0 or more')
    if (length > MAX_LENGTH) throw new Error(`length must be ${MAX_LENGTH} or less`)

    const count = intOf(p.count, 1)
    if (count < 1) throw new Error('count must be at least 1')
    if (count > MAX_COUNT) throw new Error(`count must be ${MAX_COUNT} or less`)
    if (length * count > MAX_OUTPUT) throw new Error(`length x count must be ${MAX_OUTPUT} or less`)

    const charset = String(p.charset ?? 'alphanumeric')
    if (!CHARSETS.includes(charset)) throw new Error(`unknown character set "${charset}" (use ${CHARSETS.join(', ')})`)

    const chars =
      charset === 'custom' ? expandCharset(String(p.custom ?? '')) : Array.from(PRESETS[charset])
    if (chars.length === 0) throw new Error('custom character set is empty')

    const rng = makeRng(intOf(p.seed, 0))

    const out: string[] = []
    for (let i = 0; i < count; i++) {
      let s = ''
      for (let j = 0; j < length; j++) s += chars[randomIndex(rng, chars.length)]
      out.push(s)
    }
    return out.join('\n')
  }
}

export default util
