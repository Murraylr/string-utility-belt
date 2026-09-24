import type { Utility } from '@/types/utility'

/** mulberry32 — deterministic 32-bit PRNG, so a non-zero seed reproduces the same output. */
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
 * so read numbers through this to fall back to the declared default instead. Genuine
 * garbage (`'half'`) still becomes NaN and is rejected by the caller.
 */
const numberParam = (v: unknown, fallback: number) =>
  v === undefined || v === null || v === '' ? fallback : Number(v)

const makeRng = (seed: unknown) => {
  const n = Math.trunc(numberParam(seed, 0))
  return mulberry32(Number.isFinite(n) && n !== 0 ? n : randomSeed())
}

const isLetter = (ch: string) => /\p{L}/u.test(ch)

const util: Utility = {
  id: 'random_case',
  name: 'random case',
  category: 'Formatting',
  description:
    'Randomly upper- or lowercase each letter at the given probability, with an optional non-zero seed for reproducible output.',
  accepts: 'string',
  produces: 'string',
  tags: ['sarcasm case', 'random capitalization', 'chaos case', 'coin flip case'],
  examples: [{ title: 'seeded', input: 'hello world', params: { seed: 1, probability: 0.5 }, output: 'hEllo WorLd' }],
  params: {
    probability: { kind: 'range', label: 'uppercase probability', default: 0.5, min: 0, max: 1, step: 0.05 },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (input: any, { probability, seed }: any) => {
    const s = String(input)
    if (s === '') return '' // empty input never throws, whatever the params say
    const p = numberParam(probability, 0.5)
    if (!Number.isFinite(p) || p < 0 || p > 1) {
      throw new Error('probability must be a number between 0 and 1')
    }
    const rng = makeRng(seed)
    // Code-point iteration keeps astral characters intact; only letters consume randomness.
    return Array.from(s)
      .map(ch => (isLetter(ch) ? (rng() < p ? ch.toUpperCase() : ch.toLowerCase()) : ch))
      .join('')
  }
}

export default util
