import type { ParamKind, ParamSpec, Params } from '../types/utility'

export const PARAM_KINDS: readonly ParamKind[] = [
  'string', 'number', 'boolean', 'select', 'code',
  'textarea', 'regex', 'keyvalue', 'file', 'color', 'date', 'multiselect', 'range',
] as const

type HasParams = { params?: Record<string, ParamSpec> }

const copy = <T>(v: T): T =>
  Array.isArray(v) ? (v.map(x => (Array.isArray(x) ? [...x] : x)) as unknown as T) : v

/** Declared defaults, deep-copied so steps never share a mutable default array. */
export function defaultParams(util: HasParams | undefined): Params {
  const out: Params = {}
  for (const [k, spec] of Object.entries(util?.params ?? {})) {
    if ('default' in spec) out[k] = copy((spec as { default?: unknown }).default)
  }
  return out
}

/**
 * Fill in declared defaults for params the step does not supply.
 *
 * Two ways a param arrives absent: a pipeline saved before the param existed omits
 * the key entirely, and clearing a number input stores '' (the editor keeps the
 * empty string so the field can be retyped). Number('') is 0 — a finite value that
 * silently passes range checks — so without this a cleared "indent" box means 0, not
 * the default 2. Empty strings are left alone for text kinds, where '' is a
 * legitimate value. A bare string for a multiselect (a param that used to be a
 * single select) is wrapped so older pipelines keep working.
 */
export function resolveParams(util: HasParams | undefined, params: Params): Params {
  const out: Params = { ...params }
  for (const [key, spec] of Object.entries(util?.params ?? {})) {
    const v = out[key]
    if (spec.kind === 'multiselect' && typeof v === 'string') { out[key] = v ? [v] : []; continue }
    if (!('default' in spec)) continue
    const numeric = spec.kind === 'number' || spec.kind === 'range'
    if (v === undefined || v === null || (numeric && v === '')) {
      out[key] = copy((spec as { default?: unknown }).default)
    }
  }
  return out
}

const isBlank = (v: unknown) =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

/** One param's problem, or null when it is fine. Values are validated as resolved. */
export function validateParam(spec: ParamSpec, value: unknown, siblings: Params = {}): string | null {
  if (isBlank(value)) return spec.required ? 'required' : null
  switch (spec.kind) {
    case 'number':
    case 'range': {
      const n = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(n)) return 'must be a number'
      if (spec.kind === 'number' && spec.integer && !Number.isInteger(n)) return 'must be a whole number'
      if (spec.min !== undefined && n < spec.min) return `must be at least ${spec.min}`
      if (spec.max !== undefined && n > spec.max) return `must be at most ${spec.max}`
      return null
    }
    case 'string':
    case 'textarea': {
      const s = String(value)
      if (spec.maxLength !== undefined && s.length > spec.maxLength) return `at most ${spec.maxLength} characters`
      if (spec.kind === 'string' && spec.pattern) {
        try { if (!new RegExp(spec.pattern).test(s)) return 'invalid format' } catch { /* bad pattern: skip */ }
      }
      return null
    }
    case 'regex': {
      const flags = spec.flagsParam ? String(siblings[spec.flagsParam] ?? '') : ''
      try { new RegExp(String(value), flags); return null } catch (e: any) { return e?.message || 'invalid regex' }
    }
    case 'select':
      return spec.options.includes(String(value)) ? null : `must be one of: ${spec.options.join(', ')}`
    case 'multiselect': {
      if (!Array.isArray(value)) return 'must be a list'
      const bad = value.filter(x => !spec.options.includes(String(x)))
      return bad.length ? `unknown option${bad.length > 1 ? 's' : ''}: ${bad.join(', ')}` : null
    }
    case 'keyvalue':
      return Array.isArray(value) && value.every(p => Array.isArray(p) && p.length === 2)
        ? null : 'must be a list of key/value pairs'
    case 'color':
      return typeof value === 'string' && (!value.startsWith('#') || /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value))
        ? null : 'invalid color'
    case 'date':
      return Number.isNaN(Date.parse(String(value))) ? 'invalid date' : null
    default:
      return null
  }
}

/** Every param's problem, keyed by param name. An empty object means valid. */
export function validateParams(util: HasParams | undefined, params: Params): Record<string, string> {
  const resolved = resolveParams(util, params)
  const errors: Record<string, string> = {}
  for (const [key, spec] of Object.entries(util?.params ?? {})) {
    const problem = validateParam(spec, resolved[key], resolved)
    if (problem) errors[key] = problem
  }
  return errors
}
