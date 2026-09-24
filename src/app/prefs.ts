/**
 * Per-browser preferences, one localStorage key each (`sub:pref:<name>`), so any
 * feature can add a preference without touching a shared schema. Tabs stay in sync
 * through the `storage` event; same-tab listeners through a local event bus.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

const PREFIX = 'sub:pref:'
const listeners = new Map<string, Set<(v: unknown) => void>>()

export function readPref<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + name)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writePref<T>(name: string, value: T): void {
  try { localStorage.setItem(PREFIX + name, JSON.stringify(value)) } catch { /* storage full or disabled */ }
  listeners.get(name)?.forEach(fn => fn(value))
}

/** `useState` backed by a preference. */
export function usePref<T>(name: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readPref(name, fallback))

  useEffect(() => {
    const local = (v: unknown) => setValue(v as T)
    let set = listeners.get(name)
    if (!set) listeners.set(name, (set = new Set()))
    set.add(local)
    const onStorage = (e: StorageEvent) => {
      if (e.key === PREFIX + name) setValue(e.newValue === null ? fallback : readPref(name, fallback))
    }
    window.addEventListener('storage', onStorage)
    return () => { set!.delete(local); window.removeEventListener('storage', onStorage) }
    // fallback is a default, not a dependency: callers pass literals
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  // computed outside a state updater: writePref notifies other components' setters,
  // which must not run while React is processing this component's update queue
  const current = useRef(value)
  useEffect(() => { current.current = value }, [value])
  const update = useCallback((next: T | ((prev: T) => T)) => {
    const v = typeof next === 'function' ? (next as (p: T) => T)(current.current) : next
    current.current = v
    writePref(name, v)
  }, [name])

  return [value, update]
}
