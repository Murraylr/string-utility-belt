/**
 * Eager utility registry: every utility module, imported up front.
 *
 * Used by tests and Node-side tooling. The web app must NOT import this file —
 * it would pull every utility into the initial bundle. The app uses the lazy
 * registry in `./lazy.ts`, backed by the generated manifest.
 */
import type { PipelineStep, Utility, Value } from '../types/utility'
import { runPipeline as runCore, type RunResult } from '../core/runner'

const modulesTs = import.meta.glob('./*/index.ts', { eager: true }) as Record<string, { default?: Utility }>
const modulesTsx = import.meta.glob('./*/index.tsx', { eager: true }) as Record<string, { default?: Utility }>

function pickUtilities(records: Record<string, { default?: Utility }>): Utility[] {
  const arr: Utility[] = []
  for (const [key, mod] of Object.entries(records)) {
    const util = mod?.default
    if (!util || Array.isArray(util)) { console.warn('[utilities] skipped module without a utility default export:', key); continue }
    arr.push(util)
  }
  return arr
}

export const UTILITIES: Utility[] = pickUtilities({ ...modulesTs, ...modulesTsx })

export const UTIL_MAP: Record<string, Utility> = Object.fromEntries(UTILITIES.map(u => [u.id, u]))

export const CATEGORIES: string[] = Array.from(new Set(['All', ...UTILITIES.map(u => u.category || 'Other')]))

export function getUtilities(): Utility[] { return UTILITIES }
export function getCategories(): string[] { return CATEGORIES }
export function getUtilitiesByCategory(category?: string): Utility[] {
  if (!category || category === 'All') return UTILITIES
  return UTILITIES.filter(u => (u.category || 'Other') === category)
}

export const UTIL_DISPLAY = UTILITIES.map(u => ({
  id: u.id, name: u.name, description: u.description || '',
  category: u.category || 'Other', params: u.params || {},
  accepts: u.accepts ?? 'string', produces: u.produces ?? 'string',
}))

export type { Utility, Value, ValueType } from '../types/utility'
export { valueType, formatForDisplay } from '../core/coerce'
export { resolveParams } from '../core/params'

/** Resolve a utility id against the eager map; unknown ids reject like the lazy loader. */
export const loadEager = (id: string): Utility => {
  const u = UTIL_MAP[id]
  if (!u) throw new Error(`unknown utility: ${id}`)
  return u
}

/** Back-compat signature: `runPipeline(source, steps, wantPreviews)`. */
export function runPipeline(source: Value, steps: PipelineStep[], wantPreviews = false): Promise<RunResult> {
  return runCore(source, steps, { load: loadEager, previews: wantPreviews, env: 'node' })
}

export default UTILITIES
