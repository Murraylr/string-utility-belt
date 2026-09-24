import type { Utility } from '@/types/utility'

const ALGORITHMS = [
  'levenshtein',
  'damerau-levenshtein',
  'hamming',
  'jaro',
  'jaro-winkler',
  'dice',
  'jaccard',
  'lcs',
  'cosine'
] as const
type Algorithm = (typeof ALGORITHMS)[number]

const asBool = (value: unknown, fallback: boolean) =>
  value === undefined || value === null || value === '' ? fallback : !!value

/** Code points, so astral characters (emoji) count as one unit. */
const codePoints = (text: string): string[] => Array.from(text)

/** Round to 6 decimals, normalising -0 (which `Math.round` happily produces) to 0. */
const round6 = (n: number) => {
  const r = Math.round(n * 1e6) / 1e6
  return r === 0 ? 0 : r
}

/**
 * Coefficient-based algorithms are computed in floating point, so an "identical"
 * pair can come out as 1.0000000000000002 (e.g. cosine of 'aa a' with itself is
 * 3 / (Math.sqrt(3) * Math.sqrt(3))). Left alone that becomes a negative distance.
 */
const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n)

/* ------------------------------------------------------------------ *
 * Edit distances
 * ------------------------------------------------------------------ */

function levenshtein(a: string[], b: string[]): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[b.length]
}

/**
 * Optimal string alignment (the common "Damerau-Levenshtein" of string
 * libraries): substitutions, insertions, deletions and transpositions of two
 * adjacent characters, where no substring is edited more than once.
 */
function damerauLevenshtein(a: string[], b: string[]): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  // Three rolling rows rather than the full matrix: the transposition rule only
  // ever looks two rows back, and a full matrix for two 5k-character inputs is
  // 25M cells — enough to take the tab down on every keystroke.
  const width = b.length + 1
  let twoBack = new Array<number>(width).fill(0)
  let oneBack = new Array<number>(width)
  let current = new Array<number>(width).fill(0)
  for (let j = 0; j < width; j++) oneBack[j] = j
  for (let i = 1; i <= a.length; i++) {
    current[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let best = Math.min(current[j - 1] + 1, oneBack[j] + 1, oneBack[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, twoBack[j - 2] + 1)
      }
      current[j] = best
    }
    const spare = twoBack
    twoBack = oneBack
    oneBack = current
    current = spare
  }
  return oneBack[b.length]
}

function hamming(a: string[], b: string[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `hamming distance needs equal-length strings (${a.length} vs ${b.length} code points)`
    )
  }
  let distance = 0
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) distance++
  return distance
}

/** Length of the longest common subsequence. */
function lcsLength(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  let prev = new Array<number>(b.length + 1).fill(0)
  let curr = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = 0
    for (let j = 1; j <= b.length; j++) {
      curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1])
    }
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[b.length]
}

/* ------------------------------------------------------------------ *
 * Similarity coefficients
 * ------------------------------------------------------------------ */

function jaro(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1)
  const aFlags = new Array<boolean>(a.length).fill(false)
  const bFlags = new Array<boolean>(b.length).fill(false)
  let matches = 0
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window)
    const end = Math.min(b.length - 1, i + window)
    for (let j = start; j <= end; j++) {
      if (bFlags[j] || a[i] !== b[j]) continue
      aFlags[i] = true
      bFlags[j] = true
      matches++
      break
    }
  }
  if (matches === 0) return 0
  let transpositions = 0
  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aFlags[i]) continue
    while (!bFlags[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }
  const t = transpositions / 2
  return (matches / a.length + matches / b.length + (matches - t) / matches) / 3
}

function jaroWinkler(a: string[], b: string[]): number {
  const base = jaro(a, b)
  // Standard Winkler boost: only applied to reasonably similar strings.
  if (base <= 0.7) return base
  let prefix = 0
  const max = Math.min(4, a.length, b.length)
  while (prefix < max && a[prefix] === b[prefix]) prefix++
  return base + prefix * 0.1 * (1 - base)
}

/**
 * Character bigrams (single code points when the string is shorter than two),
 * the tokenisation shared by the dice / jaccard / cosine coefficients.
 */
function bigrams(units: string[]): string[] {
  if (units.length === 0) return []
  if (units.length === 1) return [units[0]]
  const out: string[] = []
  for (let i = 0; i < units.length - 1; i++) out.push(units[i] + units[i + 1])
  return out
}

function counted(grams: string[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const gram of grams) map.set(gram, (map.get(gram) ?? 0) + 1)
  return map
}

/** Sørensen-Dice over bigram multisets. */
function dice(a: string[], b: string[]): number {
  const ga = bigrams(a)
  const gb = bigrams(b)
  if (ga.length === 0 && gb.length === 0) return 1
  if (ga.length === 0 || gb.length === 0) return 0
  const ca = counted(ga)
  const cb = counted(gb)
  let shared = 0
  for (const [gram, n] of ca) shared += Math.min(n, cb.get(gram) ?? 0)
  return (2 * shared) / (ga.length + gb.length)
}

/** Jaccard index over distinct bigrams. */
function jaccard(a: string[], b: string[]): number {
  const sa = new Set(bigrams(a))
  const sb = new Set(bigrams(b))
  if (sa.size === 0 && sb.size === 0) return 1
  if (sa.size === 0 || sb.size === 0) return 0
  let shared = 0
  for (const gram of sa) if (sb.has(gram)) shared++
  return shared / (sa.size + sb.size - shared)
}

/** Cosine similarity of bigram frequency vectors. */
function cosine(a: string[], b: string[]): number {
  const ca = counted(bigrams(a))
  const cb = counted(bigrams(b))
  if (ca.size === 0 && cb.size === 0) return 1
  if (ca.size === 0 || cb.size === 0) return 0
  let dot = 0
  for (const [gram, n] of ca) dot += n * (cb.get(gram) ?? 0)
  let na = 0
  for (const n of ca.values()) na += n * n
  let nb = 0
  for (const n of cb.values()) nb += n * n
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/* ------------------------------------------------------------------ *
 * Dispatch
 * ------------------------------------------------------------------ */

/** Raw distance plus the value it must be divided by to land in 0..1. */
function measure(algorithm: Algorithm, a: string[], b: string[]): { raw: number; scale: number } {
  switch (algorithm) {
    case 'levenshtein':
      return { raw: levenshtein(a, b), scale: Math.max(a.length, b.length) }
    case 'damerau-levenshtein':
      return { raw: damerauLevenshtein(a, b), scale: Math.max(a.length, b.length) }
    case 'hamming':
      return { raw: hamming(a, b), scale: a.length }
    case 'lcs': {
      const common = lcsLength(a, b)
      return { raw: a.length + b.length - 2 * common, scale: a.length + b.length }
    }
    case 'jaro':
      return { raw: 1 - jaro(a, b), scale: 1 }
    case 'jaro-winkler':
      return { raw: 1 - jaroWinkler(a, b), scale: 1 }
    case 'dice':
      return { raw: 1 - dice(a, b), scale: 1 }
    case 'jaccard':
      return { raw: 1 - jaccard(a, b), scale: 1 }
    case 'cosine':
      return { raw: 1 - cosine(a, b), scale: 1 }
    default:
      throw new Error(`unknown algorithm: ${algorithm}`)
  }
}

const util: Utility = {
  id: 'string_distance',
  name: 'string distance',
  category: 'Analysis',
  description:
    'Measure how far the input is from a second string using levenshtein, damerau-levenshtein, hamming, jaro, jaro-winkler, dice, jaccard, lcs, or cosine, optionally case-insensitively and normalized to 0..1.',
  accepts: 'string',
  produces: 'json',
  tags: ['levenshtein distance', 'fuzzy match', 'similarity score', 'edit distance', 'string similarity'],
  aliases: ['levenshtein'],
  examples: [
    {
      title: 'kitten vs sitting',
      input: 'kitten',
      params: { other: 'sitting', algorithm: 'levenshtein' },
      output: JSON.stringify({ algorithm: 'levenshtein', distance: 3, similarity: 0.571429, a: 'kitten', b: 'sitting' }, null, 2)
    }
  ],
  params: {
    other: { kind: 'string', label: 'other string', default: '', placeholder: 'compare against…' },
    algorithm: {
      kind: 'select',
      label: 'algorithm',
      options: [
        'levenshtein',
        'damerau-levenshtein',
        'hamming',
        'jaro',
        'jaro-winkler',
        'dice',
        'jaccard',
        'lcs',
        'cosine'
      ],
      default: 'levenshtein'
    },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: false },
    normalized: { kind: 'boolean', label: 'normalized distance (0-1)', default: false }
  },
  apply: (input: any, params: any) => {
    const rawAlgorithm = String(params?.algorithm ?? '') || 'levenshtein'
    if (!(ALGORITHMS as readonly string[]).includes(rawAlgorithm)) {
      throw new Error(`unknown algorithm: ${rawAlgorithm} (expected ${ALGORITHMS.join(', ')})`)
    }
    const algorithm = rawAlgorithm as Algorithm
    const ignoreCase = asBool(params?.ignoreCase, false)
    const normalized = asBool(params?.normalized, false)

    const a = String(input ?? '')
    const b = String(params?.other ?? '')
    const left = codePoints(ignoreCase ? a.toLowerCase() : a)
    const right = codePoints(ignoreCase ? b.toLowerCase() : b)

    const { raw, scale } = measure(algorithm, left, right)
    const ratio = scale === 0 ? 0 : clamp01(raw / scale)
    const similarity = round6(1 - ratio)
    const distance = normalized ? round6(ratio) : round6(Math.max(0, raw))

    return { algorithm, distance, similarity, a, b }
  }
}

export default util
