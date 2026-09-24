/**
 * "Magic" auto-detect: guesses what the input is (via the `detect_format` utility)
 * and proposes single-step decoders for it, validating each candidate by actually
 * running it. Framework-free, like the rest of `core/` — usable from the app, tests,
 * or any future CLI/worker host, given a `load(id)` function (see `runner.ts`).
 */
import type { Utility, Value } from '../types/utility'
import { formatForDisplay, isBytes, isEmptyValue, valueType } from './coerce'
import { runPipeline } from './runner'

export type LoadFn = (id: string) => Promise<Utility> | Utility

/** A decoding step ready to hand to the `ADD_STEP` / `INSERT_STEPS` pipeline actions. */
export interface DecodeStep {
  utilityId: string
  params?: Record<string, unknown>
}

interface Candidate extends DecodeStep {
  label: string
  /** Formats rather than decodes further — only ever taken as the last step of a chain. */
  pretty?: boolean
}

export interface Suggestion {
  step: DecodeStep
  label: string
  /** The triggering detection's confidence (0–1), from `detect_format`. */
  confidence: number
  /** First 200 characters of the decoded value, as `formatForDisplay` renders it. */
  preview: string
}

export interface AutoDecodeResult {
  steps: DecodeStep[]
  value: Value
}

interface Detection { format: string; confidence: number; note: string }

interface Validated { candidate: Candidate; confidence: number; decoded: Value }

/**
 * `detect_format`'s format name -> the step(s) that would undo it. Keys must match
 * that utility's `format` strings exactly (see `src/utilities/detect_format/index.ts`).
 * A few entries (HTML entities, unicode escapes, quoted-printable) have no detector
 * there yet and are kept ready for when one is added — they simply never match today.
 */
const FORMAT_DECODERS: Record<string, Candidate[]> = {
  base64: [{ utilityId: 'base64_decode', label: 'base64 decode' }],
  base64url: [{ utilityId: 'base64url_decode', label: 'base64url decode' }],
  hex: [{ utilityId: 'hex_decode', label: 'hex decode' }],
  base32: [{ utilityId: 'base32_decode', label: 'base32 decode' }],
  'URL-encoded': [{ utilityId: 'url_decode', label: 'URL decode' }],
  JWT: [{ utilityId: 'jwt_decode', label: 'JWT decode', pretty: true }],
  gzip: [{ utilityId: 'gzip_decompress', label: 'gzip decompress' }],
  zlib: [{ utilityId: 'deflate_decompress', label: 'deflate decompress' }],
  JSON: [{ utilityId: 'json_pretty', label: 'JSON pretty-print', pretty: true }],
  JSON5: [{ utilityId: 'json_pretty', label: 'JSON pretty-print', pretty: true }],
  YAML: [{ utilityId: 'yaml_to_json', label: 'YAML to JSON', pretty: true }],
  XML: [{ utilityId: 'xml_pretty', label: 'XML pretty-print', pretty: true }],
  CSV: [{ utilityId: 'csv_to_json', label: 'CSV to JSON', pretty: true }],
  TSV: [{ utilityId: 'csv_to_json', label: 'CSV to JSON', params: { delimiter: 'tab' }, pretty: true }],
  'data URI': [{ utilityId: 'data_uri_parse', label: 'data URI parse', pretty: true }],
  'unix timestamp (seconds)': [
    { utilityId: 'timestamp_convert', label: 'timestamp to ISO', params: { to: 'iso' }, pretty: true },
  ],
  'unix timestamp (milliseconds)': [
    { utilityId: 'timestamp_convert', label: 'timestamp to ISO', params: { to: 'iso' }, pretty: true },
  ],
  'Morse code': [{ utilityId: 'morse_decode', label: 'morse decode' }],
  binary: [{ utilityId: 'binary_decode', label: 'binary decode' }],
  ROT13: [{ utilityId: 'rot13', label: 'ROT13 decode' }],
  'HTML entities': [{ utilityId: 'html_entity_decode', label: 'HTML entity decode' }],
  'Unicode escapes': [{ utilityId: 'unicode_escape_decode', label: 'unicode unescape' }],
  'quoted-printable': [{ utilityId: 'quoted_printable_decode', label: 'quoted-printable decode' }],
}

/** utilityIds that only reformat — see the `pretty` note on `FORMAT_DECODERS`. */
const PRETTY_IDS = new Set(
  Object.values(FORMAT_DECODERS).flat().filter(c => c.pretty).map(c => c.utilityId)
)

/**
 * `autoDecode` never chains a guess below this confidence: all-digit "hex" scores 0.4
 * and would turn `12345678` into control bytes. Such guesses are still *suggested*.
 */
export const MIN_AUTO_CONFIDENCE = 0.45

const PREVIEW_CHARS = 200
const PROBE_ID = '__magic_probe__'

const decodersFor = (format: string): Candidate[] =>
  Object.prototype.hasOwnProperty.call(FORMAT_DECODERS, format) ? FORMAT_DECODERS[format] : []

/** Value equality without `formatForDisplay`, which expands every byte (seconds for MBs). */
function sameValue(a: Value, b: Value): boolean {
  const ta = valueType(a)
  const tb = valueType(b)
  if (ta === 'bytes' || tb === 'bytes') {
    if (ta !== tb) return false
    const x = a as Uint8Array
    const y = b as Uint8Array
    if (x.length !== y.length) return false
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false
    return true
  }
  if (ta === 'string' && tb === 'string') return a === b
  return formatForDisplay(a) === formatForDisplay(b)
}

/** Identity of a value for the cycle guard (cheap for bytes, unlike `formatForDisplay`). */
function valueKey(v: Value): string {
  if (isBytes(v)) {
    let s = 'b:'
    for (let i = 0; i < v.length; i += 0x8000) s += String.fromCharCode(...v.subarray(i, i + 0x8000))
    return s
  }
  if (typeof v === 'string') return `s:${v}`
  try { return `j:${JSON.stringify(v)}` } catch { return `j:${String(v)}` }
}

/** `formatForDisplay(v).slice(0, 200)`, formatting only the head of a large string/bytes value. */
function previewOf(v: Value): string {
  const head = isBytes(v) ? v.subarray(0, PREVIEW_CHARS) : typeof v === 'string' ? v.slice(0, PREVIEW_CHARS) : v
  return formatForDisplay(head).slice(0, PREVIEW_CHARS)
}

/** Runs one candidate as a single-step pipeline. Null on error or a no-op result. */
async function tryDecode(value: Value, candidate: DecodeStep, load: LoadFn, signal?: AbortSignal): Promise<Value | null> {
  let result
  try {
    result = await runPipeline(
      value,
      [{ id: PROBE_ID, utilityId: candidate.utilityId, params: candidate.params, enabled: true }],
      { load, signal }
    )
  } catch {
    return null
  }
  if (result.err[PROBE_ID] || result.skipped[PROBE_ID] || result.aborted) return null
  if (sameValue(result.out, value)) return null
  return result.out
}

/** `detect_format`'s detections, most confident first. Empty on any failure. */
async function detect(value: Value, load: LoadFn): Promise<Detection[]> {
  try {
    const detectFormat = await load('detect_format')
    const raw: unknown = await detectFormat.apply(value, {})
    if (!Array.isArray(raw)) return []
    return (raw as Detection[])
      .filter(d => !!d && typeof d.format === 'string' && Number.isFinite(d.confidence))
      .sort((a, b) => b.confidence - a.confidence)
  } catch {
    return []
  }
}

/** Candidates that actually decode `value`, most confident first, validated lazily. */
async function* validated(value: Value, load: LoadFn, signal?: AbortSignal): AsyncGenerator<Validated> {
  if (isEmptyValue(value)) return
  const detections = await detect(value, load)
  const tried = new Set<string>()
  for (const d of detections) {
    for (const c of decodersFor(d.format)) {
      if (signal?.aborted) return
      const key = `${c.utilityId}:${JSON.stringify(c.params ?? null)}`
      if (tried.has(key)) continue
      tried.add(key)
      const decoded = await tryDecode(value, c, load, signal)
      if (decoded !== null) yield { candidate: c, confidence: d.confidence, decoded }
    }
  }
}

const stepOf = (c: Candidate): DecodeStep => ({ utilityId: c.utilityId, params: c.params })

/**
 * Guesses `value`'s encoding and proposes decoders for it, keeping only candidates
 * that actually run without error and change the value. Ranked by the triggering
 * detection's confidence. Never throws — a missing utility or a detector failure
 * just yields fewer (or no) suggestions.
 */
export async function suggestDecoders(
  value: Value,
  opts: { load: LoadFn; limit?: number; signal?: AbortSignal }
): Promise<Suggestion[]> {
  const limit = opts.limit ?? 5
  const out: Suggestion[] = []
  if (limit <= 0) return out
  for await (const v of validated(value, opts.load, opts.signal)) {
    out.push({ step: stepOf(v.candidate), label: v.candidate.label, confidence: v.confidence, preview: previewOf(v.decoded) })
    if (out.length >= limit) break
  }
  return out
}

/**
 * The step `autoDecode` takes next: the most confident validated candidate (a
 * non-pretty one wins a tie), or null when nothing clears `minConfidence`.
 */
async function bestNext(value: Value, load: LoadFn, minConfidence: number, signal?: AbortSignal): Promise<Validated | null> {
  let best: Validated | null = null
  for await (const v of validated(value, load, signal)) {
    if (v.confidence < minConfidence) break
    if (!best) {
      best = v
      if (!v.candidate.pretty) break
      continue
    }
    if (v.confidence < best.confidence) break
    if (!v.candidate.pretty) { best = v; break }
  }
  return best
}

/**
 * Repeatedly applies the most confident validated decoder until nothing more applies
 * (with at least `minConfidence`), the value cycles back to one already seen, or
 * `maxDepth` is reached. A pretty-printer (json/xml/yaml/csv/…) is only ever taken as
 * the chain's last step — and only when it is the most confident reading, so a
 * low-confidence decoder never mangles confidently detected JSON or a timestamp.
 */
export async function autoDecode(
  value: Value,
  opts: { load: LoadFn; maxDepth?: number; minConfidence?: number; signal?: AbortSignal }
): Promise<AutoDecodeResult> {
  const maxDepth = opts.maxDepth ?? 8
  const minConfidence = opts.minConfidence ?? MIN_AUTO_CONFIDENCE
  const steps: DecodeStep[] = []
  let current = value
  const seen = new Set<string>([valueKey(current)])

  for (let depth = 0; depth < maxDepth; depth++) {
    if (opts.signal?.aborted || isEmptyValue(current)) break
    const next = await bestNext(current, opts.load, minConfidence, opts.signal)
    if (!next) break

    const key = valueKey(next.decoded)
    if (seen.has(key)) break // cycle: this value has already been visited
    seen.add(key)

    steps.push(stepOf(next.candidate))
    current = next.decoded
    if (next.candidate.pretty) break
  }

  return { steps, value: current }
}

export { FORMAT_DECODERS, PRETTY_IDS }
