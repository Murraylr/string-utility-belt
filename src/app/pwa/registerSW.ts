/**
 * Service-worker registration for the installable/offline PWA. Kept out of
 * `main.tsx`'s control flow (it's an integration call, see the barrel) and
 * fully guarded so dev, tests and embeds never register a worker.
 */

export type UpdateListener = () => void

/** Minimum gap between the extra update checks made when the app comes back into view. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

let registrationStarted = false
let registration: ServiceWorkerRegistration | null = null
let updateReady = false
const updateListeners = new Set<UpdateListener>()
let stopUpdateChecks: (() => void) | null = null

function notifyUpdateAvailable() {
  if (updateReady) return
  updateReady = true
  for (const cb of [...updateListeners]) cb()
}

/** True when this window runs inside a frame (an embed). A cross-origin parent makes `top` throw — still an embed. */
export function isEmbedded(win: Window | undefined = typeof window === 'undefined' ? undefined : window): boolean {
  if (!win) return false
  try {
    return win.self !== win.top
  } catch {
    return true
  }
}

/** Same-origin `/assets/*` URLs (path + query) among the page's resource-timing entries. */
export function loadedAssetUrls(
  entries: PerformanceEntryList = typeof performance !== 'undefined' && performance.getEntriesByType
    ? performance.getEntriesByType('resource') : [],
  origin: string = location.origin,
): string[] {
  const urls = new Set<string>()
  for (const entry of entries) {
    let url: URL
    try { url = new URL(entry.name) } catch { continue }
    if (url.origin === origin && url.pathname.startsWith('/assets/')) urls.add(url.pathname + url.search)
  }
  return [...urls]
}

export interface RegisterSWOptions {
  /** Override for `import.meta.env.PROD` (tests only). */
  prod?: boolean
  /** Override for `'serviceWorker' in navigator` (tests only). */
  serviceWorkerSupported?: boolean
  /** Override for the iframe check (tests only). */
  isEmbedded?: () => boolean
}

/**
 * The browser only re-checks `sw.js` on navigations, and an installed, hash-routed
 * app can stay open for days without one — so also check when it comes back into view.
 */
function checkForUpdatesWhenVisible(reg: ServiceWorkerRegistration) {
  let lastCheck = Date.now()
  const onVisibilityChange = () => {
    if (document.visibilityState !== 'visible' || Date.now() - lastCheck < UPDATE_CHECK_INTERVAL_MS) return
    lastCheck = Date.now()
    reg.update().catch(() => { /* offline — the next check will retry */ })
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  stopUpdateChecks = () => document.removeEventListener('visibilitychange', onVisibilityChange)
}

/**
 * Registers `/sw.js` once the page has loaded. No-ops outside production,
 * without SW support, or inside an iframe (embed pages must never take over
 * their host page's network requests). Safe to call more than once — only the
 * first call registers.
 */
export function registerSW(opts: RegisterSWOptions = {}): void {
  const prod = opts.prod ?? import.meta.env.PROD
  const supported = opts.serviceWorkerSupported ?? (typeof navigator !== 'undefined' && 'serviceWorker' in navigator)
  if (!prod || !supported || (opts.isEmbedded ?? isEmbedded)()) return
  if (registrationStarted) return
  registrationStarted = true

  // installing precaches the shell; doing that mid-load would compete with the page's own requests
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}

function register() {
  const sw = navigator.serviceWorker
  // an uncontrolled page (first visit) fetched its lazy chunks without the worker seeing them
  const firstVisit = !sw.controller

  sw.register('/sw.js').then((reg) => {
    registration = reg
    checkForUpdatesWhenVisible(reg)
    // a version was already installed and waiting before this page even registered
    if (reg.waiting && sw.controller) notifyUpdateAvailable()

    reg.addEventListener('updatefound', () => {
      const installing = reg.installing
      if (!installing) return
      installing.addEventListener('statechange', () => {
        // 'installed' + an existing controller means this is an update, not the first install
        if (installing.state === 'installed' && sw.controller) notifyUpdateAvailable()
      })
    })

    if (firstVisit) {
      // once active, hand it what this page already loaded so a reload works offline
      sw.ready.then((ready) => {
        const urls = loadedAssetUrls()
        if (urls.length) ready.active?.postMessage({ type: 'CACHE_URLS', urls })
      }).catch(() => {})
    }
  }).catch(() => { /* offline first load, blocked by an extension, etc. — not fatal */ })
}

/**
 * Subscribe to "a new version finished installing". Sticky: a subscriber that
 * arrives after the update was detected is called immediately. Returns an unsubscribe function.
 */
export function onUpdateAvailable(cb: UpdateListener): () => void {
  updateListeners.add(cb)
  if (updateReady) cb()
  return () => { updateListeners.delete(cb) }
}

/** Whether a newer build is installed and waiting to take over. */
export function isUpdateAvailable(): boolean {
  return updateReady
}

/** Tell the waiting worker to activate, then reload once it takes control. */
export function applyUpdate(): void {
  const waiting = registration?.waiting
  if (!waiting) { location.reload(); return }
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
  waiting.postMessage('SKIP_WAITING')
}

/** Test-only: clears module state between test cases. */
export function __resetForTests(): void {
  registrationStarted = false
  registration = null
  updateReady = false
  updateListeners.clear()
  stopUpdateChecks?.()
  stopUpdateChecks = null
}
