/**
 * Case- and diacritic-insensitive fuzzy subsequence matching for the utility
 * picker and the command palette. No dependency: a small VS Code / fzy-style
 * scorer, O(query.length * text.length) per candidate, with each candidate's
 * folded text cached so a keystroke over ~250 utilities stays in the low ms.
 */
import type { UtilityMeta } from '@/core/registry'

export interface FuzzyRange { start: number; end: number }
export interface FuzzyMatch { score: number; ranges: FuzzyRange[] }

const DIACRITICS = /[\u0300-\u036f]/g
const COMBINING = /[\u0300-\u036f]/
const ALNUM = /[\p{L}\p{N}]/u
const UPPER = /\p{Lu}/u
const LOWER_OR_DIGIT = /[\p{Ll}\p{N}]/u

const SCORE_MATCH = 1
const BONUS_BOUNDARY = 8
const BONUS_CONSECUTIVE = 6
const BONUS_PREFIX = 5
/** Taken off every match that does not directly follow the previous one (never below zero). */
const PENALTY_GAP = 3
/** The (single-word) query is the whole field, e.g. the alias "btoa". */
const BONUS_EXACT = 10

const NONE = -1e9

/**
 * One UTF-16 unit, lowercased; a precomposed letter whose NFD form is a single
 * base plus diacritics ("é" → "e") becomes that base. Anything NFD splits into
 * several base characters (a Hangul syllable into jamo) is kept whole.
 */
function foldChar(ch: string): string {
  const nfd = ch.normalize('NFD')
  const stripped = nfd.length > 1 ? nfd.replace(DIACRITICS, '') : nfd
  const base = stripped.length === 1 ? stripped : ch
  const lower = base.toLowerCase()
  return lower.length === 1 ? lower : base
}

/** Lowercase, diacritic-stripped copy of `text` with the same length (index-aligned). */
function fold(text: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(text)) return text.toLowerCase()
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    out += ch.charCodeAt(0) < 128 ? ch.toLowerCase() : foldChar(ch)
  }
  return out
}

/**
 * Folds a query the way `fold` folds a candidate, but composes it first and drops
 * leftover combining marks: a decomposed "e" + U+0301 must match "é" and "e".
 * (Queries are never highlighted, so they need not stay index-aligned.)
 */
function foldQuery(query: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7f]*$/.test(query)) return query.toLowerCase()
  let out = ''
  for (const ch of query.normalize('NFC')) {
    for (let i = 0; i < ch.length; i++) {
      if (!COMBINING.test(ch[i])) out += ch.charCodeAt(i) < 128 ? ch[i].toLowerCase() : foldChar(ch[i])
    }
  }
  return out
}

interface Prepared { folded: string; boundary: Uint8Array }

// Candidate texts (names, aliases, tags, descriptions) are static, so fold them once.
const prepared = new Map<string, Prepared>()
const MAX_PREPARED = 8000

function prepare(text: string): Prepared {
  let p = prepared.get(text)
  if (p) return p
  const boundary = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    if (i === 0) { boundary[i] = 1; continue }
    const code = text.charCodeAt(i)
    if (code >= 0xdc00 && code <= 0xdfff) continue // low surrogate: never a word start
    const prev = text[i - 1]
    if (!ALNUM.test(prev)) boundary[i] = 1
    else if (UPPER.test(text[i]) && LOWER_OR_DIGIT.test(prev)) boundary[i] = 1
  }
  p = { folded: fold(text), boundary }
  if (prepared.size >= MAX_PREPARED) prepared.clear()
  prepared.set(text, p)
  return p
}

/** Cheap linear pre-check: is `q` a subsequence of `t` at all? */
function isSubsequence(q: string, t: string): boolean {
  let j = 0
  for (let i = 0; i < q.length; i++) {
    j = t.indexOf(q[i], j)
    if (j < 0) return false
    j++
  }
  return true
}

// Reused DP buffers: one search runs thousands of small matches per keystroke.
let bufD = new Int32Array(1024)
let bufM = new Int32Array(1024)

/**
 * Score one whitespace-free, already-folded token against a prepared text.
 * `positions` (the matched indices) is only computed when `withPositions`.
 */
function scoreToken(q: string, p: Prepared, withPositions: boolean): { score: number; positions: number[] } | null {
  const t = p.folded
  const n = q.length
  const m = t.length
  if (n === 0 || n > m || !isSubsequence(q, t)) return null

  const w = m + 1
  const size = (n + 1) * w
  if (bufD.length < size) { bufD = new Int32Array(size * 2); bufM = new Int32Array(size * 2) }
  // D[i*w+j]: best score of q[0..i) with q[i-1] matched exactly at t[j-1].
  // M[i*w+j]: best score of q[0..i) matched anywhere within t[0..j).
  const D = bufD
  const M = bufM
  D.fill(NONE, 0, size)
  M.fill(NONE, w, size)
  M.fill(0, 0, w)

  const boundary = p.boundary
  for (let i = 1; i <= n; i++) {
    const qc = q[i - 1]
    const row = i * w
    const prevRow = row - w
    for (let j = 1; j <= m; j++) {
      let d = NONE
      if (qc === t[j - 1]) {
        const b = SCORE_MATCH + (boundary[j - 1] ? BONUS_BOUNDARY : 0) + (i === 1 && j === 1 ? BONUS_PREFIX : 0)
        const prevM = M[prevRow + j - 1]
        const prevD = D[prevRow + j - 1]
        if (prevM !== NONE) d = prevM + (i === 1 ? b : Math.max(0, b - PENALTY_GAP))
        if (prevD !== NONE && prevD + b + BONUS_CONSECUTIVE > d) d = prevD + b + BONUS_CONSECUTIVE
      }
      D[row + j] = d
      M[row + j] = d > M[row + j - 1] ? d : M[row + j - 1]
    }
  }

  const best = M[n * w + m]
  if (best === NONE) return null
  const score = best + (n === m ? BONUS_EXACT : 0)
  if (!withPositions) return { score, positions: [] }

  // Backtrack along the path that produced `best`, so the highlighted characters
  // are exactly the ones that were scored (a consecutive run stays one run).
  const positions = new Array<number>(n)
  let target = best
  let forced = false
  let j = m
  for (let i = n; i >= 1; i--) {
    if (!forced) while (D[i * w + j] !== target) j--
    positions[i - 1] = j - 1
    if (i === 1) break
    const b = SCORE_MATCH + (boundary[j - 1] ? BONUS_BOUNDARY : 0)
    const prevD = D[(i - 1) * w + j - 1]
    if (prevD !== NONE && prevD + b + BONUS_CONSECUTIVE === D[i * w + j]) { target = prevD; forced = true }
    else { target = M[(i - 1) * w + j - 1]; forced = false }
    j--
  }
  return { score, positions }
}

/**
 * Merge sorted, possibly duplicated positions into ranges, never splitting a
 * surrogate pair or a letter from the combining marks that follow it.
 */
function toRanges(text: string, positions: number[]): FuzzyRange[] {
  const sorted = [...new Set(positions)].sort((a, b) => a - b)
  const ranges: FuzzyRange[] = []
  for (const idx of sorted) {
    let start = idx
    let end = idx + 1
    const code = text.charCodeAt(idx)
    if (code >= 0xdc00 && code <= 0xdfff && idx > 0) start = idx - 1
    if (code >= 0xd800 && code <= 0xdbff && idx + 1 < text.length) end = idx + 2
    while (end < text.length && COMBINING.test(text[end])) end++
    const last = ranges[ranges.length - 1]
    if (last && start <= last.end) last.end = Math.max(last.end, end)
    else ranges.push({ start, end })
  }
  return ranges
}

function tokenize(query: string): string[] {
  return foldQuery(query).split(/\s+/).filter(Boolean)
}

function matchTokens(tokens: string[], text: string, withRanges: boolean): FuzzyMatch | null {
  if (!tokens.length || !text) return null
  const p = prepare(text)
  let score = 0
  const positions: number[] = []
  for (const token of tokens) {
    const hit = scoreToken(token, p, withRanges)
    if (!hit) return null
    score += hit.score
    if (withRanges) positions.push(...hit.positions)
  }
  return { score, ranges: withRanges ? toRanges(text, positions) : [] }
}

/**
 * Best-scoring match of `query` in `text`, or null when it does not match.
 * Each whitespace-separated word of the query must be a subsequence of `text`
 * (in any order: "encode base64" finds "base64 encode"); the score is their sum.
 * `ranges` are index ranges into `text` (not folded) for `<mark>` highlighting.
 */
export function fuzzyScore(query: string, text: string): FuzzyMatch | null {
  return matchTokens(tokenize(query), text, true)
}

// ---------------------------------------------------------------------------
// Utility search
// ---------------------------------------------------------------------------

export interface UtilitySearchResult {
  meta: UtilityMeta
  score: number
  /** Match ranges within `meta.name`, for highlighting — empty unless the name itself matched. */
  nameRanges: FuzzyRange[]
}

// Kept close together on purpose: a clean alias/tag hit ("btoa") must beat a
// scattered name hit ("b…t…o…a" across "byte order mark").
const WEIGHT_NAME = 10
const WEIGHT_ALIAS = 8
const WEIGHT_TAG = 7
const WEIGHT_ID = 6
const WEIGHT_DESCRIPTION = 4

/**
 * Ranks `metas` against `query` across name (highest weight), aliases, tags, id
 * and description (lowest weight). An empty query returns `metas` in their
 * given order, unranked — the caller's natural (e.g. category) order.
 */
export function searchUtilities(query: string, metas: UtilityMeta[]): UtilitySearchResult[] {
  const tokens = tokenize(query)
  if (!tokens.length) return metas.map(meta => ({ meta, score: 0, nameRanges: [] }))

  const results: UtilitySearchResult[] = []
  const consider = (best: number, text: string, weight: number) => {
    const m = matchTokens(tokens, text, false)
    return m ? Math.max(best, m.score * weight) : best
  }
  for (const meta of metas) {
    let best = -Infinity
    let nameRanges: FuzzyRange[] = []

    const nameMatch = matchTokens(tokens, meta.name, true)
    if (nameMatch) { best = nameMatch.score * WEIGHT_NAME; nameRanges = nameMatch.ranges }
    for (const alias of meta.aliases) best = consider(best, alias, WEIGHT_ALIAS)
    for (const tag of meta.tags) best = consider(best, tag, WEIGHT_TAG)
    best = consider(best, meta.id, WEIGHT_ID)
    if (meta.description) best = consider(best, meta.description, WEIGHT_DESCRIPTION)

    if (best > -Infinity) results.push({ meta, score: best, nameRanges })
  }

  // ties: the shorter (closer) name first, then alphabetical
  results.sort((a, b) =>
    b.score - a.score || a.meta.name.length - b.meta.name.length || a.meta.name.localeCompare(b.meta.name))
  return results
}
