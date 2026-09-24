import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  registerSW, onUpdateAvailable, isUpdateAvailable, applyUpdate, isEmbedded, loadedAssetUrls, __resetForTests,
  UPDATE_CHECK_INTERVAL_MS,
} from './registerSW'

function fakeRegistration(waiting: unknown = null) {
  const reg = new EventTarget() as unknown as ServiceWorkerRegistration
  Object.assign(reg, { waiting, installing: null, update: vi.fn(async () => reg) })
  return reg
}

/** Overrides a read-only `document` getter for one test (restored by deleting the own property). */
function stubDocument(prop: 'readyState' | 'visibilityState', value: string) {
  Object.defineProperty(document, prop, { configurable: true, get: () => value })
}

function installFakeServiceWorker(opts: {
  controller?: unknown
  register?: ReturnType<typeof vi.fn>
  ready?: Promise<unknown>
} = {}) {
  const container = new EventTarget() as unknown as ServiceWorkerContainer
  Object.assign(container, {
    controller: opts.controller ?? null,
    register: opts.register ?? vi.fn(async () => fakeRegistration()),
    ready: opts.ready ?? new Promise(() => {}),
  })
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true })
  return container
}

const allowed = { prod: true, serviceWorkerSupported: true, isEmbedded: () => false } as const
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve() }

describe('registerSW', () => {
  const realLocation = window.location
  beforeEach(() => __resetForTests())
  afterEach(() => {
    // @ts-expect-error test cleanup of a property we defined ourselves
    delete navigator.serviceWorker
    // @ts-expect-error removes the own-property stubs, re-exposing jsdom's prototype getters
    delete document.readyState; delete document.visibilityState
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation })
    vi.restoreAllMocks()
  })

  it('waits for the load event before registering, so precaching never competes with the first page load', () => {
    const registerSpy = vi.fn(async () => fakeRegistration())
    installFakeServiceWorker({ register: registerSpy })
    stubDocument('readyState', 'interactive')
    registerSW(allowed)
    registerSW(allowed)
    expect(registerSpy).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('load'))
    expect(registerSpy).toHaveBeenCalledTimes(1)
  })

  it('re-checks for a new version when the app comes back into view after a while (installed apps rarely navigate)', async () => {
    let now = 1_000_000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const reg = fakeRegistration()
    installFakeServiceWorker({ controller: {}, register: vi.fn(async () => reg) })
    registerSW(allowed)
    await flush()

    stubDocument('visibilityState', 'visible')
    now += UPDATE_CHECK_INTERVAL_MS / 2
    document.dispatchEvent(new Event('visibilitychange'))
    expect(reg.update).not.toHaveBeenCalled() // checked recently: don't hammer the server on every tab switch

    now += UPDATE_CHECK_INTERVAL_MS
    stubDocument('visibilityState', 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(reg.update).not.toHaveBeenCalled() // only on becoming visible

    stubDocument('visibilityState', 'visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(reg.update).toHaveBeenCalledTimes(1)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(reg.update).toHaveBeenCalledTimes(1)
  })

  it('a failing update check is swallowed', async () => {
    let now = 0
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    const reg = fakeRegistration()
    ;(reg as any).update = vi.fn(async () => { throw new TypeError('offline') })
    installFakeServiceWorker({ controller: {}, register: vi.fn(async () => reg) })
    registerSW(allowed)
    await flush()
    stubDocument('visibilityState', 'visible')
    now += UPDATE_CHECK_INTERVAL_MS
    document.dispatchEvent(new Event('visibilitychange'))
    await flush()
    expect(reg.update).toHaveBeenCalledTimes(1)
  })

  it('does nothing outside production — including by default under vitest (import.meta.env.PROD is false)', () => {
    const container = installFakeServiceWorker()
    registerSW({ prod: false, serviceWorkerSupported: true, isEmbedded: () => false })
    registerSW()
    expect(container.register).not.toHaveBeenCalled()
  })

  it('does nothing without serviceWorker support', () => {
    const registerSpy = vi.fn()
    installFakeServiceWorker({ register: registerSpy })
    registerSW({ prod: true, serviceWorkerSupported: false, isEmbedded: () => false })
    expect(registerSpy).not.toHaveBeenCalled()
  })

  it('does nothing inside an iframe (embed pages)', () => {
    const registerSpy = vi.fn()
    installFakeServiceWorker({ register: registerSpy })
    registerSW({ prod: true, serviceWorkerSupported: true, isEmbedded: () => true })
    expect(registerSpy).not.toHaveBeenCalled()
  })

  it('registers /sw.js exactly once when allowed, even if called again', () => {
    const registerSpy = vi.fn(async () => fakeRegistration())
    installFakeServiceWorker({ register: registerSpy })
    registerSW(allowed)
    registerSW(allowed)
    expect(registerSpy).toHaveBeenCalledTimes(1)
    expect(registerSpy).toHaveBeenCalledWith('/sw.js')
  })

  it('swallows a failed registration (offline first load, blocked by an extension)', async () => {
    installFakeServiceWorker({ register: vi.fn(async () => { throw new Error('blocked') }) })
    registerSW(allowed)
    await flush()
    expect(isUpdateAvailable()).toBe(false)
  })

  it('signals an update when a waiting worker exists at registration time and a controller is active', async () => {
    const reg = fakeRegistration({})
    installFakeServiceWorker({ controller: {}, register: vi.fn(async () => reg) })
    const cb = vi.fn()
    onUpdateAvailable(cb)
    registerSW(allowed)
    await flush()
    expect(cb).toHaveBeenCalledTimes(1)
    expect(isUpdateAvailable()).toBe(true)
  })

  it('replays the update signal to a subscriber that arrives after it fired (e.g. a late-mounted banner)', async () => {
    installFakeServiceWorker({ controller: {}, register: vi.fn(async () => fakeRegistration({})) })
    registerSW(allowed)
    await flush()
    const late = vi.fn()
    const unsubscribe = onUpdateAvailable(late)
    expect(late).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('signals an update when a newly installed worker finishes installing over an existing controller', async () => {
    const reg = fakeRegistration(null)
    installFakeServiceWorker({ controller: {}, register: vi.fn(async () => reg) })
    const cb = vi.fn()
    onUpdateAvailable(cb)
    registerSW(allowed)
    await flush()

    const installing = new EventTarget() as any
    installing.state = 'installing'
    ;(reg as any).installing = installing
    reg.dispatchEvent(new Event('updatefound'))
    installing.state = 'installed'
    installing.dispatchEvent(new Event('statechange'))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('does not signal an update on the very first install (no existing controller)', async () => {
    const reg = fakeRegistration(null)
    installFakeServiceWorker({ controller: null, register: vi.fn(async () => reg) })
    const cb = vi.fn()
    onUpdateAvailable(cb)
    registerSW(allowed)
    await flush()

    const installing = new EventTarget() as any
    installing.state = 'installing'
    ;(reg as any).installing = installing
    reg.dispatchEvent(new Event('updatefound'))
    installing.state = 'installed'
    installing.dispatchEvent(new Event('statechange'))
    expect(cb).not.toHaveBeenCalled()
    expect(isUpdateAvailable()).toBe(false)
  })

  it('on a first (uncontrolled) visit, hands the worker the /assets/ files already loaded so they work offline', async () => {
    const active = { postMessage: vi.fn() }
    installFakeServiceWorker({ controller: null, ready: Promise.resolve({ active }) })
    vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
      { name: `${location.origin}/assets/lazy-a.js` },
      { name: 'https://fonts.gstatic.com/assets/x.woff2' },
    ] as PerformanceEntry[])
    registerSW(allowed)
    await flush()
    expect(active.postMessage).toHaveBeenCalledWith({ type: 'CACHE_URLS', urls: ['/assets/lazy-a.js'] })
  })

  it('does not re-send loaded assets when the page is already controlled (its fetches already went through the worker)', async () => {
    const active = { postMessage: vi.fn() }
    installFakeServiceWorker({ controller: {}, ready: Promise.resolve({ active }) })
    registerSW(allowed)
    await flush()
    expect(active.postMessage).not.toHaveBeenCalled()
  })

  it('applyUpdate posts SKIP_WAITING to the waiting worker and reloads on controllerchange', async () => {
    const waiting = { postMessage: vi.fn() }
    const reg = fakeRegistration(waiting)
    const container = installFakeServiceWorker({ controller: {}, register: vi.fn(async () => reg) })
    registerSW(allowed)
    await flush()

    // jsdom's `location.reload` is non-configurable, so swap the whole object (restored in afterEach)
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } })

    applyUpdate()
    expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING')
    expect(reload).not.toHaveBeenCalled()

    container.dispatchEvent(new Event('controllerchange'))
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('applyUpdate just reloads when there is no waiting worker any more (another tab activated it)', async () => {
    installFakeServiceWorker({ controller: {}, register: vi.fn(async () => fakeRegistration(null)) })
    registerSW(allowed)
    await flush()
    const reload = vi.fn()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...realLocation, reload } })
    applyUpdate()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})

describe('isEmbedded', () => {
  it('is false for a top-level window', () => {
    const win = {} as Window
    Object.assign(win, { self: win, top: win })
    expect(isEmbedded(win)).toBe(false)
  })

  it('is true inside a same-origin iframe', () => {
    const win = {} as Window
    Object.assign(win, { self: win, top: {} })
    expect(isEmbedded(win)).toBe(true)
  })

  it('is true when reading `top` throws (cross-origin frame)', () => {
    const win = {} as Window
    Object.defineProperty(win, 'self', { value: win })
    Object.defineProperty(win, 'top', { get: () => { throw new DOMException('blocked', 'SecurityError') } })
    expect(isEmbedded(win)).toBe(true)
  })

  it('is false in this (top-level) jsdom window', () => {
    expect(isEmbedded()).toBe(false)
  })
})

describe('loadedAssetUrls', () => {
  it('keeps same-origin /assets/ paths once each and drops everything else', () => {
    const entries = [
      { name: 'https://app.test/assets/a.js' },
      { name: 'https://app.test/assets/a.js' },
      { name: 'https://app.test/assets/b.css?x=1' },
      { name: 'https://app.test/blog/_manifest.json' },
      { name: 'https://cdn.test/assets/c.js' },
      { name: 'not a url' },
    ] as PerformanceEntry[]
    expect(loadedAssetUrls(entries, 'https://app.test')).toEqual(['/assets/a.js', '/assets/b.css?x=1'])
  })
})
