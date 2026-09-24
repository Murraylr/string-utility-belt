/**
 * GET /api/utilities[?category=&q=] and GET /api/utilities/:id — the utility catalogue,
 * with whether each one can run in `POST /api/run` (`availableOnEdge`).
 */
import { unsupportedSteps, type UtilityMeta } from '../src/core/registry'
import type { UtilityExample } from '../src/types/utility'
import type { ApiRegistry } from './env'
import { json, jsonError } from './http'

export interface UtilitiesDeps {
  registry: ApiRegistry
  examples: Record<string, UtilityExample[]>
}

const CACHE = { 'cache-control': 'public, max-age=3600' }

type Listed = UtilityMeta & { availableOnEdge: boolean }

const edgeCache = new WeakMap<ApiRegistry, Map<string, boolean>>()

function availableOnEdge(registry: ApiRegistry, id: string): boolean {
  let byId = edgeCache.get(registry)
  if (!byId) edgeCache.set(registry, byId = new Map())
  let ok = byId.get(id)
  if (ok === undefined) {
    ok = unsupportedSteps([{ id: 'probe', utilityId: id }], x => registry.get(x), 'edge').length === 0
    byId.set(id, ok)
  }
  return ok
}

const withEdge = (registry: ApiRegistry, m: UtilityMeta): Listed => ({ ...m, availableOnEdge: availableOnEdge(registry, m.id) })

/** Every whitespace-separated term must appear in the id, name, description, category, tags or aliases. */
function matches(m: UtilityMeta, terms: string[]): boolean {
  const hay = [m.id, m.name, m.description, m.category, ...m.tags, ...m.aliases].join('\n').toLowerCase()
  return terms.every(t => hay.includes(t))
}

export function handleUtilities(url: URL, deps: UtilitiesDeps): Response {
  const { registry, examples } = deps
  const rest = url.pathname.replace(/^\/api\/utilities\/?/, '')

  if (rest) {
    let id: string
    try { id = decodeURIComponent(rest) } catch { return jsonError(404, 'unknown utility') }
    const meta = id.includes('/') ? undefined : registry.get(id)
    if (!meta) return jsonError(404, `unknown utility: ${id.slice(0, 100)}`)
    return json({ ...withEdge(registry, meta), examples: examples[id] ?? [] }, 200, CACHE)
  }

  const category = url.searchParams.get('category')?.trim().toLowerCase()
  const terms = (url.searchParams.get('q') ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const all = registry.list()
  const utilities = all
    .filter(m => !category || m.category.toLowerCase() === category)
    .filter(m => !terms.length || matches(m, terms))
    .map(m => withEdge(registry, m))
  const categories = [...new Set(all.map(m => m.category))]
  return json({ count: utilities.length, categories, utilities }, 200, CACHE)
}
