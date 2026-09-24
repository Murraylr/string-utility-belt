/**
 * Turns `utility_id` / `utility_id:key=value,key2=value2` step arguments into
 * `UtilityStep`s, using each utility's own `ParamSpec`s to type-convert and
 * validate the values a shell can only ever hand us as strings.
 */
import { validateParams } from '../../../src/core/index'
import type { Registry, UtilityMeta } from '../../../src/core/index'
import type { ParamSpec, UtilityStep } from '../../../src/types/utility'

export class UsageError extends Error {}

/** Param kinds whose value is a list, so a plain comma continues the value instead of starting a new param. */
const LIST_KINDS = new Set<ParamSpec['kind']>(['multiselect', 'keyvalue'])

const unescapeCommas = (s: string): string => s.replace(/\\,/g, ',')

/** Split on commas not escaped as `\,`. Escapes are kept, for the caller to resolve per item. */
export function splitOnCommas(s: string): string[] {
  const out: string[] = []
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === ',') { cur += '\\,'; i++; continue }
    if (c === ',') { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out
}

/** End (exclusive) of the balanced JSON array/object that starts at `start`, or -1 if it never closes. */
function jsonEnd(s: string, start: number): number {
  let depth = 0
  let inString = false
  for (let i = start; i < s.length; i++) {
    const c = s[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '[' || c === '{') depth++
    else if ((c === ']' || c === '}') && --depth === 0) return i + 1
  }
  return -1
}

/**
 * Split a step's `key=value,key2=value2` text into raw `key=value` tokens. A comma
 * splits unless escaped as `\,` (the escape is kept for `coerceParamValue`). A value
 * that starts with `[` or `{` and closes is taken whole, so JSON needs no escaping;
 * nothing else groups — quotes and apostrophes are ordinary characters.
 */
export function splitParamTokens(s: string): string[] {
  const out: string[] = []
  let cur = ''
  let seenEq = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '\\' && s[i + 1] === ',') { cur += '\\,'; i++; continue }
    if (c === ',') { out.push(cur); cur = ''; seenEq = false; continue }
    cur += c
    if (c === '=' && !seenEq) {
      seenEq = true
      if (s[i + 1] === '[' || s[i + 1] === '{') {
        const end = jsonEnd(s, i + 1)
        if (end > 0) { cur += s.slice(i + 1, end); i = end - 1 }
      }
    }
  }
  out.push(cur)
  return out
}

/** Split a `key:value` (or `key=value`) pair on whichever separator comes first. */
function splitPair(item: string): [string, string] {
  const c = item.indexOf(':')
  const e = item.indexOf('=')
  const at = c >= 0 && (e < 0 || c < e) ? c : e
  return at < 0 ? [item, ''] : [item.slice(0, at), item.slice(at + 1)]
}

const BOOL_TRUE = new Set(['true', '1', 'yes'])
const BOOL_FALSE = new Set(['false', '0', 'no'])

/**
 * Convert one param's raw CLI text into the value its `ParamSpec.kind` expects.
 * `raw` may still hold `\,` escapes: list kinds split on the unescaped commas
 * first, every other kind just resolves them.
 */
export function coerceParamValue(spec: ParamSpec, raw: string, key: string, utilityId: string): unknown {
  const fail = (msg: string): never => {
    throw new UsageError(`invalid value for '${key}' on '${utilityId}': ${msg}`)
  }
  switch (spec.kind) {
    case 'number':
    case 'range': {
      const text = unescapeCommas(raw)
      if (text.trim() === '') fail('must be a number')
      const n = Number(text)
      if (Number.isNaN(n)) fail(`must be a number (got '${text}')`)
      return n
    }
    case 'boolean': {
      const v = unescapeCommas(raw).trim().toLowerCase()
      if (BOOL_TRUE.has(v)) return true
      if (BOOL_FALSE.has(v)) return false
      return fail(`must be true/false, 1/0, or yes/no (got '${raw}')`)
    }
    case 'multiselect': {
      const trimmed = raw.trim()
      if (trimmed.startsWith('[')) {
        let parsed: unknown
        try { parsed = JSON.parse(trimmed) } catch { fail('invalid JSON array') }
        if (!Array.isArray(parsed)) fail('JSON value must be an array')
        return (parsed as unknown[]).map(String)
      }
      return splitOnCommas(raw).map(s => unescapeCommas(s).trim()).filter(s => s !== '')
    }
    case 'keyvalue': {
      const trimmed = raw.trim()
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        let parsed: unknown
        try { parsed = JSON.parse(trimmed) } catch { fail('invalid JSON') }
        if (Array.isArray(parsed)) {
          return parsed.map(pair => {
            if (!Array.isArray(pair) || pair.length !== 2) fail('each pair must be a [key, value] 2-tuple')
            return [String((pair as unknown[])[0]), String((pair as unknown[])[1])]
          })
        }
        if (parsed && typeof parsed === 'object') {
          return Object.entries(parsed as Record<string, unknown>).map(([k, v]) => [k, String(v)])
        }
        return fail('JSON value must be an array of pairs, or an object')
      }
      return splitOnCommas(raw).filter(s => s !== '').map(s => splitPair(unescapeCommas(s)))
    }
    default:
      return unescapeCommas(raw)
  }
}

/** "unknown utility 'x'", plus any ids, aliases or tags that look like what was meant. */
function unknownUtility(id: string, registry: Registry): UsageError {
  const q = id.toLowerCase()
  const near = (m: UtilityMeta) =>
    m.id.includes(q) || (q.length >= 3 && q.includes(m.id)) ||
    [...m.aliases, ...m.tags].some(a => a.toLowerCase() === q || a.toLowerCase().startsWith(q))
  const hits = registry.list().filter(near).map(m => m.id).slice(0, 6)
  return new UsageError(
    `unknown utility '${id}'${hits.length ? ` — did you mean ${hits.join(', ')}?` : ''} (see --list, --search)`,
  )
}

/** Select/multiselect problems name the valid options; validateParam only does so for select. */
function withOptions(problem: string, spec: ParamSpec): string {
  return spec.kind === 'multiselect' ? `${problem} (options: ${spec.options.join(', ')})` : problem
}

/**
 * Parse `utility_id[:key=value,...]` into a `UtilityStep`, resolving and validating
 * params against `registry`. After a multiselect/keyvalue param, a token that is not
 * `knownParam=...` continues that list: `type=urls,emails,unique=true`.
 */
export function parseStepSpec(spec: string, index: number, registry: Registry): UtilityStep {
  const colon = spec.indexOf(':')
  const utilityId = (colon < 0 ? spec : spec.slice(0, colon)).trim()
  if (!utilityId) throw new UsageError(`invalid step '${spec}': missing utility id`)
  const meta = registry.get(utilityId)
  if (!meta) throw unknownUtility(utilityId, registry)

  const specs = meta.params
  const isParam = (k: string) => Object.prototype.hasOwnProperty.call(specs, k)
  const validKeys = () => {
    const keys = Object.keys(specs)
    return keys.length ? ` (valid params: ${keys.join(', ')})` : ' (this utility takes no params)'
  }

  const raw = new Map<string, string>()
  let listKey: string | undefined
  if (colon >= 0) {
    for (const token of splitParamTokens(spec.slice(colon + 1))) {
      if (token === '') continue
      const eq = token.indexOf('=')
      const key = eq < 0 ? '' : token.slice(0, eq).trim()
      if (listKey && (eq < 0 || !isParam(key))) {
        raw.set(listKey, `${raw.get(listKey)},${token}`)
        continue
      }
      if (eq < 0) throw new UsageError(`invalid param '${token}' for '${utilityId}': expected key=value${validKeys()}`)
      if (!isParam(key)) throw new UsageError(`unknown param '${key}' for '${utilityId}'${validKeys()}`)
      if (raw.has(key)) throw new UsageError(`param '${key}' given twice for '${utilityId}'`)
      raw.set(key, token.slice(eq + 1))
      listKey = LIST_KINDS.has(specs[key].kind) ? key : undefined
    }
  }

  const params: Record<string, unknown> = {}
  for (const [key, text] of raw) params[key] = coerceParamValue(specs[key], text, key, utilityId)

  // validateParams resolves defaults internally; only complain about keys the user actually supplied.
  const problems = validateParams(meta, params)
  for (const key of Object.keys(params)) {
    if (problems[key]) {
      throw new UsageError(`invalid value for '${key}' on '${utilityId}': ${withOptions(problems[key], specs[key])}`)
    }
  }
  return { id: `cli_${index}`, utilityId, params }
}
