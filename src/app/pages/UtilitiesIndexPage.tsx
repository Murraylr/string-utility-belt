import React, { useMemo, useState } from 'react'
import { registry } from '@/app/registry'
import AdSlot from '@/app/ads/AdSlot'
import { useSearchTracking } from '@/app/analytics/analytics'
import { utilityPath } from './related'
import { displayName, utilitiesDescription, utilitiesTitle } from './seo'
import { useDocumentMeta } from './useDocumentMeta'

/** Case-insensitive substring match over name, description, tags and aliases. */
function matches(u: ReturnType<typeof registry.list>[number], needle: string): boolean {
  if (!needle) return true
  const n = needle.toLowerCase()
  return (
    u.name.toLowerCase().includes(n) ||
    u.id.toLowerCase().includes(n) ||
    u.description.toLowerCase().includes(n) ||
    u.tags.some(t => t.toLowerCase().includes(n)) ||
    u.aliases.some(a => a.toLowerCase().includes(n))
  )
}

/**
 * The ad unit after the first category, not beside the filter box. Keyed on its own,
 * so filtering (which changes which category comes first) moves it rather than
 * remounting it — a remount would be a new ad request on every keystroke.
 */
function withAd(sections: React.ReactElement[]): React.ReactNode[] {
  if (sections.length === 0) return sections
  return [sections[0], <AdSlot key="ad:utilities-index" placement="utilities-index" />, ...sections.slice(1)]
}

/** Every utility, filterable and grouped by category, linking to its doc page. */
export default function UtilitiesIndexPage() {
  const [q, setQ] = useState('')
  const count = registry.list().length

  // restored on leaving: pages that set no title of their own would otherwise keep this one
  useDocumentMeta(utilitiesTitle(count), utilitiesDescription(count))

  const groups = useMemo(() => {
    const needle = q.trim()
    return registry.categories()
      .map(cat => ({ category: cat, items: registry.byCategory(cat).filter(u => matches(u, needle)) }))
      .filter(g => g.items.length > 0)
  }, [q])

  const total = useMemo(() => groups.reduce((n, g) => n + g.items.length, 0), [groups])
  useSearchTracking('utility_index', q, total)

  return (
    <div className="max-w-5xl mx-auto grid gap-6">
      <header className="grid gap-3">
        <h1 className="text-2xl font-semibold">All utilities</h1>
        <label className="grid gap-1 max-w-md">
          <span className="sr-only">Filter utilities</span>
          <input
            className="field"
            type="search"
            placeholder="Filter by name, description or tag…"
            aria-label="Filter utilities"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </label>
        <p role="status" aria-live="polite" className="muted text-sm">{total} of {registry.list().length} utilities</p>
      </header>

      {groups.length === 0 && <p className="muted">No utilities match "{q}".</p>}

      {withAd(groups.map(({ category, items }) => (
        <section key={category} className="grid gap-2">
          <h2 className="text-lg font-medium">{category} <span className="muted text-sm font-normal">({items.length})</span></h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {items.map(u => (
              <li key={u.id}>
                {/* the pre-rendered page's crawlable path; AppShell keeps the click in the app */}
                <a className="block p-3 rounded-xl border bg-surface hover:border-primary-600 hover:shadow-glow transition" href={utilityPath(u.id)}>
                  <div className="font-medium">{displayName(u.name)}</div>
                  <div className="text-xs text-muted">{u.description}</div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )))}
    </div>
  )
}
