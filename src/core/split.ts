/**
 * Splitting a value into items and putting per-item results back together, for
 * "run on each" steps. Pure: the runner decides what runs on each item.
 *
 * Fidelity rules (an identity sub-pipeline must give the input back unchanged):
 * - `lines`: split on '\n'. A line's trailing '\r' (CRLF) is set aside and restored,
 *   so items never carry it. A final newline ends the last line rather than starting
 *   an empty extra item. Empty input has no items.
 * - `delimiter`: split on a literal separator and rejoin with it. Empty input has no items.
 * - `json-array` / `json-values`: one item per element / per value of the top level
 *   (no recursion). Strings are handed over as text, objects and arrays as JSON, and
 *   numbers, booleans and null as their JSON text; such an item comes back as a number,
 *   boolean or null again when its result still parses as one, else as text.
 *
 * Results that are JSON values are written into text modes as compact JSON (one line),
 * and bytes as UTF-8 text.
 */
import type { SplitMode, SplitSpec, Value } from '../types/utility'
import { asText, coerceInputFor, isBytes, valueType } from './coerce'

export interface ItemSplit {
  /** What each item's sub-pipeline receives. */
  items: Value[]
  /** How an item is named in messages: `line 4`, `[3]`, `"apiKey"`. */
  label(index: number): string
  /** The step's output, from one result per item (in item order). */
  join(results: Value[]): Value
}

/** Longest separator a delimiter split accepts (and a share link keeps). */
export const MAX_SEPARATOR_LENGTH = 50

/** Singular and plural nouns for a split's items, for messages and labels. */
export const ITEM_NOUNS: Readonly<Record<SplitMode, readonly [string, string]>> = {
  lines: ['line', 'lines'],
  delimiter: ['item', 'items'],
  'json-array': ['element', 'elements'],
  'json-values': ['value', 'values'],
}

export const itemNoun = (mode: SplitMode, count: number): string => ITEM_NOUNS[mode][count === 1 ? 0 : 1]

/** A result as one piece of text: strings as-is, bytes decoded, JSON compact so a line stays one line. */
export function itemText(v: Value): string {
  if (typeof v === 'string') return v
  if (isBytes(v)) return new TextDecoder().decode(v)
  if (v === null || v === undefined) return ''
  const t = coerceInputFor(v, 'string')
  return typeof t === 'string' ? t : String(t)
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

const isPrimitive = (x: unknown): x is null | boolean | number =>
  x === null || typeof x === 'boolean' || typeof x === 'number'

/** A JSON element as a sub-pipeline input. */
function toItem(x: unknown): Value {
  if (typeof x === 'string') return x
  if (isPrimitive(x)) return JSON.stringify(x)
  return x as Value
}

/** A sub-pipeline result written back in place of the JSON element `original`. */
function fromItem(result: Value, original: unknown): unknown {
  if (valueType(result) === 'json') return result
  const text = itemText(result)
  if (isPrimitive(original)) {
    try {
      const parsed = JSON.parse(text)
      if (isPrimitive(parsed)) return parsed
    } catch { /* not JSON: the item became text */ }
  }
  return text
}

function describeJson(v: unknown): string {
  if (Array.isArray(v)) return 'an array'
  if (v === null) return 'null'
  if (typeof v === 'object') return 'an object'
  return `a ${typeof v}`
}

/** The input as a parsed JSON value; throws a readable error for anything that is not JSON. */
function jsonOf(input: Value): unknown {
  if (valueType(input) === 'json') return input
  try {
    return JSON.parse(asText(input))
  } catch (e) {
    throw new Error(`the input is not valid JSON (${(e as Error).message})`)
  }
}

function splitLines(input: Value): ItemSplit {
  const text = itemText(input)
  if (text === '') return { items: [], label: i => `line ${i + 1}`, join: () => '' }
  const segments = text.split('\n')
  const trailingNewline = text.endsWith('\n')
  if (trailingNewline) segments.pop()
  const cr = segments.map(s => s.endsWith('\r'))
  return {
    items: segments.map((s, i) => (cr[i] ? s.slice(0, -1) : s)),
    label: i => `line ${i + 1}`,
    join: results => results.map((r, i) => (cr[i] ? `${itemText(r)}\r` : itemText(r))).join('\n') + (trailingNewline ? '\n' : ''),
  }
}

function splitDelimiter(input: Value, separator: string): ItemSplit {
  if (typeof separator !== 'string' || separator === '') throw new Error('the separator is empty')
  const text = itemText(input)
  return {
    items: text === '' ? [] : text.split(separator),
    label: i => `item ${i + 1}`,
    join: results => results.map(itemText).join(separator),
  }
}

function splitArray(input: Value): ItemSplit {
  const v = jsonOf(input)
  if (!Array.isArray(v)) throw new Error(`expected a JSON array, got ${describeJson(v)}`)
  return {
    items: v.map(toItem),
    label: i => `[${i}]`,
    join: results => results.map((r, i) => fromItem(r, v[i])) as Json[],
  }
}

function splitValues(input: Value): ItemSplit {
  const v = jsonOf(input)
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`expected a JSON object, got ${describeJson(v)}`)
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj)
  return {
    items: keys.map(k => toItem(obj[k])),
    label: i => JSON.stringify(keys[i].length > 40 ? `${keys[i].slice(0, 40)}…` : keys[i]),
    // fromEntries defines own properties: a "__proto__" key stays a key instead of a prototype
    join: results => Object.fromEntries(keys.map((k, i) => [k, fromItem(results[i], obj[k])])) as Record<string, unknown>,
  }
}

/** Cut `input` into items per `spec`. Throws a readable error when the input does not fit the mode. */
export function splitItems(input: Value, spec: SplitSpec): ItemSplit {
  switch (spec.mode) {
    case 'lines': return splitLines(input)
    case 'delimiter': return splitDelimiter(input, spec.separator)
    case 'json-array': return splitArray(input)
    case 'json-values': return splitValues(input)
    default: throw new Error(`unknown split mode: ${(spec as { mode?: unknown }).mode}`)
  }
}
