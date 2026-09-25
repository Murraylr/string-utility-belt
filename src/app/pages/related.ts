import type { UtilityMeta } from '@/core/registry'

export const RELATED_LIMIT = 6

/**
 * Utilities to suggest next to `meta`, shared by the doc page and its
 * pre-rendered snapshot. Shared tags say more than a shared category
 * (url_decode ↔ url_encode live in different ones).
 */
export function relatedUtilities(meta: UtilityMeta, all: UtilityMeta[], limit = RELATED_LIMIT): UtilityMeta[] {
  const tags = new Set(meta.tags)
  return all
    .filter(m => m.id !== meta.id)
    .map(m => ({ m, shared: m.tags.filter(t => tags.has(t)).length, same: m.category === meta.category }))
    .filter(r => r.shared > 0 || r.same)
    .sort((a, b) => b.shared - a.shared || Number(b.same) - Number(a.same) || a.m.name.localeCompare(b.m.name))
    .slice(0, limit)
    .map(r => r.m)
}

/** A utility's crawlable, pre-rendered URL path. */
export const utilityPath = (id: string): string => `/util/${encodeURIComponent(id)}/`
