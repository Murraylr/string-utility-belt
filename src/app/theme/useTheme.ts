import { useCallback, useEffect, useState } from 'react'
import { usePref } from '@/app/prefs'

export type ThemeMode = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

/** Global event a keyboard shortcut / menu item elsewhere can dispatch to cycle the theme. */
export const TOGGLE_THEME_EVENT = 'sub:toggle-theme'

const ORDER: ThemeMode[] = ['system', 'light', 'dark']
const DARK_QUERY = '(prefers-color-scheme: dark)'

// the static <meta name="theme-color"> in index.html is only a placeholder until this runs
const META_COLOR: Record<ResolvedTheme, string> = { light: '#f8fafc', dark: '#0b0f19' }

/** Coerces a stored pref (which may be stale, hand-edited or corrupt) to a valid mode. */
export function normalizeThemeMode(value: unknown): ThemeMode {
  return ORDER.includes(value as ThemeMode) ? (value as ThemeMode) : 'system'
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia(DARK_QUERY).matches
}

/** Reactive OS `prefers-color-scheme: dark`. */
function useSystemPrefersDark(): boolean {
  const [dark, setDark] = useState(systemPrefersDark)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = () => setDark(mql.matches)
    onChange() // the scheme may have flipped between the first render and this effect
    // Safari < 14 only has the deprecated addListener/removeListener pair
    if (mql.addEventListener) mql.addEventListener('change', onChange)
    else mql.addListener(onChange)
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange)
      else mql.removeListener(onChange)
    }
  }, [])

  return dark
}

function applyResolved(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark')
  let meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'theme-color')
    document.head.appendChild(meta)
  }
  meta.setAttribute('content', META_COLOR[resolved])
}

/**
 * Tri-state theme (`system` | `light` | `dark`) backed by the `theme` pref
 * (localStorage key `sub:pref:theme`) — the exact key `index.html`'s pre-paint
 * script reads, so there is no flash of the wrong theme on first load.
 *
 * Applies/removes the `dark` class on `<html>`, follows OS
 * `prefers-color-scheme` changes while the mode is `system` (re-rendering with
 * the new `resolved`), and keeps `<meta name="theme-color">` in sync.
 */
export function useTheme() {
  const [stored, setStored] = usePref<ThemeMode>('theme', 'system')
  const theme = normalizeThemeMode(stored)
  const systemDark = useSystemPrefersDark()
  const resolved: ResolvedTheme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => { applyResolved(resolved) }, [resolved])

  const setTheme = useCallback((next: ThemeMode | ((prev: ThemeMode) => ThemeMode)) => {
    setStored(prev => normalizeThemeMode(typeof next === 'function' ? next(normalizeThemeMode(prev)) : next))
  }, [setStored])

  const cycle = useCallback(() => {
    setTheme(prev => ORDER[(ORDER.indexOf(prev) + 1) % ORDER.length])
  }, [setTheme])

  return { theme, resolved, setTheme, cycle }
}

/**
 * Reactive `document.documentElement.classList.contains('dark')`, for consumers
 * (e.g. CodeMirror theme selection) that can't call `useTheme()` themselves —
 * a `MutationObserver` on `<html>`'s `class` attribute keeps it current even
 * when the class is toggled by something other than `useTheme` (the pre-paint
 * script, or a sibling `useTheme()` instance).
 */
export function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const root = document.documentElement
    const update = () => setIsDark(root.classList.contains('dark'))
    update()
    const observer = new MutationObserver(update)
    observer.observe(root, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return isDark
}
