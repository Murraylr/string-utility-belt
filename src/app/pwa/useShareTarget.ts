import { useState } from 'react'

const SHARE_PARAMS = ['text', 'url', 'title'] as const

let consumed = false
let cachedValue: string | undefined

/**
 * Reads the manifest's `share_target` payload (`?text=` preferred, then
 * `?url=`, then `?title=`) once per page load and scrubs those params from
 * the address bar (keeping the hash, so a shared pipeline link still routes).
 * Cached at module scope so React StrictMode's double-invoked lazy state
 * initializer doesn't read the URL twice — the second call would otherwise
 * see the already-cleaned query string and lose the shared text.
 */
function consumeShareTarget(): string | undefined {
  if (consumed) return cachedValue
  consumed = true
  if (typeof window === 'undefined') return undefined

  const params = new URLSearchParams(window.location.search)
  // empty values are skipped: share sheets often send e.g. `title=` alongside the real payload
  cachedValue = SHARE_PARAMS.map((key) => params.get(key)).find((value) => !!value) || undefined

  let changed = false
  for (const key of SHARE_PARAMS) {
    if (params.has(key)) { params.delete(key); changed = true }
  }
  if (changed) {
    const query = params.toString()
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(window.history.state, '', next)
  }
  return cachedValue
}

/** Hook form of {@link consumeShareTarget} for use as a pipeline's initial input. */
export function useShareTarget(): string | undefined {
  const [value] = useState(consumeShareTarget)
  return value
}

/** Test-only: clears the module-level cache between test cases. */
export function __resetForTests(): void {
  consumed = false
  cachedValue = undefined
}
