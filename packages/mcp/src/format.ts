/**
 * Pure helpers shared by every tool handler: turning an MCP argument string into
 * a pipeline `Value`, rendering a `Value` back into MCP content, describing a
 * utility's params, and a cooperative timeout wrapper.
 * Kept dependency-free (no SDK imports) so they are trivial to unit test.
 */
import type { ParamSpec, Value } from '../../../src/types/utility'
import { valueType } from '../../../src/core'
import { MAX_OUTPUT_CHARS } from './limits'

/** `hex` is accepted because the generated utility examples use it (see describe_utility). */
export type InputEncoding = 'text' | 'base64' | 'hex' | 'json'

/** Throws when `raw` (as UTF-8) exceeds `maxBytes`. */
export function checkInputSize(raw: string, maxBytes: number): void {
  if (Buffer.byteLength(raw, 'utf8') > maxBytes) {
    throw new Error(`input exceeds the ${maxBytes.toLocaleString('en-US')} byte limit`)
  }
}

/** Standard or URL-safe alphabet; padding optional (agents often drop it). */
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/

/** Turns the tool's `input` string into the `Value` a utility's `apply` expects. */
export function decodeInput(raw: string, encoding: InputEncoding = 'text'): Value {
  switch (encoding) {
    case 'base64': {
      const compact = raw.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
      // a lone trailing character can never be valid base64 (it carries only 6 bits)
      if (!BASE64_RE.test(compact) || compact.replace(/=+$/, '').length % 4 === 1) {
        throw new Error('input is not valid base64')
      }
      return new Uint8Array(Buffer.from(compact, 'base64'))
    }
    case 'hex': {
      const compact = raw.replace(/\s+/g, '').replace(/^0x/i, '')
      if (!/^(?:[0-9a-fA-F]{2})*$/.test(compact)) throw new Error('input is not valid hex (need an even number of 0-9a-f digits)')
      return new Uint8Array(Buffer.from(compact, 'hex'))
    }
    case 'json':
      try {
        return JSON.parse(raw)
      } catch {
        throw new Error('input is not valid JSON')
      }
    case 'text':
    default:
      return raw
  }
}

export interface RenderedOutput {
  output: string
  /** Present only when `output` is base64 of raw bytes; absent for text/JSON (already plain text). */
  outputEncoding?: 'base64'
  /** Set when `output` was cut to the output limit; `fullLength` is the untruncated length in characters. */
  truncated?: true
  fullLength?: number
}

/** Cuts `s` to at most `max` UTF-16 units without splitting a surrogate pair. */
function cutText(s: string, max: number): string {
  let end = max
  const last = s.charCodeAt(end - 1)
  if (last >= 0xd800 && last <= 0xdbff) end--
  return s.slice(0, end)
}

/**
 * Renders a pipeline `Value` for a tool result: bytes -> base64, JSON -> pretty text,
 * string as-is. Anything longer than `maxChars` is truncated (base64 on a whole-byte
 * boundary, so the prefix still decodes) and flagged.
 */
export function renderOutput(value: Value, maxChars = MAX_OUTPUT_CHARS): RenderedOutput {
  const t = valueType(value)
  if (t === 'bytes') {
    const bytes = value as Uint8Array
    const fullLength = 4 * Math.ceil(bytes.length / 3)
    if (fullLength <= maxChars) return { output: Buffer.from(bytes).toString('base64'), outputEncoding: 'base64' }
    const keep = Math.floor(maxChars / 4) * 3
    return {
      output: Buffer.from(bytes.subarray(0, keep)).toString('base64'),
      outputEncoding: 'base64', truncated: true, fullLength,
    }
  }
  let text: string
  if (t === 'json') {
    try { text = JSON.stringify(value, null, 2) ?? String(value) } catch { text = String(value) }
  } else {
    text = String(value ?? '')
  }
  if (text.length <= maxChars) return { output: text }
  return { output: cutText(text, maxChars), truncated: true, fullLength: text.length }
}

/** Every field a `ParamSpec` might carry, copied only when present — keeps this generic across all 13 kinds. */
export function paramSummary(spec: ParamSpec): Record<string, unknown> {
  const out: Record<string, unknown> = { kind: spec.kind, label: spec.label }
  const optional = [
    'description', 'required', 'default', 'options', 'min', 'max', 'step', 'integer',
    'pattern', 'maxLength', 'placeholder', 'flagsParam', 'keyLabel', 'valueLabel',
    'accept', 'as', 'withTime', 'rows', 'language',
  ] as const
  for (const key of optional) {
    if (key in spec) out[key] = (spec as unknown as Record<string, unknown>)[key]
  }
  return out
}

/** Plain JSON data with prototype-polluting keys dropped — params arrive from an untrusted caller. */
export function plainParams(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(JSON.parse(JSON.stringify(raw)) as Record<string, unknown>)) {
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue
    out[k] = v
  }
  return out
}

/** A `#/p/<payload>` (or `#/embed/<payload>`) link, a full URL carrying one, or a bare payload. */
export function shareToPayload(share: string): string {
  const s = share.trim()
  const m = s.match(/#\/(?:p|embed)\/(.+)$/)
  return m ? m[1] : s
}

export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Rejection reason of `withTimeout` when the budget runs out. */
export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

/**
 * Races `run` against a timeout (and an optional caller `signal`, e.g. the client
 * cancelling the request), aborting `run`'s own signal when either fires.
 * Cooperative only: synchronous work cannot be interrupted, so a hard limit needs
 * a separate thread — see `createWorkerExecutor`.
 */
export async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T> | T, ms: number,
  signal?: AbortSignal): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: (() => void) | undefined
  const stop = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new TimeoutError(ms))
    }, ms)
    onAbort = () => {
      controller.abort()
      reject(new Error('cancelled'))
    }
    if (signal?.aborted) onAbort()
    else signal?.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([Promise.resolve().then(() => run(controller.signal)), stop])
  } finally {
    clearTimeout(timer)
    if (onAbort) signal?.removeEventListener('abort', onAbort)
  }
}
