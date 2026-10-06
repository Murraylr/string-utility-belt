import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_BASE_URL, DEFAULT_MENU_UTILITIES } from './constants'
import {
  appUrl, getBaseUrl, getLastError, getLastResult, getMenuUtilities, getPipelines, newPipelineId, normalizeBaseUrl,
  setBaseUrl, setLastError, setLastResult, setMenuUtilities, setPipelines,
} from './storage'

const runtime: { lastError?: { message: string } } = {}
/** The next write fails the way chrome.storage reports it: via runtime.lastError inside the callback. */
let failNext = ''

function makeArea(store: Record<string, unknown> = {}) {
  return {
    store,
    get: vi.fn((defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(defaults)) out[k] = k in store ? store[k] : defaults[k]
      cb(out)
    }),
    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      if (failNext) runtime.lastError = { message: failNext }
      else Object.assign(store, items)
      cb?.()
      delete runtime.lastError
      failNext = ''
    }),
  }
}

const area = { sync: makeArea(), local: makeArea() }

beforeEach(() => {
  area.sync = makeArea()
  area.local = makeArea()
  vi.stubGlobal('chrome', { runtime, storage: area })
})

describe('menu utilities', () => {
  it('defaults when nothing is stored', async () => {
    expect(await getMenuUtilities()).toEqual([...DEFAULT_MENU_UTILITIES])
  })

  it('round-trips a custom list, including an explicitly empty one', async () => {
    await setMenuUtilities(['trim', 'case'])
    expect(await getMenuUtilities()).toEqual(['trim', 'case'])
    await setMenuUtilities([])
    expect(await getMenuUtilities()).toEqual([])
  })

  it('drops non-string entries from corrupted storage and defaults a non-array value', async () => {
    area.sync.store.menuUtilities = ['trim', 5, null]
    expect(await getMenuUtilities()).toEqual(['trim'])
    area.sync.store.menuUtilities = 'trim'
    expect(await getMenuUtilities()).toEqual([...DEFAULT_MENU_UTILITIES])
  })

  it('rejects when chrome.storage reports a write error (e.g. the sync quota)', async () => {
    failNext = 'QUOTA_BYTES_PER_ITEM quota exceeded'
    await expect(setMenuUtilities(['trim'])).rejects.toThrow(/quota/)
  })
})

describe('base URL', () => {
  it.each([
    ['https://example.com/', 'https://example.com'],
    ['  https://example.com/app//  ', 'https://example.com/app'],
    ['http://localhost:5173', 'http://localhost:5173'],
    ['https://example.com/app?x=1#frag', 'https://example.com/app'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeBaseUrl(input)).toBe(expected)
  })

  it.each(['javascript:alert(1)', 'data:text/html,hi', 'file:///C:/x', 'chrome://settings', 'example.com', ''])(
    'refuses %j', input => {
      expect(normalizeBaseUrl(input)).toBeNull()
    },
  )

  it('defaults, saves normalized, and refuses to save an unsafe URL', async () => {
    expect(await getBaseUrl()).toBe(DEFAULT_BASE_URL)
    await setBaseUrl('https://example.com/')
    expect(await getBaseUrl()).toBe('https://example.com')
    await expect(setBaseUrl('javascript:alert(1)')).rejects.toThrow(/http/)
    expect(await getBaseUrl()).toBe('https://example.com')
  })

  it('ignores an unsafe value already in storage', async () => {
    area.sync.store.baseUrl = 'javascript:alert(1)'
    expect(await getBaseUrl()).toBe(DEFAULT_BASE_URL)
  })

  it('builds the app URL the share-target handler reads', () => {
    expect(appUrl('https://x.test', 'a b\n&c=d')).toBe('https://x.test/?text=a%20b%0A%26c%3Dd')
    expect(new URL(appUrl('https://x.test', 'a b\n&c=d')).searchParams.get('text')).toBe('a b\n&c=d')
    expect(appUrl('https://x.test/sub', '')).toBe('https://x.test/sub/')
  })
})

describe('popup hand-off', () => {
  it('round-trips lastResult and lastError through local storage', async () => {
    expect(await getLastResult()).toBe('')
    expect(await getLastError()).toBe('')
    await setLastResult('hello')
    await setLastError('trim failed: boom')
    expect(await getLastResult()).toBe('hello')
    expect(await getLastError()).toBe('trim failed: boom')
    expect(area.sync.store).toEqual({})
  })
})

describe('saved pipelines', () => {
  const pipeline = { id: 'p1', name: 'Decode', steps: [{ id: 's', enabled: true, utilityId: 'base64_decode', params: {} }], updatedAt: 5 }

  it('is empty by default, and round-trips through chrome.storage.local (not sync)', async () => {
    expect(await getPipelines()).toEqual([])
    await setPipelines([pipeline])
    expect(area.local.store.pipelines).toEqual([pipeline])
    expect(area.sync.set).not.toHaveBeenCalled()
    expect(await getPipelines()).toEqual([pipeline])
  })

  it('re-validates what it reads: drops malformed, unnamed, empty and duplicate-id entries, and sanitizes steps', async () => {
    area.local.store.pipelines = [
      pipeline,
      { ...pipeline, name: 'duplicate id' },
      { id: 'p2', name: '   ', steps: pipeline.steps },
      { id: 'p3', name: 'no steps', steps: [] },
      { id: 'p4', name: '  spaced    out ', steps: [{ utilityId: 'trim', params: { evil: () => 1 } }] },
      'junk',
      { name: 'no id', steps: pipeline.steps },
    ]
    const read = await getPipelines()
    expect(read.map(p => p.id)).toEqual(['p1', 'p4'])
    expect(read[1]).toMatchObject({ name: 'spaced out', updatedAt: 0, steps: [{ utilityId: 'trim', params: {} }] })
    expect(read[1].steps[0].id).toEqual(expect.any(String))

    area.local.store.pipelines = 'not a list'
    expect(await getPipelines()).toEqual([])
  })

  it('mints distinct ids', () => {
    expect(newPipelineId()).not.toBe(newPipelineId())
    expect(newPipelineId()).toMatch(/^p_[0-9a-f-]{36}$/)
  })
})
