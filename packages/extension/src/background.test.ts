import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PageSelection } from './lib/replace'

// Importing `./background` pulls in the generated utility manifest + per-utility
// loaders (a couple hundred modules); the very first time any test process
// transforms that graph, a cold Vite cache can make it take well over the
// default 10s hook timeout. It's a one-time cost, not a hang — give it room.
vi.setConfig({ hookTimeout: 60000, testTimeout: 30000 })

function makeArea(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial }
  return {
    store,
    get: vi.fn((defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(defaults)) out[k] = k in store ? store[k] : defaults[k]
      cb(out)
    }),
    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => { Object.assign(store, items); cb?.() }),
  }
}

type Listener = (...args: unknown[]) => unknown
type Injection = { target: { tabId: number; frameIds?: number[] }; func: (...a: unknown[]) => unknown; args?: unknown[] }

/** What the page answers to the two injected functions, and which frames refuse injection. */
const page = {
  selection: null as PageSelection | null,
  wrote: true,
  refusedFrames: new Set<number>(),
}

function installChromeMock() {
  const sync = makeArea()
  const local = makeArea()
  const listeners = { installed: [] as Listener[], startup: [] as Listener[], onChanged: [] as Listener[] }
  /** Models Chrome's menu registry: ids must be unique until removeAll. */
  const menu = new Map<string, Record<string, unknown>>()
  const runtime: { lastError?: { message: string }; onInstalled: unknown; onStartup: unknown } = {
    onInstalled: { addListener: (fn: Listener) => listeners.installed.push(fn) },
    onStartup: { addListener: (fn: Listener) => listeners.startup.push(fn) },
  }
  const chromeMock = {
    runtime,
    storage: { sync, local, onChanged: { addListener: (fn: Listener) => listeners.onChanged.push(fn) } },
    contextMenus: {
      create: vi.fn((props: { id: string }, cb?: () => void) => {
        if (menu.has(props.id)) runtime.lastError = { message: `Cannot create item with duplicate id ${props.id}` }
        else menu.set(props.id, props)
        cb?.()
        delete runtime.lastError
      }),
      // Like the real API: applied in call order, callback later — so two
      // unserialized rebuilds would both clear, then both create (a union).
      removeAll: vi.fn((cb?: () => void) => { menu.clear(); setTimeout(() => cb?.(), 0) }),
      onClicked: { addListener: vi.fn() },
    },
    tabs: { create: vi.fn() },
    action: { setBadgeText: vi.fn(), setBadgeBackgroundColor: vi.fn(), setTitle: vi.fn() },
    scripting: {
      executeScript: vi.fn(async (opts: Injection) => {
        const frameId = opts.target.frameIds?.[0] ?? 0
        if (page.refusedFrames.has(frameId)) throw new Error('Cannot access contents of the page')
        const result = opts.func === replaceModule.readSelection ? page.selection : page.wrote
        return [{ frameId, result }]
      }),
    },
  }
  return { chromeMock, listeners, sync, local, menu }
}

// A single shared module import for the whole file: background.ts registers
// its listeners once at import time, and re-importing it per test would
// re-transform the generated utility manifest every time.
let ctx: ReturnType<typeof installChromeMock>
let mod: typeof import('./background')
let replaceModule: typeof import('./lib/replace')

beforeAll(async () => {
  replaceModule = await import('./lib/replace')
  ctx = installChromeMock()
  vi.stubGlobal('chrome', ctx.chromeMock)
  mod = await import('./background')
})

beforeEach(() => {
  page.selection = { text: 'hi', whole: false }
  page.wrote = true
  page.refusedFrames.clear()
  ctx.chromeMock.contextMenus.create.mockClear()
  ctx.chromeMock.scripting.executeScript.mockClear()
  ctx.chromeMock.tabs.create.mockClear()
  ctx.chromeMock.action.setBadgeText.mockClear()
  ctx.local.set.mockClear()
  for (const k of Object.keys(ctx.sync.store)) delete ctx.sync.store[k]
  for (const k of Object.keys(ctx.local.store)) delete ctx.local.store[k]
})

const click = (menuItemId: string, extra: Partial<chrome.contextMenus.OnClickData> = {}, tab: chrome.tabs.Tab | null = { id: 7 } as chrome.tabs.Tab) =>
  mod.handleClick({ menuItemId, editable: false, pageUrl: 'https://page.test/', frameId: 0, ...extra } as chrome.contextMenus.OnClickData, tab ?? undefined)

const injections = () => ctx.chromeMock.scripting.executeScript.mock.calls.map(c => c[0])
const writes = () => injections().filter(i => i.func === replaceModule.replaceSelectionOrCopy)

describe('background: wiring', () => {
  it('registers a menu rebuild for install, startup, and a sync menuUtilities change, plus a click handler', () => {
    expect(ctx.listeners.installed).toHaveLength(1)
    expect(ctx.listeners.startup).toHaveLength(1)
    expect(ctx.listeners.onChanged).toHaveLength(1)
    expect(ctx.chromeMock.contextMenus.onClicked.addListener).toHaveBeenCalledWith(expect.any(Function))
  })
})

describe('background: rebuildMenu', () => {
  it('builds a root, the default utilities, a separator, then open-in-app', async () => {
    await mod.rebuildMenu()

    const ids = [...ctx.menu.keys()]
    expect(ids[0]).toBe('subelt-root')
    expect(ids.filter(id => id.startsWith('subelt-apply:'))).toEqual([
      'base64_decode', 'base64_encode', 'url_decode', 'url_encode', 'jwt_decode',
      'json_pretty', 'case', 'trim', 'unescape_html', 'sha3',
    ].map(id => `subelt-apply:${id}`))
    expect(ids.slice(-2)).toEqual(['subelt-separator', 'subelt-open-in-app'])
    expect(ctx.menu.get('subelt-apply:sha3')).toMatchObject({ parentId: 'subelt-root', title: 'Apply: sha3 / keccak', contexts: ['selection', 'editable'] })
  })

  it('reflects a stored list, skipping unknown and unsafe ids', async () => {
    ctx.sync.store.menuUtilities = ['trim', 'custom_js', 'no_such_utility']
    await mod.rebuildMenu()
    expect([...ctx.menu.keys()]).toEqual(['subelt-root', 'subelt-apply:trim', 'subelt-separator', 'subelt-open-in-app'])
  })

  it('honours an explicitly empty list instead of resurrecting the defaults', async () => {
    ctx.sync.store.menuUtilities = []
    await mod.rebuildMenu()
    expect([...ctx.menu.keys()]).toEqual(['subelt-root', 'subelt-separator', 'subelt-open-in-app'])
  })

  it('serializes overlapping rebuilds so the menu ends up exactly the latest list', async () => {
    ctx.sync.store.menuUtilities = ['trim', 'case']
    const first = mod.rebuildMenu()
    ctx.sync.store.menuUtilities = ['sha3']
    const second = mod.rebuildMenu()
    await Promise.all([first, second])

    expect([...ctx.menu.keys()]).toEqual(['subelt-root', 'subelt-apply:sha3', 'subelt-separator', 'subelt-open-in-app'])
  })

  it('is what the storage listener runs for a sync menuUtilities change, and nothing else', async () => {
    ctx.sync.store.menuUtilities = ['trim']
    ctx.listeners.onChanged[0]({ menuUtilities: { newValue: ['trim'] } }, 'sync')
    await mod.rebuildMenu() // queued behind the listener's rebuild
    expect(ctx.menu.has('subelt-apply:trim')).toBe(true)

    ctx.chromeMock.contextMenus.create.mockClear()
    ctx.listeners.onChanged[0]({ lastResult: { newValue: 'x' } }, 'local')
    ctx.listeners.onChanged[0]({ baseUrl: { newValue: 'x' } }, 'sync')
    await new Promise(r => setTimeout(r, 5))
    expect(ctx.chromeMock.contextMenus.create).not.toHaveBeenCalled()
  })
})

describe('background: applying a utility', () => {
  it('reads the selection in the clicked frame, runs the utility, and injects the writer with result + expected text', async () => {
    await click('subelt-apply:base64_encode', { selectionText: 'hi', frameId: 3 })

    const [read, write] = injections()
    expect(read.func).toBe(replaceModule.readSelection)
    expect(read.target).toEqual({ tabId: 7, frameIds: [3] })
    expect(write.func).toBe(replaceModule.replaceSelectionOrCopy)
    expect(write.target).toEqual({ tabId: 7, frameIds: [3] })
    expect(write.args).toEqual(['aGk=', 'hi', false])
  })

  it('transforms the page\'s real selection, not the menu\'s newline-collapsed selectionText', async () => {
    page.selection = { text: '  a\nb  ', whole: false }
    await click('subelt-apply:trim', { selectionText: 'a b' })
    expect(writes()[0].args).toEqual(['a\nb', '  a\nb  ', false])
  })

  it('applies to a whole editable field when nothing is selected in it', async () => {
    page.selection = { text: 'whole field', whole: true }
    await click('subelt-apply:base64_encode', { editable: true })
    expect(writes()[0].args).toEqual(['d2hvbGUgZmllbGQ=', 'whole field', true])
  })

  it('falls back to selectionText when the page refuses injection, and keeps the result for the popup', async () => {
    page.refusedFrames.add(0)
    await click('subelt-apply:base64_encode', { selectionText: 'hi' })
    expect(ctx.local.store.lastResult).toBe('aGk=')
  })

  it('stores lastResult when the writer copied instead of replacing', async () => {
    page.wrote = false
    await click('subelt-apply:base64_encode', { selectionText: 'hi' })
    expect(ctx.local.store.lastResult).toBe('aGk=')
  })

  it('does not touch lastResult when the writer replaced the selection', async () => {
    await click('subelt-apply:base64_encode', { selectionText: 'hi' })
    expect(ctx.local.set).not.toHaveBeenCalled()
  })

  it('copies via the top frame when the clicked frame cannot be scripted', async () => {
    page.refusedFrames.add(5)
    await click('subelt-apply:base64_encode', { selectionText: 'hi', frameId: 5 })
    const fallback = writes().at(-1)!
    expect(fallback.target).toEqual({ tabId: 7, frameIds: [0] })
    expect(fallback.args).toEqual(['aGk=', null, false])
    expect(ctx.local.store.lastResult).toBe('aGk=')
  })

  it('decodes bytes output as text instead of JSON-stringifying the Uint8Array', async () => {
    page.selection = { text: '68656c6c6f', whole: false }
    await click('subelt-apply:hex_decode')
    expect(writes()[0].args?.[0]).toBe('hello')
  })

  it('pretty-prints JSON output', async () => {
    page.selection = { text: '{"a":1}', whole: false }
    await click('subelt-apply:json_pretty')
    expect(writes()[0].args?.[0]).toBe('{\n  "a": 1\n}')
  })

  it('never writes an error over the selection: the popup gets input + error, the icon a badge', async () => {
    page.selection = { text: 'not json', whole: false }
    await click('subelt-apply:json_pretty')

    expect(writes()).toHaveLength(0)
    expect(ctx.local.store.lastResult).toBe('not json')
    expect(ctx.local.store.lastError).toMatch(/json pretty.*failed/i)
    expect(ctx.chromeMock.action.setBadgeText).toHaveBeenLastCalledWith({ text: '!' })
  })

  it('refuses a utility the extension may not run, even from a forged menu id', async () => {
    await click('subelt-apply:custom_js')
    expect(writes()).toHaveLength(0)
    expect(ctx.local.store.lastError).toMatch(/cannot run in the extension/)
  })

  it('does nothing when there is no selection anywhere', async () => {
    page.selection = null
    await click('subelt-apply:trim')
    expect(writes()).toHaveLength(0)
    expect(ctx.local.set).not.toHaveBeenCalled()
  })
})

describe('background: open in app', () => {
  it('opens the real selection (line breaks kept) at the configured base URL, without writing to the page', async () => {
    ctx.sync.store.baseUrl = 'https://self-hosted.example/sub'
    page.selection = { text: 'a b\nc&d', whole: false }
    await click('subelt-open-in-app', { selectionText: 'a b c&d' })

    expect(ctx.chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://self-hosted.example/sub/?text=a%20b%0Ac%26d' })
    expect(writes()).toHaveLength(0)
  })

  it('works without a tab (e.g. a PDF viewer) from selectionText, and ignores an unsafe stored base URL', async () => {
    ctx.sync.store.baseUrl = 'javascript:alert(1)'
    await click('subelt-open-in-app', { selectionText: 'x' }, null)
    expect(ctx.chromeMock.tabs.create).toHaveBeenCalledWith({ url: 'https://stringutilitybelt.com/?text=x' })
  })
})
