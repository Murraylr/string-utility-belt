import React, { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Search, Plus, Star, Clock } from 'lucide-react'
import { registry } from '@/app/registry'
import { utilityPath } from '@/app/pages/related'
import type { UtilityMeta } from '@/core/registry'
import { compatibility } from '@/core/coerce'
import type { ValueType } from '@/types/utility'
import { searchUtilities, type FuzzyRange } from '@/app/search/fuzzy'
import Highlight from '@/app/search/Highlight'
import { useFavorites, useRecents, pushRecent } from '@/app/favorites'
import { useSearchTracking } from '@/app/analytics/analytics'

export interface UtilityPickerProps {
  onPick: (id: string) => void
  /** Escape in an empty search box calls this (e.g. to hide the picker). */
  onClose?: () => void
  /** The previous step's output type(s), for type-aware compatibility badges. */
  previousProduces?: ValueType[]
}

type Section = 'favorites' | 'recents' | 'results'
interface VisibleItem {
  key: string
  meta: UtilityMeta
  section: Section
  nameRanges: FuzzyRange[]
}

const NO_RANGES: FuzzyRange[] = []

interface PickerCardProps {
  optionId: string
  meta: UtilityMeta
  nameRanges: FuzzyRange[]
  index: number
  active: boolean
  favorite: boolean
  badgeLevel?: 'lossy' | 'coerce'
  badgeNote?: string
  onHover: (index: number) => void
  onPick: (id: string) => void
  onToggleFavorite: (id: string) => void
}

/**
 * One option. Memoized with primitive / stable props: hovering or arrowing through
 * ~250 cards then re-renders the two whose `active` flips, not the whole grid.
 */
const PickerCard = memo(function PickerCard({
  optionId, meta, nameRanges, index, active, favorite, badgeLevel, badgeNote, onHover, onPick, onToggleFavorite,
}: PickerCardProps) {
  return (
    <div
      id={optionId}
      role="option"
      aria-selected={active}
      // named by the utility (and its badge) rather than by every control and chip in the card
      aria-labelledby={badgeLevel ? `${optionId}-name ${optionId}-badge` : `${optionId}-name`}
      aria-description={badgeNote}
      onMouseEnter={() => onHover(index)}
      // keep focus in the search box so the arrow keys keep working after a click
      onMouseDown={e => e.preventDefault()}
      // a click on the docs link is not a pick. Not stopped at the link instead: the click
      // must bubble on to the document, where AppShell's handler follows it in-app
      onClick={e => { if (!(e.target as Element).closest('a')) onPick(meta.id) }}
      className={`text-left p-4 rounded-2xl border cursor-pointer transition ${active ? 'border-primary-600 bg-surface-2 shadow-glow' : 'bg-surface hover:border-primary-600'}`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span id={`${optionId}-name`} className="font-medium">
          <Highlight text={meta.name} ranges={nameRanges} />
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {badgeLevel && (
            <span id={`${optionId}-badge`} className="chip" title={badgeNote}>
              {badgeLevel === 'lossy' ? 'lossy' : 'coerced'}
            </span>
          )}
          <span className="chip">{meta.category}</span>
          <button
            type="button"
            aria-label={favorite ? `unfavorite ${meta.name}` : `favorite ${meta.name}`}
            aria-pressed={favorite}
            // one Tab stop for the whole grid (the active option's star), not ~250: the arrow
            // keys pick the option in the search box, Tab then reaches its favorite toggle
            tabIndex={active ? 0 : -1}
            // icon-btn alone renders ~30x30px here — under the ~40px mobile tap-target
            // guideline; grow the hit area without touching the shared class
            className="icon-btn min-w-[40px] min-h-[40px] inline-flex items-center justify-center"
            onClick={e => { e.stopPropagation(); onToggleFavorite(meta.id) }}
          >
            <Star size={14} fill={favorite ? 'currentColor' : 'none'} aria-hidden />
          </button>
        </div>
      </div>
      <div className="text-xs text-muted">{meta.description}</div>
      <div className="mt-3 flex flex-wrap gap-1">
        {Object.keys(meta.params).slice(0, 3).map(k => (
          <span key={k} className="text-[10px] px-1.5 py-0.5 rounded-sm bg-surface-2 border">{k}</span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-primary-600"><Plus size={14} aria-hidden /> add</span>
        <a
          href={utilityPath(meta.id)}
          aria-label={`${meta.name} docs`}
          // same single Tab stop as the favorite toggle
          tabIndex={active ? 0 : -1}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary-600 hover:underline"
        >
          <BookOpen size={12} aria-hidden /> docs
        </a>
      </div>
    </div>
  )
})

export default function UtilityPicker({ onPick, onClose, previousProduces: producesProp }: UtilityPickerProps) {
  // an empty list carries no type information: behave as if none was given
  const previousProduces = producesProp?.length ? producesProp : undefined
  const [category, setCategory] = useState('All')
  const [query, setQuery] = useState('')
  const [onlyExact, setOnlyExact] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  // unique per instance: option ids back aria-activedescendant, so two pickers must not collide
  const idBase = useId()
  const listboxId = `${idBase}-listbox`

  const { favorites, toggleFavorite } = useFavorites()
  const favoriteSet = useMemo(() => new Set(favorites), [favorites])
  const { recents } = useRecents()

  useEffect(() => { inputRef.current?.focus() }, [])

  const categories = useMemo(() => ['All', ...registry.categories()], [])

  const results = useMemo(
    () => searchUtilities(query, registry.byCategory(category)),
    [category, query]
  )

  const showPinned = query.trim() === ''

  // the category chips and the "only exact matches" toggle filter every section alike
  const passesFilters = useMemo(() => (meta: UtilityMeta) =>
    (category === 'All' || meta.category === category) &&
    (!onlyExact || !previousProduces || compatibility(previousProduces, meta.accepts).level === 'exact'),
  [category, onlyExact, previousProduces])

  const favoriteMetas = useMemo(
    () => (showPinned
      ? favorites.map(id => registry.get(id)).filter((m): m is UtilityMeta => !!m && passesFilters(m))
      : []),
    [showPinned, favorites, passesFilters]
  )
  const recentMetas = useMemo(
    () => (showPinned
      ? recents.map(id => registry.get(id))
        .filter((m): m is UtilityMeta => !!m && !favorites.includes(m.id) && passesFilters(m))
      : []),
    [showPinned, recents, favorites, passesFilters]
  )
  const filteredResults = useMemo(() => {
    // pinned sections already show favorites; keep the browse list free of duplicates
    const pinned = new Set(favoriteMetas.map(m => m.id))
    return results.filter(r => !pinned.has(r.meta.id) && passesFilters(r.meta))
  }, [results, favoriteMetas, passesFilters])
  useSearchTracking('picker', query, filteredResults.length)

  const visible: VisibleItem[] = useMemo(() => [
    ...favoriteMetas.map(m => ({ key: `${idBase}-fav-${m.id}`, meta: m, section: 'favorites' as const, nameRanges: NO_RANGES })),
    ...recentMetas.map(m => ({ key: `${idBase}-rec-${m.id}`, meta: m, section: 'recents' as const, nameRanges: NO_RANGES })),
    ...filteredResults.map(r => ({ key: `${idBase}-res-${r.meta.id}`, meta: r.meta, section: 'results' as const, nameRanges: r.nameRanges })),
  ], [idBase, favoriteMetas, recentMetas, filteredResults])

  // reset the active option (during render, not an effect — see the React docs on
  // "adjusting state when a prop changes") whenever the visible list changes shape
  const resetKey = `${category}\0${query}\0${onlyExact}`
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (resetKey !== prevResetKey) { setPrevResetKey(resetKey); setActiveIndex(0) }
  const clampedIndex = Math.max(0, Math.min(activeIndex, visible.length - 1))
  const activeId = visible[clampedIndex]?.key

  const withIndex = useMemo(() => visible.map((item, idx) => ({ item, idx })), [visible])
  const favSection = withIndex.filter(x => x.item.section === 'favorites')
  const recSection = withIndex.filter(x => x.item.section === 'recents')
  const resSection = withIndex.filter(x => x.item.section === 'results')

  // stable, so the memoized cards only re-render when their own props change
  const onPickRef = useRef(onPick)
  useLayoutEffect(() => { onPickRef.current = onPick })
  const pick = useCallback((id: string) => {
    pushRecent(id)
    onPickRef.current(id)
  }, [])

  const moveTo = (index: number) => {
    if (!visible.length) return
    const next = Math.max(0, Math.min(index, visible.length - 1))
    setActiveIndex(next)
    document.getElementById(visible[next].key)?.scrollIntoView?.({ block: 'nearest' })
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveTo(clampedIndex + 1); break
      case 'ArrowUp': e.preventDefault(); moveTo(clampedIndex - 1); break
      case 'Home': e.preventDefault(); moveTo(0); break
      case 'End': e.preventDefault(); moveTo(visible.length - 1); break
      case 'Enter': {
        // modified Enter belongs to the global shortcuts (Ctrl/Cmd+Enter = run now)
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) break
        const item = visible[clampedIndex]
        if (item) { e.preventDefault(); pick(item.meta.id) }
        break
      }
      case 'Escape': {
        // only an Escape the picker acted on stops here (e.g. clearing must not also close a dialog around it)
        const handle = query ? () => setQuery('') : onClose
        if (!handle) break
        e.preventDefault()
        e.stopPropagation()
        handle()
        break
      }
      default:
        break
    }
  }

  // role="none" on the list wrappers keeps listbox > group > option ownership intact
  const renderGrid = (entries: { item: VisibleItem; idx: number }[]) => (
    <ul role="none" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {entries.map(({ item, idx }) => {
        const compat = previousProduces ? compatibility(previousProduces, item.meta.accepts) : null
        const badge = compat && compat.level !== 'exact' ? { level: compat.level, note: compat.note } : null
        return (
          <li role="none" key={item.key}>
            <PickerCard
              optionId={item.key}
              meta={item.meta}
              nameRanges={item.nameRanges}
              index={idx}
              active={idx === clampedIndex}
              favorite={favoriteSet.has(item.meta.id)}
              badgeLevel={badge?.level}
              badgeNote={badge?.note}
              onHover={setActiveIndex}
              onPick={pick}
              onToggleFavorite={toggleFavorite}
            />
          </li>
        )
      })}
    </ul>
  )

  return (
    <div className="card p-5">
      {/* one scrolling row on phones: wrapped, the ~16 chips fill most of the picker's
          height-capped scroll area and leave room for a single card. p-1/-m-1 keep the
          focus outline (2px + 2px offset) inside the scroller's clip box */}
      <div className="flex items-center gap-2 mb-2 -m-1 p-1 overflow-x-auto sm:flex-wrap sm:overflow-visible">
        {categories.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            aria-pressed={category === c}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full text-sm border transition ${category === c ? 'bg-primary-600 text-white border-primary-600 shadow-glow' : 'bg-surface hover:bg-surface-2'}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="relative mb-2">
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          aria-label="Search utilities"
          className="w-full field pl-9"
          placeholder="Search utilities…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted" size={16} aria-hidden />
      </div>
      <div role="status" className="sr-only">
        {query.trim() ? `${filteredResults.length} ${filteredResults.length === 1 ? 'utility' : 'utilities'} found` : ''}
      </div>
      {previousProduces && (
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyExact} onChange={e => setOnlyExact(e.target.checked)} />
          only exact matches
        </label>
      )}
      <div id={listboxId} role="listbox" aria-label="utilities">
        {favSection.length > 0 && (
          <div role="group" aria-label="Favorites" className="mb-4">
            <div className="flex items-center gap-1 text-xs text-muted mb-2" aria-hidden><Star size={12} /> Favorites</div>
            {renderGrid(favSection)}
          </div>
        )}
        {recSection.length > 0 && (
          <div role="group" aria-label="Recently used" className="mb-4">
            <div className="flex items-center gap-1 text-xs text-muted mb-2" aria-hidden><Clock size={12} /> Recently used</div>
            {renderGrid(recSection)}
          </div>
        )}
        {resSection.length > 0 && (
          <div role="group" aria-label="Results">
            {renderGrid(resSection)}
          </div>
        )}
      </div>
      {visible.length === 0 && (
        <div className="text-sm text-muted">No utilities match your search.</div>
      )}
    </div>
  )
}
