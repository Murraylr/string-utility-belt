// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  buildPrecacheList, hashAssetList, buildServiceWorkerSource, checkBuildOutput, fingerprintPrecache, pwaServiceWorker,
  CACHE_PREFIX, type ChunkInfo,
} from './vite-plugin-pwa'

// ---------------------------------------------------------------------------
// buildPrecacheList — pure
// ---------------------------------------------------------------------------

describe('buildPrecacheList', () => {
  const chunks: ChunkInfo[] = [
    { fileName: 'assets/main-abc.js', isEntry: true, imports: ['assets/vendor-def.js'], css: ['assets/main-xyz.css'] },
    { fileName: 'assets/vendor-def.js', isEntry: false, imports: [], css: ['assets/vendor.css'] },
    // reachable only via a dynamic import from the entry — must be excluded
    { fileName: 'assets/lazy-hash1.js', isEntry: false, imports: ['assets/vendor-def.js'], css: ['assets/lazy.css'] },
  ]

  it('includes the entry chunk, its static (transitive) imports, and their CSS', () => {
    const list = buildPrecacheList(chunks, [])
    expect(list.sort()).toEqual(['/assets/main-abc.js', '/assets/main-xyz.css', '/assets/vendor-def.js', '/assets/vendor.css'])
  })

  it('excludes chunks that are never statically imported (the lazy utility chunks) and their CSS', () => {
    const list = buildPrecacheList(chunks, [])
    expect(list).not.toContain('/assets/lazy-hash1.js')
    expect(list).not.toContain('/assets/lazy.css')
  })

  it('merges in the static extras (index.html, manifest, icons) without duplicating', () => {
    const list = buildPrecacheList(chunks, ['/index.html', '/index.html', '/manifest.webmanifest'])
    expect(list.filter((u) => u === '/index.html')).toHaveLength(1)
    expect(list).toContain('/manifest.webmanifest')
  })

  it('includes files a reachable chunk references by URL (the module worker) but does not follow them', () => {
    const withWorker: ChunkInfo[] = [
      { fileName: 'assets/main-abc.js', isEntry: true, imports: [], css: [], assets: ['assets/pipeline.worker-w.js'] },
      { fileName: 'assets/lazy-hash1.js', isEntry: false, imports: [], css: [], assets: ['assets/lazy-only.png'] },
    ]
    const list = buildPrecacheList(withWorker, [])
    expect(list).toContain('/assets/pipeline.worker-w.js')
    expect(list).not.toContain('/assets/lazy-only.png')
  })

  it('handles multiple entry chunks and import cycles', () => {
    const multi: ChunkInfo[] = [
      { fileName: 'assets/a.js', isEntry: true, imports: ['assets/c.js'], css: [] },
      { fileName: 'assets/b.js', isEntry: true, imports: [], css: [] },
      { fileName: 'assets/c.js', isEntry: false, imports: ['assets/a.js'], css: [] },
    ]
    expect(buildPrecacheList(multi, []).sort()).toEqual(['/assets/a.js', '/assets/b.js', '/assets/c.js'])
  })
})

// ---------------------------------------------------------------------------
// hashAssetList / fingerprintPrecache — pure
// ---------------------------------------------------------------------------

describe('hashAssetList', () => {
  it('is deterministic and order-independent', () => {
    expect(hashAssetList(['/a.js', '/b.js'])).toBe(hashAssetList(['/b.js', '/a.js']))
  })

  it('changes when the asset list changes', () => {
    expect(hashAssetList(['/a.js'])).not.toBe(hashAssetList(['/a.js', '/c.js']))
  })
})

describe('fingerprintPrecache', () => {
  const read = (contents: Record<string, string>) => (url: string) => contents[url]

  it('leaves hashed /assets/ URLs alone and folds the content of unhashed files into the version input', () => {
    const list = ['/index.html', '/assets/main-abc.js']
    const a = fingerprintPrecache(list, read({ '/index.html': '<html>v1</html>' }))
    const b = fingerprintPrecache(list, read({ '/index.html': '<html>v2</html>' }))
    expect(a).toContain('/assets/main-abc.js')
    expect(a).not.toEqual(b)
    // an HTML/manifest/icon-only change must still produce a new cache version (and a new sw.js)
    expect(hashAssetList(a)).not.toBe(hashAssetList(b))
  })

  it('reports unhashed precache entries it cannot find', () => {
    expect(() => fingerprintPrecache(['/icons/gone.png'], read({}))).toThrow(/\/icons\/gone\.png/)
  })
})

// ---------------------------------------------------------------------------
// buildServiceWorkerSource — evaluated against a fake ServiceWorkerGlobalScope
// (real WHATWG Request/Response from Node; only Cache Storage is faked)
// ---------------------------------------------------------------------------

const ORIGIN = 'https://example.com'

function res(body: string, init: ResponseInit & { redirected?: boolean; url?: string } = {}) {
  const response = new Response(body, { status: init.status ?? 200, headers: init.headers })
  if (init.redirected) Object.defineProperty(response, 'redirected', { value: true })
  if (init.url) Object.defineProperty(response, 'url', { value: init.url })
  return response
}

function createFakeCaches() {
  const stores = new Map<string, Map<string, Response>>()
  const key = (reqOrUrl: RequestInfo | URL) =>
    new URL(typeof reqOrUrl === 'string' || reqOrUrl instanceof URL ? reqOrUrl : reqOrUrl.url, ORIGIN).href
  const cacheHandle = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map())
    const store = stores.get(name)!
    return {
      match: async (reqOrUrl: RequestInfo) => store.get(key(reqOrUrl))?.clone(),
      put: async (reqOrUrl: RequestInfo, response: Response) => {
        if (response.bodyUsed) throw new TypeError('body already used')
        store.set(key(reqOrUrl), response)
      },
      keys: async () => [...store.keys()].map((url) => new Request(url)),
    }
  }
  return {
    open: async (name: string) => cacheHandle(name),
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (reqOrUrl: RequestInfo) => {
      for (const store of stores.values()) {
        const hit = store.get(key(reqOrUrl))
        if (hit) return hit.clone()
      }
      return undefined
    },
    _stores: stores,
  }
}

type FetchImpl = (req: Request) => Promise<Response>

function createHarness(source: string, opts: { fetchImpl?: FetchImpl } = {}) {
  const listeners: Record<string, Array<(e: any) => any>> = {}
  const selfObj: any = {
    location: new URL(`${ORIGIN}/sw.js`),
    addEventListener: (type: string, fn: (e: any) => any) => { (listeners[type] ??= []).push(fn) },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  }
  const caches = createFakeCaches()
  const fetchImpl: FetchImpl = opts.fetchImpl ?? (async (req) => res(`net:${req.url}`, { url: req.url }))
  const fetchFn = vi.fn(async (input: RequestInfo) => {
    const req = typeof input === 'string' ? new Request(new URL(input, ORIGIN)) : input
    return fetchImpl(req)
  })

  // inside a worker, relative URLs resolve against the worker's location
  class SWRequest extends Request {
    constructor(input: RequestInfo | URL, init?: RequestInit) {
      super(typeof input === 'string' ? new URL(input, selfObj.location) : input, init)
    }
  }
  new Function('self', 'caches', 'fetch', 'Request', source)(selfObj, caches, fetchFn, SWRequest)

  /** Dispatches an extendable/fetch event and resolves once every waitUntil/respondWith promise settles. */
  const dispatch = async (type: string, init: Record<string, unknown> = {}) => {
    const pending: Promise<unknown>[] = []
    let responded: Promise<Response> | undefined
    const event = {
      ...init,
      waitUntil: (p: Promise<unknown>) => { pending.push(p) },
      respondWith: (p: Promise<Response>) => { responded = Promise.resolve(p); pending.push(responded) },
    }
    for (const fn of listeners[type] ?? []) fn(event)
    // settle in rounds: waitUntil may be called again while earlier promises are pending
    const settled: PromiseSettledResult<unknown>[] = []
    for (let seen = 0; seen < pending.length;) {
      const batch = pending.slice(seen)
      seen = pending.length
      settled.push(...await Promise.allSettled(batch))
    }
    return { response: responded, intercepted: responded !== undefined, settled }
  }

  const fetchEvent = (url: string, init: RequestInit & { mode?: string } = {}) => {
    const { mode, ...rest } = init
    const request = new Request(new URL(url, ORIGIN), rest)
    // Node's Request rejects mode: 'navigate' in the constructor; the SW only reads it
    if (mode) Object.defineProperty(request, 'mode', { value: mode })
    return dispatch('fetch', { request })
  }

  const cached = async (url: string) => (await caches.open(cacheNameOf(source))).match(url)
  return { self: selfObj, caches, fetchFn, dispatch, fetchEvent, cached }
}

function cacheNameOf(source: string) {
  return JSON.parse(source.match(/const CACHE_NAME = (".*?");/)![1]) as string
}

const offline: FetchImpl = async () => { throw new TypeError('Failed to fetch') }

describe('generated sw.js (fake ServiceWorkerGlobalScope)', () => {
  const precache = ['/index.html', '/assets/main.js', '/manifest.webmanifest', '/icons/icon-192.png']
  const source = buildServiceWorkerSource(precache)
  const cacheName = `${CACHE_PREFIX}${hashAssetList(precache)}`

  it('names the cache after the given version (defaults to a hash of the precache list)', () => {
    expect(cacheNameOf(source)).toBe(cacheName)
    expect(cacheNameOf(buildServiceWorkerSource(precache, { version: 'v42' }))).toBe(`${CACHE_PREFIX}v42`)
  })

  it('install precaches every URL under the versioned cache name; unhashed files bypass the HTTP cache', async () => {
    const h = createHarness(source)
    await h.dispatch('install')
    for (const url of precache) expect(await h.cached(url)).toBeTruthy()
    const modes = Object.fromEntries(h.fetchFn.mock.calls.map(([req]) => [new URL((req as Request).url).pathname, (req as Request).cache]))
    // a stale HTTP-cached index.html/manifest/icon must not outlive a deploy…
    expect(modes['/index.html']).toBe('reload')
    expect(modes['/manifest.webmanifest']).toBe('reload')
    expect(modes['/icons/icon-192.png']).toBe('reload')
    // …but content-hashed files are immutable: re-downloading the entry chunk the page just loaded is waste
    expect(modes['/assets/main.js']).toBe('default')
  })

  it('install fails (so the old worker stays in charge) when a precache URL is not ok', async () => {
    const h = createHarness(source, {
      fetchImpl: async (req) => res('nope', { status: req.url.endsWith('/assets/main.js') ? 404 : 200 }),
    })
    // a rejected waitUntil promise is what makes the browser discard the install
    const { settled } = await h.dispatch('install')
    expect(settled.some((s) => s.status === 'rejected')).toBe(true)
  })

  it('stores a redirect-free app shell even when the host 307s /index.html → / (Cloudflare does)', async () => {
    const h = createHarness(source, {
      fetchImpl: async (req) => req.url.endsWith('/index.html')
        ? res('<html>shell</html>', { redirected: true, url: `${ORIGIN}/`, headers: { 'content-type': 'text/html' } })
        : res(`net:${req.url}`),
    })
    await h.dispatch('install')
    const shell = await h.cached('/index.html')
    expect(shell).toBeTruthy()
    // a redirected response used for a navigation is turned into a network error by the browser
    expect(shell!.redirected).toBe(false)
    expect(shell!.headers.get('content-type')).toBe('text/html')
    expect(await shell!.text()).toBe('<html>shell</html>')
  })

  it('activate deletes old subelt-precache-* caches but leaves unrelated caches and the current one', async () => {
    const h = createHarness(source)
    h.caches._stores.set(`${CACHE_PREFIX}old-hash`, new Map())
    h.caches._stores.set(cacheName, new Map())
    h.caches._stores.set('some-other-cache', new Map())
    await h.dispatch('activate')
    const names = await h.caches.keys()
    expect(names).not.toContain(`${CACHE_PREFIX}old-hash`)
    expect(names).toContain(cacheName)
    expect(names).toContain('some-other-cache')
    expect(h.self.clients.claim).toHaveBeenCalled()
  })

  it('skipWaiting fires only on a SKIP_WAITING message', async () => {
    const h = createHarness(source)
    await h.dispatch('message', { data: 'SOMETHING_ELSE' })
    await h.dispatch('message', { data: { type: 'SKIP_WAITING' } })
    expect(h.self.skipWaiting).not.toHaveBeenCalled()
    await h.dispatch('message', { data: 'SKIP_WAITING' })
    expect(h.self.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('leaves cross-origin requests untouched (analytics, fonts)', async () => {
    const h = createHarness(source)
    for (const url of ['https://static.cloudflareinsights.com/beacon.min.js', 'https://fonts.gstatic.com/s/x.woff2', 'https://evil.example/assets/x.js']) {
      const { intercepted } = await h.fetchEvent(url, { mode: 'no-cors' })
      expect(intercepted).toBe(false)
    }
    expect(h.fetchFn).not.toHaveBeenCalled()
  })

  it('routes /api/* as network-only and never caches it', async () => {
    const h = createHarness(source)
    const { response } = await h.fetchEvent('/api/run')
    expect(await (await response)!.text()).toBe(`net:${ORIGIN}/api/run`)
    expect(await h.caches.match(`${ORIGIN}/api/run`)).toBeUndefined()

    const off = createHarness(source, { fetchImpl: offline })
    await off.dispatch('install') // even with a warm cache it must not answer from it
    const failed = await off.fetchEvent('/api/run')
    await expect(failed.response).rejects.toThrow()
  })

  it('navigations use the live network response when online', async () => {
    const h = createHarness(source)
    const { response } = await h.fetchEvent('/?text=hi', { mode: 'navigate' })
    expect(await (await response)!.text()).toBe(`net:${ORIGIN}/?text=hi`)
  })

  it('navigations fall back to the cached app shell when offline (any path, incl. share-target URLs)', async () => {
    let online = true
    const h = createHarness(source, {
      fetchImpl: async (req) => {
        if (!online) throw new TypeError('Failed to fetch')
        return req.url.endsWith('/index.html') ? res('<html>shell</html>', { redirected: true }) : res('x')
      },
    })
    await h.dispatch('install')
    online = false
    for (const url of ['/', '/?text=shared', '/blog/some-post', '/util/base64_encode/']) {
      const { response } = await h.fetchEvent(url, { mode: 'navigate' })
      const shell = (await response)!
      expect(shell.redirected).toBe(false)
      expect(await shell.text()).toBe('<html>shell</html>')
    }
  })

  it('offline navigation with nothing cached yields a network error, not a thrown TypeError', async () => {
    const h = createHarness(source, { fetchImpl: offline })
    const { response } = await h.fetchEvent('/', { mode: 'navigate' })
    const r = (await response)!
    expect(r.type).toBe('error')
  })

  it('/assets/* is cache-first: a hit skips the network, a miss fetches and caches it', async () => {
    const h = createHarness(source)
    await (await h.caches.open(cacheName)).put(`${ORIGIN}/assets/cached.js`, res('from-cache'))
    const hit = await h.fetchEvent('/assets/cached.js')
    expect(await (await hit.response)!.text()).toBe('from-cache')
    expect(h.fetchFn).not.toHaveBeenCalled()

    const miss = await h.fetchEvent('/assets/new.js')
    expect(await (await miss.response)!.text()).toBe(`net:${ORIGIN}/assets/new.js`)
    expect(h.fetchFn).toHaveBeenCalledTimes(1)
    expect(await (await h.cached('/assets/new.js'))!.text()).toBe(`net:${ORIGIN}/assets/new.js`)
  })

  it('/assets/* never caches an error response (a 404 must not be pinned forever)', async () => {
    const h = createHarness(source, { fetchImpl: async () => res('not found', { status: 404 }) })
    const { response } = await h.fetchEvent('/assets/gone.js')
    expect((await response)!.status).toBe(404)
    expect(await h.cached('/assets/gone.js')).toBeUndefined()
  })

  it('never stores an HTML page served in place of a missing file (the host\'s SPA fallback answers 200 with index.html)', async () => {
    const html = async () => res('<!doctype html><div id="root"></div>', { headers: { 'content-type': 'text/html; charset=utf-8' } })
    const h = createHarness(source, { fetchImpl: html })
    // e.g. a chunk requested mid-deploy, before the edge has it — pinning the HTML would break that utility until the next release
    const asset = await h.fetchEvent('/assets/not-yet-deployed.js')
    expect((await asset.response)!.status).toBe(200)
    expect(await h.cached('/assets/not-yet-deployed.js')).toBeUndefined()

    await h.fetchEvent('/blog/no-such-post.md')
    expect(await h.cached('/blog/no-such-post.md')).toBeUndefined()

    await h.dispatch('message', { data: { type: 'CACHE_URLS', urls: ['/assets/also-missing.js'] } })
    expect(await h.cached('/assets/also-missing.js')).toBeUndefined()
  })

  it('activate carries still-current runtime-cached /assets/ files over from the old cache before deleting it', async () => {
    const withAssets = buildServiceWorkerSource(precache, { version: 'v2', assets: ['/assets/main.js', '/assets/util-kept.js'] })
    const h = createHarness(withAssets)
    const old = `${CACHE_PREFIX}v1`
    const oldCache = await h.caches.open(old)
    await oldCache.put(`${ORIGIN}/assets/util-kept.js`, res('kept'))   // same content hash in the new build
    await oldCache.put(`${ORIGIN}/assets/util-gone.js`, res('gone'))   // no longer part of the build
    await oldCache.put(`${ORIGIN}/blog/a.md`, res('post'))              // not an immutable asset
    await h.dispatch('activate')

    expect(await h.caches.keys()).not.toContain(old)
    // a utility used before the update keeps working offline after it
    expect(await (await h.cached('/assets/util-kept.js'))!.text()).toBe('kept')
    expect(await h.cached('/assets/util-gone.js')).toBeUndefined()
    expect(await h.cached('/blog/a.md')).toBeUndefined()
    expect(h.fetchFn).not.toHaveBeenCalled()
  })

  it('serves precached non-asset files (manifest, icons) from the cache when offline', async () => {
    let online = true
    const h = createHarness(source, {
      fetchImpl: async (req) => { if (!online) throw new TypeError('offline'); return res(`net:${new URL(req.url).pathname}`) },
    })
    await h.dispatch('install')
    online = false
    for (const url of ['/manifest.webmanifest', '/icons/icon-192.png']) {
      const { response, intercepted } = await h.fetchEvent(url)
      expect(intercepted).toBe(true)
      expect(await (await response)!.text()).toBe(`net:${url}`)
    }
  })

  it('/blog/* is stale-while-revalidate: serves the cached copy immediately and refreshes it', async () => {
    const h = createHarness(source)
    await (await h.caches.open(cacheName)).put(`${ORIGIN}/blog/a-post.md`, res('stale'))
    const { response } = await h.fetchEvent('/blog/a-post.md')
    expect(await (await response)!.text()).toBe('stale')
    expect(h.fetchFn).toHaveBeenCalledTimes(1)
    expect(await (await h.cached('/blog/a-post.md'))!.text()).toBe(`net:${ORIGIN}/blog/a-post.md`)
  })

  it('/guides/* (utility guides) is stale-while-revalidate too, so a visited guide reads offline', async () => {
    const h = createHarness(source)
    await (await h.caches.open(cacheName)).put(`${ORIGIN}/guides/base64_encode.md`, res('stale'))
    const { response } = await h.fetchEvent('/guides/base64_encode.md')
    expect(await (await response)!.text()).toBe('stale')
    expect(await (await h.cached('/guides/base64_encode.md'))!.text()).toBe(`net:${ORIGIN}/guides/base64_encode.md`)
  })

  it('/blog/* falls back to the network when nothing is cached yet, and survives a failed refresh', async () => {
    const h = createHarness(source)
    const { response } = await h.fetchEvent('/blog/new-post.md')
    expect(await (await response)!.text()).toBe(`net:${ORIGIN}/blog/new-post.md`)

    const off = createHarness(source, { fetchImpl: offline })
    await (await off.caches.open(cacheName)).put(`${ORIGIN}/blog/_manifest.json`, res('[]'))
    const stale = await off.fetchEvent('/blog/_manifest.json')
    expect(await (await stale.response)!.text()).toBe('[]')
  })

  it('ignores non-GET requests entirely', async () => {
    const h = createHarness(source)
    const { intercepted } = await h.fetchEvent('/api/run', { method: 'POST', body: 'x' })
    expect(intercepted).toBe(false)
  })

  it('CACHE_URLS warms the cache with same-origin /assets/ files the page loaded before the worker took control', async () => {
    const h = createHarness(source)
    await h.dispatch('message', {
      data: {
        type: 'CACHE_URLS',
        urls: ['/assets/lazy-a.js', `${ORIGIN}/assets/lazy-b.js`, 'https://evil.example/assets/x.js', '/api/secret', '/index.html', 42, 'http://[bad'],
      },
    })
    expect(await h.cached('/assets/lazy-a.js')).toBeTruthy()
    expect(await h.cached('/assets/lazy-b.js')).toBeTruthy()
    const fetched = h.fetchFn.mock.calls.map(([r]) => (typeof r === 'string' ? r : r.url))
    expect(fetched.sort()).toEqual([`${ORIGIN}/assets/lazy-a.js`, `${ORIGIN}/assets/lazy-b.js`])
  })

  // security review: browsers only deliver same-origin client messages to a service
  // worker, but the handler still refuses anything that says it came from elsewhere
  it('ignores SKIP_WAITING and CACHE_URLS messages from another origin', async () => {
    const h = createHarness(source)
    await h.dispatch('message', { data: 'SKIP_WAITING', origin: 'https://evil.example' })
    await h.dispatch('message', { data: { type: 'CACHE_URLS', urls: ['/assets/lazy-a.js'] }, origin: 'https://evil.example' })
    expect(h.self.skipWaiting).not.toHaveBeenCalled()
    expect(h.fetchFn).not.toHaveBeenCalled()
    await h.dispatch('message', { data: 'SKIP_WAITING', origin: ORIGIN })
    expect(h.self.skipWaiting).toHaveBeenCalledTimes(1)
  })

  it('CACHE_URLS skips files that are already cached', async () => {
    const h = createHarness(source)
    await (await h.caches.open(cacheName)).put(`${ORIGIN}/assets/have.js`, res('have'))
    await h.dispatch('message', { data: { type: 'CACHE_URLS', urls: ['/assets/have.js'] } })
    expect(h.fetchFn).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// public/manifest.webmanifest — the installability + share-target contract
// ---------------------------------------------------------------------------

describe('public/manifest.webmanifest', () => {
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../public/manifest.webmanifest'), 'utf8'))

  it('is installable as a standalone app scoped to the whole site', () => {
    expect(manifest).toMatchObject({
      id: '/', name: 'String Utility Belt', short_name: 'Utility Belt', start_url: '/', scope: '/', display: 'standalone',
    })
    expect(manifest.description).toEqual(expect.any(String))
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/i)
    expect(manifest.theme_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('registers a GET share target on / whose params useShareTarget reads', () => {
    expect(manifest.share_target).toEqual({ action: '/', method: 'GET', params: { title: 'title', text: 'text', url: 'url' } })
  })

  it('offers Utilities and Blog shortcuts that stay inside the scope', () => {
    const byName = Object.fromEntries(manifest.shortcuts.map((s: { name: string; url: string }) => [s.name, s.url]))
    expect(byName).toEqual({ Utilities: '/#/utilities', Blog: '/#/blog' })
  })
})

// ---------------------------------------------------------------------------
// pwaServiceWorker — the plugin's hooks against a fake Rollup bundle
// ---------------------------------------------------------------------------

const PUBLIC_FILES = {
  'manifest.webmanifest': '{}',
  'icons/icon-192.png': 'a', 'icons/icon-512.png': 'b', 'icons/icon-maskable-512.png': 'c', 'icons/apple-touch-icon.png': 'd',
}

function fakeChunk(fileName: string, o: { isEntry?: boolean; imports?: string[]; dynamicImports?: string[]; css?: string[]; code?: string } = {}) {
  return {
    type: 'chunk', fileName, isEntry: !!o.isEntry, imports: o.imports ?? [], dynamicImports: o.dynamicImports ?? [],
    code: o.code ?? '', viteMetadata: { importedCss: new Set(o.css ?? []), importedAssets: new Set<string>() },
  }
}
const fakeAsset = (fileName: string, source: string) => ({ type: 'asset', fileName, source })

/** A bundle shaped like the real one: an entry, a vendor chunk, a lazy utility chunk and a module worker. */
function fakeBundle(html = '<html>v1</html>') {
  return {
    'index.html': fakeAsset('index.html', html),
    'assets/index-a.js': fakeChunk('assets/index-a.js', {
      isEntry: true, imports: ['assets/vendor-b.js'], dynamicImports: ['assets/util-c.js'], css: ['assets/index-d.css'],
      code: 'new Worker(new URL("/assets/pipeline.worker-e.js", import.meta.url), { type: "module" })',
    }),
    'assets/vendor-b.js': fakeChunk('assets/vendor-b.js'),
    'assets/util-c.js': fakeChunk('assets/util-c.js'),
    'assets/index-d.css': fakeAsset('assets/index-d.css', 'body{}'),
    // Vite emits a worker's own bundle as plain assets
    'assets/pipeline.worker-e.js': fakeAsset('assets/pipeline.worker-e.js', 'import("./w-lazy-f.js")'),
    'assets/w-lazy-f.js': fakeAsset('assets/w-lazy-f.js', 'export default 1'),
  }
}

function runPlugin(bundle: Record<string, unknown>, publicFiles: Record<string, string> = PUBLIC_FILES) {
  const publicDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-public-'))
  try {
    writeFixture(publicDir, publicFiles)
    const plugin = pwaServiceWorker()
    ;(plugin.configResolved as (c: unknown) => void)({ publicDir })
    const emitted: Array<{ fileName: string; source: string }> = []
    const ctx = { emitFile: (f: { fileName: string; source: string }) => emitted.push(f), error: (m: string) => { throw new Error(m) } }
    ;(plugin.generateBundle as (this: unknown, o: unknown, b: unknown) => void).call(ctx, {}, bundle)
    const sw = emitted.find((f) => f.fileName === 'sw.js')!
    const precache: string[] = JSON.parse(sw.source.match(/const PRECACHE_URLS = (\[[\s\S]*?\]);/)![1])
    return { sw: sw.source, precache }
  } finally {
    fs.rmSync(publicDir, { recursive: true, force: true })
  }
}

describe('pwaServiceWorker plugin', () => {
  it('only applies to client production builds (not dev, vitest, or SSR builds)', () => {
    const apply = pwaServiceWorker().apply as (c: unknown, env: { command: string; mode: string; isSsrBuild?: boolean }) => boolean
    expect(apply({}, { command: 'build', mode: 'production' })).toBe(true)
    expect(apply({}, { command: 'serve', mode: 'development' })).toBe(false)
    expect(apply({}, { command: 'build', mode: 'production', isSsrBuild: true })).toBe(false)
  })

  it('emits sw.js precaching the shell, entry + static imports, their CSS and the module worker — not lazy chunks', () => {
    const { precache } = runPlugin(fakeBundle())
    expect(precache).toEqual(expect.arrayContaining([
      '/index.html', '/manifest.webmanifest', '/icons/icon-192.png',
      '/assets/index-a.js', '/assets/vendor-b.js', '/assets/index-d.css', '/assets/pipeline.worker-e.js',
    ]))
    expect(precache).not.toContain('/assets/util-c.js')
    expect(precache).not.toContain('/assets/w-lazy-f.js')
  })

  it('lists every emitted /assets/ file so activate can keep still-current cached chunks', () => {
    const { sw } = runPlugin(fakeBundle())
    const assets: string[] = JSON.parse(sw.match(/const BUILD_ASSETS = (\[[\s\S]*?\]);/)![1])
    expect(assets.sort()).toEqual([
      '/assets/index-a.js', '/assets/index-d.css', '/assets/pipeline.worker-e.js', '/assets/util-c.js', '/assets/vendor-b.js', '/assets/w-lazy-f.js',
    ])
  })

  it('changes the cache version when only index.html changes (same asset names)', () => {
    expect(cacheNameOf(runPlugin(fakeBundle('<html>v1</html>')).sw)).not.toBe(cacheNameOf(runPlugin(fakeBundle('<html>v2</html>')).sw))
  })

  it('fails the build when a precached public file is missing', () => {
    const rest: Record<string, string> = { ...PUBLIC_FILES }
    delete rest['icons/icon-512.png']
    expect(() => runPlugin(fakeBundle(), rest)).toThrow(/\/icons\/icon-512\.png/)
  })
})

// ---------------------------------------------------------------------------
// checkBuildOutput — fixtures, plus an opt-in real `vite build`
// ---------------------------------------------------------------------------

function writeFixture(dir: string, files: Record<string, string>) {
  for (const [rel, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true })
    fs.writeFileSync(path.join(dir, rel), content)
  }
}

const MANIFEST = JSON.stringify({
  icons: [{ src: '/icons/icon-192.png' }, { src: '/icons/icon-512.png' }, { src: '/icons/icon-maskable-512.png' }],
})

describe('checkBuildOutput', () => {
  it('flags missing precache entries and missing manifest/icons', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-check-'))
    try {
      writeFixture(dir, { 'sw.js': buildServiceWorkerSource(['/index.html', '/missing.js']), 'index.html': '<html></html>' })
      const result = checkBuildOutput(dir)
      expect(result.ok).toBe(false)
      expect(result.missing).toContain('/missing.js')
      expect(result.missing).toContain('/manifest.webmanifest')
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('flags a listed build asset that is not on disk', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-check-'))
    try {
      writeFixture(dir, {
        'sw.js': buildServiceWorkerSource(['/index.html'], { assets: ['/assets/here.js', '/assets/gone.js'] }),
        'index.html': '<html></html>', 'assets/here.js': '',
        'manifest.webmanifest': MANIFEST,
        'icons/icon-192.png': '', 'icons/icon-512.png': '', 'icons/icon-maskable-512.png': '',
      })
      expect(checkBuildOutput(dir).missing).toEqual(['/assets/gone.js'])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('flags an icon the manifest references but the build lacks', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-check-'))
    try {
      writeFixture(dir, {
        'sw.js': buildServiceWorkerSource(['/index.html']),
        'index.html': '<html></html>',
        'manifest.webmanifest': JSON.stringify({ icons: [{ src: '/icons/icon-192.png' }, { src: '/icons/extra.png' }] }),
        'icons/icon-192.png': '', 'icons/icon-512.png': '', 'icons/icon-maskable-512.png': '',
      })
      expect(checkBuildOutput(dir).missing).toEqual(['/icons/extra.png'])
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reports ok when every precache entry and required static file exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-check-'))
    try {
      writeFixture(dir, {
        'sw.js': buildServiceWorkerSource(['/index.html', '/assets/a.js']),
        'index.html': '<html></html>', 'assets/a.js': '',
        'manifest.webmanifest': MANIFEST,
        'icons/icon-192.png': '', 'icons/icon-512.png': '', 'icons/icon-maskable-512.png': '',
      })
      const result = checkBuildOutput(dir)
      expect(result.missing).toEqual([])
      expect(result.ok).toBe(true)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  // A full production build takes minutes, so it's opt-in (`PWA_BUILD_TEST=1`). `npm run build`
  // is covered regardless: the plugin itself fails the build when a precache entry is missing.
  it.runIf(process.env.PWA_BUILD_TEST)('a real production build emits sw.js, the manifest and icons, with every precache entry present', () => {
    const outDir = process.env.PWA_BUILD_OUT_DIR || path.join(os.tmpdir(), 'subelt-scratch', `build-pwa-${process.pid}`)
    const root = path.resolve(__dirname, '..')
    // vitest sets NODE_ENV=test; inherited by `vite build` it yields a development bundle
    // (import.meta.env.PROD === false, so registerSW never registers) — build what `npm run build` ships
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: 'production' }
    for (const key of Object.keys(env)) if (key.startsWith('VITEST')) delete env[key]
    execSync(`npx vite build --outDir "${outDir}" --emptyOutDir`, { cwd: root, stdio: 'pipe', env })
    try {
      const result = checkBuildOutput(outDir)
      const entry = result.precache.find((u) => /^\/assets\/index-[^/]+\.js$/.test(u))!
      const entryCode = fs.readFileSync(path.join(outDir, entry), 'utf8')
      expect(entryCode).toContain('"/sw.js"')
      expect(entryCode).not.toContain('react-devtools') // react-dom's development-only banner
      expect(result.missing).toEqual([])
      expect(result.ok).toBe(true)
      expect(result.precache).toEqual(expect.arrayContaining(['/index.html', '/manifest.webmanifest']))
      // the pipeline's module worker, so runs stay off the main thread on an offline cold start
      expect(result.precache.some((u) => /^\/assets\/pipeline\.worker-[^/]+\.js$/.test(u))).toBe(true)
      const js = result.precache.filter((u) => u.endsWith('.js'))
      const allJs = fs.readdirSync(path.join(outDir, 'assets')).filter((f) => f.endsWith('.js'))
      // the lazy utility chunks stay out of the precache
      expect(js.length).toBeLessThan(10)
      expect(allJs.length).toBeGreaterThan(100)
    } finally {
      if (!process.env.PWA_BUILD_OUT_DIR) fs.rmSync(outDir, { recursive: true, force: true })
    }
  }, 900_000)
})
