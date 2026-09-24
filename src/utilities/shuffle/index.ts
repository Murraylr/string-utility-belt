import type { Utility } from '@/types/utility'

/**
 * mulberry32 — small, fast, deterministic 32-bit PRNG.
 * Used so a non-zero seed always produces the same permutation.
 */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** seed === 0 (or unusable) ⇒ unpredictable run, sourced from the platform CSPRNG. */
const randomSeed = () => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] || 0x9e3779b9
}

/**
 * A cleared number field in the params editor arrives as `''`, and `Number('')` is 0 —
 * so read numbers through this to fall back to the declared default instead.
 */
const numberParam = (v: unknown, fallback: number) =>
  v === undefined || v === null || v === '' ? fallback : Number(v)

const makeRng = (seed: unknown) => {
  const n = Math.trunc(numberParam(seed, 0))
  return mulberry32(Number.isFinite(n) && n !== 0 ? n : randomSeed())
}

/** Fisher–Yates, on a copy. */
const shuffled = <T>(items: T[], rng: () => number): T[] => {
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

const shuffleLines = (s: string, rng: () => number) => {
  // Keep a trailing newline attached to the end instead of shuffling a phantom empty line.
  const match = s.match(/(\r\n|\r|\n)$/)
  const trailing = match ? match[0] : ''
  const body = trailing ? s.slice(0, -trailing.length) : s
  const eol = s.includes('\r\n') ? '\r\n' : s.includes('\r') && !s.includes('\n') ? '\r' : '\n'
  return shuffled(body.split(/\r\n|\r|\n/), rng).join(eol) + trailing
}

const shuffleWords = (s: string, rng: () => number) => {
  const tokens = s.match(/\S+/gu) ?? []
  const mixed = shuffled(tokens, rng)
  let i = 0
  // Whitespace stays where it is, so line and paragraph shape survives.
  return s.replace(/\S+/gu, () => mixed[i++])
}

const shuffleCharacters = (s: string, rng: () => number) => {
  const cps = Array.from(s) // code points: astral characters stay intact
  const slots: number[] = []
  for (let i = 0; i < cps.length; i++) if (!/\s/u.test(cps[i])) slots.push(i)
  const mixed = shuffled(slots.map(i => cps[i]), rng)
  for (let k = 0; k < slots.length; k++) cps[slots[k]] = mixed[k]
  return cps.join('')
}

const util: Utility = {
  id: 'shuffle',
  name: 'shuffle',
  category: 'Generators',
  description:
    'Randomly reorder the lines, words, or characters of the text, with an optional non-zero seed for a reproducible shuffle.',
  accepts: 'string',
  produces: 'string',
  tags: ['randomize', 'permute', 'scramble', 'mix', 'fisher-yates', 'random order'],
  aliases: ['shuf'],
  examples: [
    {
      title: 'seeded word shuffle',
      input: 'the quick brown fox',
      params: { unit: 'words', seed: 42 },
      output: 'the fox quick brown'
    },
    {
      title: 'seeded line shuffle',
      input: 'one\ntwo\nthree\nfour',
      params: { unit: 'lines', seed: 42 },
      output: 'one\nfour\ntwo\nthree'
    }
  ],
  params: {
    unit: { kind: 'select', label: 'unit', options: ['lines', 'words', 'characters'], default: 'lines' },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (input: any, { unit, seed }: any) => {
    const s = String(input)
    if (s === '') return ''
    const mode = unit || 'lines'
    const rng = makeRng(seed)
    if (mode === 'lines') return shuffleLines(s, rng)
    if (mode === 'words') return shuffleWords(s, rng)
    if (mode === 'characters') return shuffleCharacters(s, rng)
    throw new Error(`unknown unit: ${String(mode)}`)
  }
}

export default util
