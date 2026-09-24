import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Minimal fake of the slice of IndexedDB that history.ts uses: versioned open with upgrade,
 * object stores, getAll/put/delete/clear. `failOpen` makes every open() error, like Firefox
 * private browsing or a VersionError.
 */
function createFakeIndexedDB(opts: { failOpen?: boolean; version?: number; stores?: string[] } = {}) {
  const stores = new Map<string, Map<string, any>>((opts.stores ?? []).map(n => [n, new Map()]))
  let version = opts.version ?? 0
  const opens: Array<number | undefined> = []

  class FakeRequest {
    onsuccess: ((ev: any) => void) | null = null
    onerror: ((ev: any) => void) | null = null
    onupgradeneeded: ((ev: any) => void) | null = null
    onblocked: ((ev: any) => void) | null = null
    result: any
    error: any
    _succeed(result: any) {
      this.result = result
      queueMicrotask(() => this.onsuccess?.({ target: this }))
    }
  }

  const storeApi = (rows: Map<string, any>) => ({
    put(value: any) { const r = new FakeRequest(); rows.set(value.id, structuredClone(value)); r._succeed(value.id); return r },
    getAll() { const r = new FakeRequest(); r._succeed([...rows.values()].map(v => structuredClone(v))); return r },
    delete(id: string) { const r = new FakeRequest(); rows.delete(id); r._succeed(undefined); return r },
    clear() { const r = new FakeRequest(); rows.clear(); r._succeed(undefined); return r },
  })

  function makeDb() {
    return {
      get version() { return version },
      objectStoreNames: { contains: (n: string) => stores.has(n) },
      createObjectStore(n: string) { stores.set(n, new Map()); return storeApi(stores.get(n)!) },
      transaction(n: string) {
        const rows = stores.get(n)
        if (!rows) throw new DOMException(`no store ${n}`, 'NotFoundError')
        return { objectStore: () => storeApi(rows) }
      },
      close() {},
      onversionchange: null as any,
    }
  }

  return {
    open(_name: string, requested?: number) {
      opens.push(requested)
      const req = new FakeRequest()
      queueMicrotask(() => {
        if (opts.failOpen) {
          req.error = new DOMException('The operation is insecure.', 'SecurityError')
          req.onerror?.({ target: req })
          return
        }
        if (requested !== undefined && requested < version) {
          req.error = new DOMException('version too low', 'VersionError')
          req.onerror?.({ target: req })
          return
        }
        const target = requested ?? Math.max(version, 1)
        const db = makeDb()
        req.result = db
        if (target > version) {
          version = target
          req.onupgradeneeded?.({ target: req, oldVersion: version, newVersion: target })
        }
        req.onsuccess?.({ target: req })
      })
      return req
    },
    _stores: stores,
    _opens: opens,
    get _version() { return version },
  }
}

describe('history (in-memory fallback — no indexedDB, as in jsdom)', () => {
  beforeEach(() => { vi.resetModules() })

  it('lists nothing initially, then saves newest-first', async () => {
    const { listHistory, saveHistory } = await import('./history')
    expect(await listHistory()).toEqual([])
    await saveHistory('first')
    await saveHistory('second')
    const all = await listHistory()
    expect(all.map(e => e.text)).toEqual(['second', 'first'])
  })

  it('dedupes identical text by moving it to the front instead of duplicating', async () => {
    const { listHistory, saveHistory } = await import('./history')
    await saveHistory('a')
    await saveHistory('b')
    await saveHistory('a')
    const all = await listHistory()
    expect(all.map(e => e.text)).toEqual(['a', 'b'])
  })

  it('caps the ring buffer at 25 entries, dropping the oldest', async () => {
    const { listHistory, saveHistory, HISTORY_LIMIT } = await import('./history')
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) await saveHistory(`entry-${i}`)
    const all = await listHistory()
    expect(all).toHaveLength(HISTORY_LIMIT)
    expect(all[0].text).toBe(`entry-${HISTORY_LIMIT + 4}`)
    expect(all.some(e => e.text === 'entry-0')).toBe(false)
  })

  it('skips empty text and entries over 1 MB', async () => {
    const { listHistory, saveHistory } = await import('./history')
    await saveHistory('')
    await saveHistory('x'.repeat(1024 * 1024 + 1))
    expect(await listHistory()).toEqual([])
  })

  it('deletes a single entry and clears everything', async () => {
    const { listHistory, saveHistory, deleteHistoryEntry, clearHistory } = await import('./history')
    await saveHistory('a')
    await saveHistory('b')
    const [{ id }] = await listHistory()
    await deleteHistoryEntry(id)
    expect((await listHistory()).map(e => e.text)).toEqual(['a'])
    await clearHistory()
    expect(await listHistory()).toEqual([])
  })
})

describe('history (indexedDB path, against a minimal fake)', () => {
  const originalIndexedDB = (globalThis as any).indexedDB

  beforeEach(() => {
    vi.resetModules()
    ;(globalThis as any).indexedDB = createFakeIndexedDB()
  })
  afterEach(() => {
    (globalThis as any).indexedDB = originalIndexedDB
  })

  it('persists through the fake IndexedDB store', async () => {
    const { listHistory, saveHistory } = await import('./history')
    await saveHistory('one')
    await saveHistory('two')
    const all = await listHistory()
    expect(all.map(e => e.text)).toEqual(['two', 'one'])
  })

  it('trims to the history limit via the fake store', async () => {
    const { listHistory, saveHistory, HISTORY_LIMIT } = await import('./history')
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) await saveHistory(`e${i}`)
    expect(await listHistory()).toHaveLength(HISTORY_LIMIT)
  })

  it('deletes and clears via the fake store', async () => {
    const { listHistory, saveHistory, deleteHistoryEntry, clearHistory } = await import('./history')
    await saveHistory('a')
    const [{ id }] = await listHistory()
    await deleteHistoryEntry(id)
    expect(await listHistory()).toEqual([])
    await saveHistory('b')
    await clearHistory()
    expect(await listHistory()).toEqual([])
  })

  it('dedupes concurrent saves of the same text (debounce flush racing a manual run)', async () => {
    const { listHistory, saveHistory } = await import('./history')
    await Promise.all([saveHistory('same'), saveHistory('same'), saveHistory('other')])
    expect((await listHistory()).map(e => e.text).sort()).toEqual(['other', 'same'])
  })

  it('adds its store to an existing "sub" database at a higher version instead of failing with VersionError', async () => {
    const fake = createFakeIndexedDB({ version: 3, stores: ['someoneElsesStore'] })
    ;(globalThis as any).indexedDB = fake
    const { listHistory, saveHistory } = await import('./history')
    await saveHistory('kept')
    expect((await listHistory()).map(e => e.text)).toEqual(['kept'])
    expect(fake._version).toBe(4)
    expect(fake._stores.has('someoneElsesStore')).toBe(true)
    expect(fake._stores.get('inputHistory')?.size).toBe(1)
  })
})

describe('history (indexedDB present but unusable)', () => {
  const originalIndexedDB = (globalThis as any).indexedDB

  beforeEach(() => {
    vi.resetModules()
    ;(globalThis as any).indexedDB = createFakeIndexedDB({ failOpen: true })
  })
  afterEach(() => {
    (globalThis as any).indexedDB = originalIndexedDB
  })

  it('falls back to the in-memory store instead of rejecting', async () => {
    const { listHistory, saveHistory, deleteHistoryEntry, clearHistory } = await import('./history')
    await expect(listHistory()).resolves.toEqual([])
    await saveHistory('a')
    await saveHistory('b')
    expect((await listHistory()).map(e => e.text)).toEqual(['b', 'a'])
    const [{ id }] = await listHistory()
    await deleteHistoryEntry(id)
    expect((await listHistory()).map(e => e.text)).toEqual(['a'])
    await clearHistory()
    expect(await listHistory()).toEqual([])
  })
})
