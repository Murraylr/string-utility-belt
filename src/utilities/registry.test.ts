import { describe, it, expect } from 'vitest'
import { UTILITIES, UTIL_MAP, runPipeline } from '@/utilities'
import type { Utility, ValueType } from '@/types/utility'
import { PARAM_KINDS, validateParam } from '@/core/params'

/**
 * Registry-wide invariants. Every utility is auto-discovered by import.meta.glob, so
 * these checks are the only thing standing between a malformed utility and a silently
 * broken picker — a duplicate id, for instance, makes one utility shadow another in
 * UTIL_MAP with no error anywhere.
 */

const modules = import.meta.glob('./**/index.ts', { eager: true }) as Record<
  string,
  { default?: Utility }
>

const VALID_TYPES: ValueType[] = ['string', 'bytes', 'json']
const VALID_KINDS: readonly string[] = PARAM_KINDS

const CATEGORIES = new Set([
  'Encoding', 'Decoding', 'Hashing', 'Ciphers', 'Compression', 'Data Formats',
  'String Ops', 'Lines', 'Formatting', 'Analysis', 'Generators', 'Web & Dev',
  'Numbers', 'Date & Time', 'Color',
  // categories predating the expansion
  'URL & JSON', 'Other',
])

/** Utilities that legitimately reject empty input (each needs a documented reason). */
const MAY_THROW_ON_EMPTY = new Set<string>([
  // WebCrypto refuses a zero-length HMAC key ("Zero-length key is not supported"),
  // so there is no digest to return until the user supplies one.
  'hmac',
])

const typesOf = (v: unknown): ValueType[] =>
  (Array.isArray(v) ? v : [v]).filter(Boolean) as ValueType[]

describe('utility registry', () => {
  it('discovered a substantial set of utilities', () => {
    expect(UTILITIES.length).toBeGreaterThan(200)
  })

  it('has no duplicate ids', () => {
    const seen = new Map<string, number>()
    for (const u of UTILITIES) seen.set(u.id, (seen.get(u.id) ?? 0) + 1)
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    expect(dupes).toEqual([])
  })

  it('gives every utility its own directory named after its id', () => {
    const mismatches: string[] = []
    for (const [path, mod] of Object.entries(modules)) {
      const util = mod?.default
      // ./index.ts is the registry itself; its default export is the utility array
      if (!util || Array.isArray(util) || path === './index.ts') continue
      const dir = path.replace(/^\.\//, '').replace(/\/index\.tsx?$/, '')
      if (dir !== util.id) mismatches.push(`${path} exports id "${util.id}"`)
    }
    expect(mismatches).toEqual([])
  })

  it('exposes every utility through UTIL_MAP', () => {
    for (const u of UTILITIES) expect(UTIL_MAP[u.id]).toBeDefined()
  })

  it('gives every utility complete metadata', () => {
    const bad: string[] = []
    for (const u of UTILITIES) {
      if (!u.id || !/^[a-z][a-z0-9_]*$/.test(u.id)) bad.push(`${u.id}: invalid id`)
      if (!u.name || !u.name.trim()) bad.push(`${u.id}: missing name`)
      if (!u.description || u.description.trim().length < 10) bad.push(`${u.id}: missing description`)
      if (!CATEGORIES.has(u.category)) bad.push(`${u.id}: unknown category "${u.category}"`)
      if (typeof u.apply !== 'function') bad.push(`${u.id}: apply is not a function`)
      for (const t of typesOf(u.accepts ?? 'string')) {
        if (!VALID_TYPES.includes(t)) bad.push(`${u.id}: bad accepts "${t}"`)
      }
      for (const t of typesOf(u.produces ?? 'string')) {
        if (!VALID_TYPES.includes(t)) bad.push(`${u.id}: bad produces "${t}"`)
      }
    }
    expect(bad).toEqual([])
  })

  it('makes every utility findable and documented', () => {
    // search ranks on tags/aliases, and doc pages + the golden test run the examples
    const NO_EXAMPLES = new Set(['custom_js']) // runs user code: nothing fixed to demonstrate
    const bad: string[] = []
    for (const u of UTILITIES) {
      if (!Array.isArray(u.tags) || u.tags.length < 3) bad.push(`${u.id}: needs at least 3 tags`)
      if (u.tags?.some(t => t !== t.toLowerCase())) bad.push(`${u.id}: tags must be lowercase`)
      if (!NO_EXAMPLES.has(u.id) && !(u.examples?.length)) bad.push(`${u.id}: needs at least one example`)
    }
    expect(bad).toEqual([])
  })

  it('declares only supported param kinds, each with a usable default', () => {
    const bad: string[] = []
    for (const u of UTILITIES) {
      for (const [key, spec] of Object.entries(u.params ?? {})) {
        const s = spec as any
        if (!VALID_KINDS.includes(s?.kind)) {
          bad.push(`${u.id}.${key}: unsupported kind "${s?.kind}"`)
          continue
        }
        if (!s.label || !String(s.label).trim()) bad.push(`${u.id}.${key}: missing label`)
        if (!('default' in s)) bad.push(`${u.id}.${key}: no default`)
        if (s.kind === 'select') {
          if (!Array.isArray(s.options) || s.options.length === 0) {
            bad.push(`${u.id}.${key}: select without options`)
          } else if ('default' in s && !s.options.includes(s.default)) {
            bad.push(`${u.id}.${key}: default "${s.default}" not in options`)
          }
        }
        if (s.kind === 'number' && 'default' in s && typeof s.default !== 'number') {
          bad.push(`${u.id}.${key}: number default is not a number`)
        }
        // the runner enforces bounds, so a default outside them would break a fresh step
        if ((s.kind === 'number' || s.kind === 'range') && 'default' in s) {
          const problem = validateParam(s, s.default)
          if (problem) bad.push(`${u.id}.${key}: default ${s.default} ${problem}`)
        }
        if (s.kind === 'boolean' && 'default' in s && typeof s.default !== 'boolean') {
          bad.push(`${u.id}.${key}: boolean default is not a boolean`)
        }
        if (s.kind === 'multiselect') {
          if (!Array.isArray(s.options) || !s.options.length) bad.push(`${u.id}.${key}: multiselect without options`)
          if ('default' in s && (!Array.isArray(s.default) || s.default.some((v: string) => !s.options.includes(v)))) {
            bad.push(`${u.id}.${key}: multiselect default must be a subset of options`)
          }
        }
        if (s.kind === 'range') {
          if (typeof s.min !== 'number' || typeof s.max !== 'number' || s.min >= s.max) bad.push(`${u.id}.${key}: range needs min < max`)
          if ('default' in s && (typeof s.default !== 'number' || s.default < s.min || s.default > s.max)) bad.push(`${u.id}.${key}: range default out of bounds`)
        }
        if (s.kind === 'keyvalue' && 'default' in s && !Array.isArray(s.default)) {
          bad.push(`${u.id}.${key}: keyvalue default must be an array of pairs`)
        }
      }
    }
    expect(bad).toEqual([])
  })

  it('never throws on empty input with default params', async () => {
    const failures: string[] = []
    for (const u of UTILITIES) {
      if (MAY_THROW_ON_EMPTY.has(u.id)) continue
      const params: Record<string, unknown> = {}
      for (const [k, spec] of Object.entries(u.params ?? {})) {
        if ('default' in (spec as any)) params[k] = (spec as any).default
      }
      try {
        const accepted = typesOf(u.accepts ?? 'string')
        // the empty value has to match what the utility actually takes: '' for text,
        // {} for a JSON consumer, no bytes for a binary one
        const input = accepted.includes('string')
          ? ''
          : accepted.includes('json')
            ? {}
            : new Uint8Array()
        await u.apply(input as any, params)
      } catch (e: any) {
        failures.push(`${u.id}: ${e?.message ?? e}`)
      }
    }
    expect(failures).toEqual([])
  }, 120000)

  it('runs every utility as a single pipeline step without crashing the runner', async () => {
    // A utility may legitimately reject this sample (a base32 decoder, say), but the
    // failure must arrive as a caught step error, never as an unhandled rejection.
    const failures: string[] = []
    for (const u of UTILITIES) {
      const params: Record<string, unknown> = {}
      for (const [k, spec] of Object.entries(u.params ?? {})) {
        if ('default' in (spec as any)) params[k] = (spec as any).default
      }
      try {
        const { err } = await runPipeline('Hello, World! 123', [
          { id: 's1', utilityId: u.id, enabled: true, params },
        ])
        const message = err.s1
        if (message !== undefined && typeof message !== 'string') {
          failures.push(`${u.id}: non-string error`)
        }
      } catch (e: any) {
        failures.push(`${u.id}: runner threw — ${e?.message ?? e}`)
      }
    }
    expect(failures).toEqual([])
  }, 180000)
})
