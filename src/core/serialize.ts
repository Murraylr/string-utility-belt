// lz-string is CommonJS (`module.exports = LZString`): Node's ESM loader cannot see
// named exports on it, so take the default and destructure.
import LZString from 'lz-string'
import type {
  Condition, ErrorPolicy, MergeSpec, PipelineDoc, PipelineStep, SplitSpec, ValueType,
} from '../types/utility'
import { isEachStep, someStep, stepId } from './steps'
import { decompressUriSafe } from './lzBounded'
import { MAX_SEPARATOR_LENGTH } from './split'

/**
 * Newest pipeline schema this build reads. v3 adds "run on each" steps to v2; a
 * document is written with the oldest version that can read it (`schemaVersionFor`),
 * so a pipeline without them still opens in builds that only know v2.
 */
export const SCHEMA_VERSION = 3 as const

/** The oldest schema that can read `steps`: 3 once any step, nested or disabled, is a "run on each" step. */
export function schemaVersionFor(steps: PipelineStep[]): PipelineDoc['v'] {
  return someStep(steps, isEachStep) ? 3 : 2
}

/** Anything larger is refused: a share link is not a file-transfer mechanism. */
export const MAX_STEPS = 500
const MAX_DEPTH = 8

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 200): string | undefined =>
  typeof v === 'string' ? v.slice(0, max) : typeof v === 'number' ? String(v) : undefined

const VALUE_TYPES: ValueType[] = ['string', 'bytes', 'json']
const POLICIES: ErrorPolicy[] = ['passthrough', 'stop', 'empty']

function sanitizeCondition(raw: unknown): Condition | undefined {
  if (!isObj(raw)) return undefined
  const negate = raw.negate === true ? { negate: true } : {}
  switch (raw.kind) {
    case 'nonEmpty': return { kind: 'nonEmpty', ...negate }
    case 'regex': {
      const pattern = str(raw.pattern, 2000)
      if (pattern === undefined) return undefined
      return { kind: 'regex', pattern, flags: str(raw.flags, 10) ?? '', ...negate }
    }
    case 'type':
      return VALUE_TYPES.includes(raw.type as ValueType) ? { kind: 'type', type: raw.type as ValueType, ...negate } : undefined
    default: return undefined
  }
}

function sanitizeMerge(raw: unknown): MergeSpec {
  if (!isObj(raw)) return { mode: 'concat', separator: '\n' }
  switch (raw.mode) {
    case 'zip': return { mode: 'zip', separator: str(raw.separator, 50) ?? '\n' }
    case 'json': return { mode: 'json' }
    case 'pick': return { mode: 'pick', index: Number.isInteger(raw.index) ? (raw.index as number) : 0 }
    default: return { mode: 'concat', separator: str(raw.separator, 50) ?? '\n' }
  }
}

/**
 * A split is never guessed: an unknown mode, or a separator that is missing, empty or
 * too long (truncating it would change what it splits on), makes the step unreadable.
 */
function sanitizeSplit(raw: unknown): SplitSpec | undefined {
  if (!isObj(raw)) return undefined
  switch (raw.mode) {
    case 'lines': return { mode: 'lines' }
    case 'delimiter': {
      const { separator } = raw
      if (typeof separator !== 'string' || !separator || separator.length > MAX_SEPARATOR_LENGTH) return undefined
      return { mode: 'delimiter', separator }
    }
    case 'json-array': return { mode: 'json-array' }
    case 'json-values': return { mode: 'json-values' }
    default: return undefined
  }
}

/** Params are plain JSON data; anything else (functions, prototypes) is dropped. */
function sanitizeParams(raw: unknown): Record<string, unknown> {
  if (!isObj(raw)) return {}
  try {
    const clean = JSON.parse(JSON.stringify(raw))
    const out: Record<string, unknown> = Object.create(null)
    for (const [k, v] of Object.entries(clean)) {
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
      out[k] = v
    }
    return { ...out }
  } catch { return {} }
}

/**
 * Turn untrusted data (a share link, an imported file, old localStorage) into
 * well-formed steps. Entries that cannot be repaired are dropped; missing ids are
 * minted; duplicate ids are re-minted so updates by id stay unambiguous, and so are
 * ids naming an Object.prototype member (`constructor`, `__proto__`…): results are
 * plain objects keyed by step id, where such an id would read an inherited value.
 */
export function sanitizeSteps(raw: unknown, depth = 0, seen: Set<string> = new Set()): PipelineStep[] {
  if (!Array.isArray(raw) || depth > MAX_DEPTH) return []
  const out: PipelineStep[] = []
  for (const item of raw.slice(0, MAX_STEPS)) {
    if (!isObj(item)) continue
    let id = str(item.id, 100) || stepId()
    if (seen.has(id) || id in Object.prototype) id = stepId()
    seen.add(id)
    const base: Record<string, unknown> = { id }
    if (item.enabled === false) base.enabled = false; else base.enabled = true
    const label = str(item.label, 120); if (label) base.label = label
    const condition = sanitizeCondition(item.condition); if (condition) base.condition = condition
    if (POLICIES.includes(item.onError as ErrorPolicy)) base.onError = item.onError
    if (item.type === 'branch') {
      const branches = Array.isArray(item.branches) ? item.branches.slice(0, 16) : []
      out.push({ ...base, type: 'branch', branches: branches.map(b => sanitizeSteps(b, depth + 1, seen)), merge: sanitizeMerge(item.merge) } as PipelineStep)
    } else if (item.type === 'macro') {
      out.push({ ...base, type: 'macro', name: str(item.name, 120) || 'macro', steps: sanitizeSteps(item.steps, depth + 1, seen), ...(str(item.macroId, 100) ? { macroId: str(item.macroId, 100) } : {}) } as PipelineStep)
    } else if (item.type === 'each') {
      const split = sanitizeSplit(item.split)
      if (!split || !Array.isArray(item.steps)) continue
      out.push({ ...base, type: 'each', split, skipEmpty: item.skipEmpty !== false, steps: sanitizeSteps(item.steps, depth + 1, seen) } as PipelineStep)
    } else if (item.type !== undefined && item.type !== 'utility') {
      // a step type from a newer build: dropping it beats running its fields as a utility step
      continue
    } else {
      const utilityId = str(item.utilityId, 100)
      if (!utilityId) continue
      out.push({ ...base, utilityId, params: sanitizeParams(item.params) } as PipelineStep)
    }
  }
  return out
}

/**
 * Accept every shape a pipeline has ever been stored in and return the current schema:
 * - v2 and v3 docs (`{ v: 2, steps, … }`)
 * - v1 localStorage state (`{ steps, showPreviews }`, no version)
 * - a bare array of steps (early export files)
 */
export function migratePipeline(raw: unknown): PipelineDoc {
  if (Array.isArray(raw)) {
    const steps = sanitizeSteps(raw)
    return { v: schemaVersionFor(steps), steps }
  }
  if (!isObj(raw)) return { v: 2, steps: [] }
  const steps = sanitizeSteps(raw.steps)
  const doc: PipelineDoc = { v: schemaVersionFor(steps), steps }
  const name = str(raw.name, 120); if (name) doc.name = name
  const description = str(raw.description, 1000); if (description) doc.description = description
  if (typeof raw.input === 'string') doc.input = raw.input
  return doc
}

/** Compact, URL-safe encoding of a pipeline (lz-string, then URI-safe alphabet). */
export function encodeShare(doc: PipelineDoc): string {
  const payload: PipelineDoc = { v: schemaVersionFor(doc.steps), steps: doc.steps }
  if (doc.name) payload.name = doc.name
  if (doc.description) payload.description = doc.description
  if (doc.input !== undefined) payload.input = doc.input
  return LZString.compressToEncodedURIComponent(JSON.stringify(payload))
}

/**
 * Largest decompressed share payload accepted, in characters. Generous for real
 * pipelines (and a shared input), far below what would stall or exhaust a tab.
 */
export const MAX_SHARE_CHARS = 2_000_000

/**
 * Inverse of `encodeShare`. Throws a readable error for anything that is not a
 * pipeline, and for payloads that would expand past `maxChars` (links are untrusted).
 */
export function decodeShare(encoded: string, maxChars: number = MAX_SHARE_CHARS): PipelineDoc {
  // throws ShareTooLargeError (readable message; typed so an API can answer 413)
  const json = decompressUriSafe(String(encoded || '').trim(), maxChars)
  if (!json) throw new Error('This link does not contain a pipeline (it may have been cut off).')
  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { throw new Error('This link is corrupted.') }
  if (isObj(parsed) && typeof parsed.v === 'number' && parsed.v > SCHEMA_VERSION) {
    throw new Error(`This pipeline was made with a newer version (v${parsed.v}). Reload to update.`)
  }
  return migratePipeline(parsed)
}

/** Hash routes that carry a pipeline. */
export const shareHash = (encoded: string, mode: 'tool' | 'embed' = 'tool') =>
  `#/${mode === 'embed' ? 'embed' : 'p'}/${encoded}`
