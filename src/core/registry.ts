import type {
  Accepts, ParamSpec, PipelineStep, Produces, RunEnv, Utility, UtilityEnv,
} from '../types/utility'
import { utilityIds, walkSteps, isUtilityStep } from './steps'

/**
 * Everything the UI needs to list, search and configure a utility — without its
 * code. The browser loads `apply` on demand; the metadata ships up front.
 */
export interface UtilityMeta {
  id: string
  name: string
  category: string
  description: string
  accepts: Accepts
  produces: Produces
  params: Record<string, ParamSpec>
  tags: string[]
  aliases: string[]
  env: UtilityEnv[]
  streamable: boolean
  exampleCount: number
}

export function metaOf(u: Utility, detectedEnv: UtilityEnv[] = []): UtilityMeta {
  return {
    id: u.id,
    name: u.name,
    category: u.category || 'Other',
    description: u.description ?? '',
    accepts: u.accepts ?? 'string',
    produces: u.produces ?? 'string',
    params: u.params ?? {},
    tags: u.tags ?? [],
    aliases: u.aliases ?? [],
    env: [...new Set([...(u.env ?? []), ...detectedEnv])].sort() as UtilityEnv[],
    streamable: !!u.streamable,
    exampleCount: u.examples?.length ?? 0,
  }
}

export interface Registry {
  list(): UtilityMeta[]
  get(id: string): UtilityMeta | undefined
  has(id: string): boolean
  categories(): string[]
  byCategory(category?: string): UtilityMeta[]
  /** The utility with its code; cached after the first call. Rejects for unknown ids. */
  load(id: string): Promise<Utility>
}

export function createRegistry(metas: UtilityMeta[],
  loader: (id: string) => Promise<Utility> | Utility): Registry {
  const byId = new Map(metas.map(m => [m.id, m]))
  const cache = new Map<string, Promise<Utility>>()
  const categories = [...new Set(metas.map(m => m.category))]
  return {
    list: () => metas,
    get: id => byId.get(id),
    has: id => byId.has(id),
    categories: () => categories,
    byCategory: cat => (!cat || cat === 'All' ? metas : metas.filter(m => m.category === cat)),
    load(id) {
      if (!byId.has(id)) return Promise.reject(new Error(`unknown utility: ${id}`))
      let p = cache.get(id)
      if (!p) {
        p = Promise.resolve().then(() => loader(id))
        // a failed chunk load must be retryable, not cached forever
        p.catch(() => cache.delete(id))
        cache.set(id, p)
      }
      return p
    },
  }
}

/** Which capabilities an environment lacks. */
const MISSING: Record<RunEnv, UtilityEnv[]> = {
  'browser-main': [],
  'browser-worker': ['dom', 'main'],
  node: ['main'],
  edge: ['dom', 'wasm', 'eval', 'main'],
}

export interface Unsupported { stepId: string; utilityId: string; reason: string }

/** Steps that cannot run in `env` (unknown utilities included). Disabled steps count too. */
export function unsupportedSteps(steps: PipelineStep[], lookup: (id: string) => UtilityMeta | undefined,
  env: RunEnv, opts: { allowEval?: boolean } = {}): Unsupported[] {
  const out: Unsupported[] = []
  const missing = MISSING[env].filter(e => !(e === 'eval' && opts.allowEval))
  walkSteps(steps, s => {
    if (!isUtilityStep(s)) return
    const meta = lookup(s.utilityId)
    if (!meta) { out.push({ stepId: s.id, utilityId: s.utilityId, reason: 'unknown utility' }); return }
    const lack = meta.env.filter(e => missing.includes(e))
    if (lack.length) out.push({ stepId: s.id, utilityId: s.utilityId, reason: `needs ${lack.join(', ')}` })
  })
  return out
}

/** True when every utility in the tree can run inside a Web Worker. */
export function canRunInWorker(steps: PipelineStep[], lookup: (id: string) => UtilityMeta | undefined): boolean {
  return utilityIds(steps).every(id => {
    const m = lookup(id)
    return !!m && !m.env.some(e => e === 'dom' || e === 'main')
  })
}
