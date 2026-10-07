/**
 * POST /api/run — run a pipeline on the edge and return its output.
 *
 *   curl -s https://stringutilitybelt.com/api/run \
 *     -d '{"input":"hello","steps":["base64_encode"]}'
 *
 * Body: `{ input?, inputEncoding?: 'text'|'base64', steps | pipeline | share }` (exactly
 * one of the last three). Steps may be written as bare utility ids.
 *
 * Errors (JSON `{ error }`): 400 malformed body or out-of-range params (`invalidParams`) ·
 * 413 body over 1 MB, a share that expands past its ceiling, or an output over 8 Mi
 * characters/bytes (a single step past that ceiling fails like any other step) ·
 * 422 steps that cannot run on the edge (`unsupported`) · 504 over the time budget.
 * "Run on each" steps share one item budget per request (`maxEachItems`); a step
 * past it fails like any other step.
 */
import { isBytes, valueType } from '../src/core/coerce'
import { unsupportedSteps } from '../src/core/registry'
import { resolveParams } from '../src/core/params'
import { runPipeline, type RunResult } from '../src/core/runner'
import { SCHEMA_VERSION, migratePipeline, sanitizeSteps } from '../src/core/serialize'
import { countSteps, isUtilityStep, walkSteps } from '../src/core/steps'
import type { ParamSpec, Params, PipelineStep, Utility, Value } from '../src/types/utility'
import type { ApiRegistry } from './env'
import {
  TooLargeError, base64ToBytes, bytesToBase64, contentLength, json, jsonError, readCapped, untilAborted,
} from './http'
import { ShareTooLargeError, decodeShareBounded } from './share'

export interface RunDeps {
  registry: ApiRegistry
  maxBodyBytes: number
  maxSteps: number
  /** Ceiling on a decompressed `share` payload, in characters. */
  maxShareChars: number
  /** Ceiling on any step's output and on the final output (string length or byte length). */
  maxValueSize: number
  /** PBKDF2 work one request may ask for, in HMAC blocks (iterations × blocks per key). */
  pbkdf2Budget: number
  /** Items "run on each" steps may process in one request, nested ones included. */
  maxEachItems: number
  timeoutMs: number
  clock?: () => number
}

type Parsed = { steps: PipelineStep[]; input?: string } | { error: string; status?: number }

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const SOURCES = ['steps', 'pipeline', 'share'] as const
/** Mirror sanitizeSteps, which silently drops sequences nested deeper than this and lanes past this. */
const MAX_DEPTH = 8
const MAX_LANES = 16

/** `"trim"` is shorthand for `{ "utilityId": "trim" }`, at any nesting level. */
function expandShorthand(raw: unknown, depth = 0): unknown {
  if (!Array.isArray(raw) || depth > MAX_DEPTH) return raw
  return raw.map(item => {
    if (typeof item === 'string') return { utilityId: item }
    if (!isObj(item)) return item
    if (item.type === 'branch' && Array.isArray(item.branches)) {
      return { ...item, branches: item.branches.map(b => expandShorthand(b, depth + 1)) }
    }
    if (item.type === 'macro' || item.type === 'each') return { ...item, steps: expandShorthand(item.steps, depth + 1) }
    return item
  })
}

/**
 * Entries in an untrusted step tree, counted before sanitising (which silently drops
 * junk). Infinity when steps are nested deeper than sanitising would keep, NaN when a
 * branch has more lanes than it would keep.
 */
function rawCount(raw: unknown, depth = 0): number {
  if (!Array.isArray(raw)) return 0
  if (depth > MAX_DEPTH) return raw.length ? Infinity : 0
  let n = 0
  for (const item of raw) {
    n++
    if (!isObj(item)) continue
    if (item.type === 'branch' && Array.isArray(item.branches)) {
      if (item.branches.length > MAX_LANES) return NaN
      for (const b of item.branches) n += rawCount(b, depth + 1)
    } else if (item.type === 'macro' || item.type === 'each') {
      n += rawCount(item.steps, depth + 1)
    }
  }
  return n
}

function fromRawSteps(raw: unknown, maxSteps: number): Parsed {
  const expanded = expandShorthand(raw)
  const n = rawCount(expanded)
  if (Number.isNaN(n)) return { error: `a branch can have at most ${MAX_LANES} lanes` }
  if (n === Infinity) return { error: `steps are nested more than ${MAX_DEPTH} levels deep` }
  if (n > maxSteps) return { error: `too many steps: ${n} (the limit is ${maxSteps}, nested steps included)` }
  const steps = sanitizeSteps(expanded)
  const dropped = n - countSteps(steps)
  if (dropped > 0) {
    return {
      error: `${dropped} step${dropped > 1 ? 's' : ''} could not be read: each step needs a "utilityId" ` +
        '(or "type": "branch" with "branches", "type": "macro" with "steps", or "type": "each" with "steps" ' +
        'and a "split" of {"mode": "lines" | "json-array" | "json-values"} or {"mode": "delimiter", "separator": "…"})',
    }
  }
  return { steps }
}

/** The payload of a share link, or the link itself (`…#/p/<payload>` or `…#/embed/<payload>`). */
const sharePayload = (s: string) => s.trim().match(/#\/(?:p|embed)\/([^?#\s]+)/)?.[1] ?? s.trim()

function parsePipeline(body: Record<string, unknown>, maxSteps: number, maxShareChars: number): Parsed {
  const given = SOURCES.filter(k => body[k] !== undefined)
  if (given.length !== 1) {
    return { error: 'provide exactly one of "steps", "pipeline" or "share"' }
  }
  const [source] = given
  if (source === 'steps') {
    if (!Array.isArray(body.steps)) return { error: '"steps" must be an array' }
    return fromRawSteps(body.steps, maxSteps)
  }
  if (source === 'pipeline') {
    const p = body.pipeline
    if (Array.isArray(p)) return fromRawSteps(p, maxSteps)
    if (!isObj(p)) return { error: '"pipeline" must be a pipeline document ({ "v": 2, "steps": [...] })' }
    if (typeof p.v === 'number' && p.v > SCHEMA_VERSION) {
      return { error: `this pipeline uses schema v${p.v}; the API understands up to v${SCHEMA_VERSION}` }
    }
    if (!Array.isArray(p.steps)) return { error: '"pipeline.steps" must be an array' }
    const parsed = fromRawSteps(p.steps, maxSteps)
    if ('error' in parsed) return parsed
    const doc = migratePipeline({ ...p, steps: parsed.steps })
    return { steps: doc.steps, input: doc.input }
  }
  if (typeof body.share !== 'string') return { error: '"share" must be a share-link payload or URL' }
  try {
    const doc = decodeShareBounded(sharePayload(body.share), maxShareChars)
    const n = countSteps(doc.steps)
    if (n > maxSteps) return { error: `too many steps: ${n} (the limit is ${maxSteps}, nested steps included)` }
    return { steps: doc.steps, input: doc.input }
  } catch (e) {
    if (e instanceof ShareTooLargeError) return { error: e.message, status: 413 }
    return { error: (e as Error).message || 'invalid share link' }
  }
}

export interface InvalidParam { stepId: string; utilityId: string; param: string; error: string }

/**
 * A numeric param outside its declared range. Only the range is enforced: the runner
 * validates nothing, and declared maxima are what bound the costly params (iterations,
 * counts, sizes). Other rules stay advisory, as in the app, because utilities accept
 * legacy shapes (e.g. multi_replace's rules as text) that stricter checks would refuse.
 */
function outOfRange(spec: ParamSpec | undefined, value: unknown): string | null {
  if (!spec || (spec.kind !== 'number' && spec.kind !== 'range')) return null
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (spec.min !== undefined && n < spec.min) return `must be at least ${spec.min}`
  if (spec.max !== undefined && n > spec.max) return `must be at most ${spec.max}`
  return null
}

/**
 * WebCrypto PBKDF2 runs synchronously in workerd: while it works the isolate is blocked,
 * the timeout cannot fire and every other request on the isolate waits (1e8 iterations
 * held a local isolate for about two minutes). Declared maxima do not bound it (pbkdf2
 * declares none; aes_* allow 1e7, roughly ten seconds), a long key multiplies it, and a
 * pipeline may hold many such steps, so each request gets one budget of HMAC blocks.
 */
const HASH_BYTES: Record<string, number> = { 'SHA-1': 20, 'SHA-256': 32, 'SHA-384': 48, 'SHA-512': 64 }

/** HMAC blocks a step's PBKDF2 would compute (0 when it derives no key, or its params are unusable). */
function pbkdf2Blocks(utilityId: string, params: Params): number {
  const count = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0 }
  const iterations = count(params.iterations)
  // aes_*: PBKDF2-SHA256 into a key of at most 256 bits, a single block
  if (utilityId === 'aes_encrypt' || utilityId === 'aes_decrypt') return iterations
  if (utilityId !== 'pbkdf2') return 0
  const hashBytes = HASH_BYTES[String(params.algorithm ?? '').toUpperCase()] ?? 20 // unknown: assume the smallest
  return iterations * Math.ceil(count(params.keyLength) / hashBytes)
}

/**
 * Params of the steps that can run (not disabled, nor inside a disabled branch or macro)
 * that are outside their declared range, or that push the request's PBKDF2 work past
 * `pbkdf2Budget`.
 */
function invalidParams(steps: PipelineStep[], registry: ApiRegistry, pbkdf2Budget: number): InvalidParam[] {
  const out: InvalidParam[] = []
  let kdfWork = 0
  walkSteps(steps, (s, parents) => {
    if (!isUtilityStep(s) || s.enabled === false || parents.some(p => p.enabled === false)) return
    const specs = registry.get(s.utilityId)?.params ?? {}
    const before = out.length
    for (const [param, value] of Object.entries(s.params ?? {})) {
      const error = Object.hasOwn(specs, param) ? outOfRange(specs[param], value) : null
      if (error) out.push({ stepId: s.id, utilityId: s.utilityId, param, error })
    }
    if (out.length > before) return
    const blocks = pbkdf2Blocks(s.utilityId, resolveParams({ params: specs }, s.params ?? {}))
    kdfWork += blocks
    if (blocks && kdfWork > pbkdf2Budget) {
      out.push({
        stepId: s.id, utilityId: s.utilityId, param: 'iterations',
        error: `needs ${blocks} PBKDF2 blocks (iterations × key blocks), and the server allows ${pbkdf2Budget} per request`,
      })
    }
  })
  return out
}

/**
 * `input` defaults to the input a shared pipeline carries, else to the empty string.
 * `inputEncoding` describes `input` only: a pipeline's own input is always text.
 */
function parseInput(body: Record<string, unknown>, fallback: string | undefined): { value: Value } | { error: string } {
  const enc = body.inputEncoding ?? 'text'
  if (enc !== 'text' && enc !== 'base64') return { error: '"inputEncoding" must be "text" or "base64"' }
  const input = body.input
  if (input === undefined) return { value: fallback ?? '' }
  if (typeof input !== 'string') return { error: '"input" must be a string (use "inputEncoding": "base64" for bytes)' }
  if (enc === 'text') return { value: input }
  const bytes = base64ToBytes(input)
  return bytes ? { value: bytes } : { error: '"input" is not valid base64' }
}

/** String length or byte length; null for JSON values, which are parsed from bounded text. */
const sizeOf = (v: Value): number | null =>
  typeof v === 'string' ? v.length : isBytes(v) ? v.byteLength : null

/**
 * Input caps for utilities with superlinear worst cases (measured in the security
 * review): synchronous work blocks the isolate past the request's AbortController
 * timeout, so only an up-front cap keeps one request from stalling or OOM-ing it.
 * sql-formatter's memory is quadratic on runs of operator characters (~80 MB at 4k
 * '<'); marked's emphasis scan is quadratic on '*'/'_' runs (8.5 s at 32k); base58/62
 * are BigInt base conversions (O(n²)).
 */
/**
 * Output-size predictions for utilities whose output is a multiple of their input, so an
 * oversized result is refused before it is built rather than measured afterwards.
 */
const OUTPUT_ESTIMATES: Readonly<Record<string, (inSize: number, params: any) => number>> = {
  repeat: (inSize, { count, separator }) => {
    const n = Math.max(0, Math.floor(Number(count) || 0))
    return n * inSize + Math.max(0, n - 1) * String(separator ?? '').length
  },
}

export const INPUT_CAPS: Readonly<Record<string, number>> = {
  sql_format: 4_000,
  markdown_to_html: 20_000,
  base58_encode: 16_000,
  base58_decode: 16_000,
  base62_encode: 16_000,
  base62_decode: 16_000,
}

/** PBKDF2 blocks a request still may compute, shared by every step of the run. */
interface KdfBudget { left: number; total: number }

/**
 * The utility with its input capped (INPUT_CAPS) and its output checked against `max`. The body limit bounds the input,
 * but nothing bounds growth: a 1 MB input through seven doubling steps (hex_encode…)
 * passes the isolate's 128 MB and takes every in-flight request with it. An oversized
 * output becomes that step's error, so the runner drops it and applies the step's
 * error policy. The check runs after the step, except for the multipliers in
 * OUTPUT_ESTIMATES, which are refused up front so one huge repeat never allocates.
 *
 * PBKDF2 work is charged to `kdf` before each call: `invalidParams` checks every step
 * once, but a step inside a "run on each" runs once per item, and the work it blocks
 * the isolate for multiplies with them.
 */
function bounded(util: Utility, max: number, kdf: KdfBudget): Utility {
  const cap = Object.prototype.hasOwnProperty.call(INPUT_CAPS, util.id) ? INPUT_CAPS[util.id] : undefined
  return {
    ...util,
    async apply(input, params, ctx) {
      const inSize = sizeOf(input)
      if (cap !== undefined && inSize !== null && inSize > cap) {
        throw new Error(`${util.id} accepts at most ${cap} characters or bytes on this server (got ${inSize}); run it locally for larger inputs`)
      }
      const estimate = Object.prototype.hasOwnProperty.call(OUTPUT_ESTIMATES, util.id) && inSize !== null
        ? OUTPUT_ESTIMATES[util.id](inSize, params) : null
      const tooLarge = () => new Error(`the step's output is larger than the server's limit of ${max} characters or bytes`)
      if (estimate !== null && estimate > max) throw tooLarge()
      const blocks = pbkdf2Blocks(util.id, params)
      if (blocks) {
        if (blocks > kdf.left) {
          throw new Error(`this request has used its PBKDF2 budget of ${kdf.total} blocks (iterations × key blocks); run it locally for more`)
        }
        kdf.left -= blocks
      }
      const out = await util.apply(input, params, ctx)
      const size = sizeOf(out)
      if (size !== null && size > max) throw tooLarge()
      return out
    },
  }
}

/**
 * The output in a JSON-safe shape (text as-is, bytes as base64, JSON values inline) and
 * its size: characters, bytes, or characters once serialised.
 */
function encodeOutput(out: Value) {
  const outputType = valueType(out)
  if (outputType === 'bytes') {
    const bytes = out as Uint8Array
    return { size: bytes.byteLength, fields: { output: bytesToBase64(bytes), outputEncoding: 'base64', outputType } }
  }
  if (outputType === 'json') {
    try {
      const size = JSON.stringify(out).length
      return { size, fields: { output: out, outputEncoding: 'json', outputType } }
    } catch {
      const text = String(out)
      return { size: text.length, fields: { output: text, outputEncoding: 'text', outputType: 'string' } }
    }
  }
  const text = String(out ?? '')
  return { size: text.length, fields: { output: text, outputEncoding: 'text', outputType } }
}

const round = (timings: Record<string, number>) =>
  Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v * 1000) / 1000]))

export async function handleRun(request: Request, deps: RunDeps): Promise<Response> {
  const { registry, maxBodyBytes, maxSteps, timeoutMs } = deps
  const limitMsg = `the request body is larger than ${Math.round(maxBodyBytes / 1024)} KB`

  const declared = contentLength(request.headers)
  if (declared !== null && declared > maxBodyBytes) return jsonError(413, limitMsg)
  let raw: Uint8Array<ArrayBuffer>
  try {
    raw = await readCapped(request.body, maxBodyBytes)
  } catch (e) {
    if (e instanceof TooLargeError) return jsonError(413, limitMsg)
    return jsonError(400, 'could not read the request body')
  }

  let body: unknown
  try {
    body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
  } catch (e) {
    return jsonError(400, `the request body is not valid JSON: ${(e as Error).message}`)
  }
  if (!isObj(body)) return jsonError(400, 'the request body must be a JSON object')

  const parsed = parsePipeline(body, maxSteps, deps.maxShareChars)
  if ('error' in parsed) return jsonError(parsed.status ?? 400, parsed.error)
  const { steps } = parsed
  const input = parseInput(body, parsed.input)
  if ('error' in input) return jsonError(400, input.error)

  const unsupported = unsupportedSteps(steps, id => registry.get(id), 'edge')
  if (unsupported.length) {
    const list = unsupported.map(u => `${u.utilityId} (${u.reason})`).join(', ')
    return jsonError(422, `${unsupported.length} step${unsupported.length > 1 ? 's' : ''} cannot run on the server: ${list}`,
      { unsupported })
  }
  const invalid = invalidParams(steps, registry, deps.pbkdf2Budget)
  if (invalid.length) {
    const list = invalid.map(p => `${p.utilityId}.${p.param} ${p.error}`).join('; ')
    return jsonError(400, `invalid params: ${list}`, { invalidParams: invalid })
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(new Error('timeout')), timeoutMs)
  const kdf: KdfBudget = { left: deps.pbkdf2Budget, total: deps.pbkdf2Budget }
  let result: RunResult | undefined
  try {
    // the race matters for a step that ignores the signal: the runner only checks it between
    // steps (and between the items of a "run on each" step, yielding so this timer can fire)
    result = await Promise.race([
      runPipeline(input.value, steps, {
        load: async id => bounded(await registry.load(id), deps.maxValueSize, kdf),
        signal: ctrl.signal, env: 'edge', clock: deps.clock, maxValueSize: deps.maxValueSize,
        maxEachItems: deps.maxEachItems,
      }),
      untilAborted(ctrl.signal),
    ])
  } catch (e) {
    if (!ctrl.signal.aborted) throw e
  } finally {
    clearTimeout(timer)
  }
  if (!result || result.aborted) {
    return jsonError(504, `the pipeline did not finish within ${timeoutMs / 1000} s`)
  }
  // a branch merge is not a utility step, and JSON values are only measured here
  const { size, fields } = encodeOutput(result.out)
  if (size > deps.maxValueSize) {
    return jsonError(413, `the output is larger than the server's limit of ${deps.maxValueSize} characters or bytes`)
  }

  return json({
    ...fields,
    errors: result.err,
    timings: round(result.timings),
    skipped: result.skipped,
    halted: result.halted,
  }, 200, { 'cache-control': 'no-store' })
}
