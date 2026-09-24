/**
 * Favorite and recently-used utility ids, for the picker's pinned sections and
 * the command palette. Each is its own preference (`sub:pref:favorites`,
 * `sub:pref:recents`, `sub:pref:recentCommands`), so any other feature can also
 * read or push into them. Command ids live in their own list so running palette
 * commands never evicts the picker's recently used utilities.
 */
import { useCallback, useMemo } from 'react'
import { readPref, usePref, writePref } from './prefs'

export const MAX_RECENTS = 12

/** Stored lists are per-browser and may be stale or hand-edited: keep only string ids. */
function asIds(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
}

export function useFavorites() {
  const [stored, setFavorites] = usePref<unknown>('favorites', [])
  const favorites = useMemo(() => asIds(stored), [stored])
  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites])
  // stable identity, so memoized cards that receive it do not re-render
  const toggleFavorite = useCallback((id: string) =>
    setFavorites((prev: unknown) => {
      const ids = asIds(prev)
      return ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]
    }), [setFavorites])
  return { favorites, isFavorite, toggleFavorite }
}

export function useRecents() {
  const [stored] = usePref<unknown>('recents', [])
  const recents = useMemo(() => asIds(stored), [stored])
  return { recents }
}

export function useRecentCommands() {
  const [stored] = usePref<unknown>('recentCommands', [])
  const recentCommands = useMemo(() => asIds(stored), [stored])
  return { recentCommands }
}

function pushTo(pref: string, id: string): void {
  const current = asIds(readPref<unknown>(pref, []))
  writePref(pref, [id, ...current.filter(x => x !== id)].slice(0, MAX_RECENTS))
}

/** Record a utility pick as most-recently-used: moves `id` to the front, deduped, capped. */
export function pushRecent(id: string): void {
  pushTo('recents', id)
}

/** Record a palette command run (same rules as `pushRecent`, separate list). */
export function pushRecentCommand(id: string): void {
  pushTo('recentCommands', id)
}
