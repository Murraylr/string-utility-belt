import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_MENU_UTILITIES } from './lib/constants'

// See background.test.ts: importing the registry pulls in the generated
// utility manifest, which can be slow to transform on a cold Vite cache.
vi.setConfig({ hookTimeout: 60000, testTimeout: 30000 })

/** The real options.html body (minus its module script), so ids can't drift from options.ts. */
const OPTIONS_BODY = (() => {
  const doc = new DOMParser().parseFromString(readFileSync(resolve(__dirname, '../options.html'), 'utf8'), 'text/html')
  doc.querySelectorAll('script').forEach(s => s.remove())
  return doc.body.innerHTML
})()

const runtime: { lastError?: { message: string } } = {}

function makeArea(initial: Record<string, unknown> = {}) {
  const store: Record<string, unknown> = { ...initial }
  const area = {
    store,
    failWith: '',
    get: vi.fn((defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) => {
      const out: Record<string, unknown> = {}
      for (const k of Object.keys(defaults)) out[k] = k in store ? store[k] : defaults[k]
      cb(out)
    }),
    set: vi.fn((items: Record<string, unknown>, cb?: () => void) => {
      if (area.failWith) runtime.lastError = { message: area.failWith }
      else Object.assign(store, items)
      cb?.()
      delete runtime.lastError
    }),
  }
  return area
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

function checkbox(id: string): HTMLInputElement | undefined {
  return [...$('utility-list').querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find(c => c.value === id)
}

function toggle(id: string, checked: boolean): void {
  const box = checkbox(id)!
  box.checked = checked
  box.dispatchEvent(new Event('change', { bubbles: true }))
}

function search(text: string): void {
  const input = $<HTMLInputElement>('search')
  input.value = text
  input.dispatchEvent(new Event('input'))
}

// One module import for the whole file (see background.test.ts for why): each
// test instead gets a fresh DOM and a fresh chrome mock, then re-runs `init()`.
describe('options', () => {
  let sync: ReturnType<typeof makeArea>
  let mod: typeof import('./options')

  beforeAll(async () => {
    document.body.innerHTML = OPTIONS_BODY
    vi.stubGlobal('chrome', { runtime, storage: { sync: makeArea(), local: makeArea() } })
    mod = await import('./options')
    await mod.ready
  })

  beforeEach(async () => {
    document.body.innerHTML = OPTIONS_BODY
    sync = makeArea({ menuUtilities: ['trim'], baseUrl: 'https://example.com' })
    vi.stubGlobal('chrome', { runtime, storage: { sync, local: makeArea() } })
    await mod.init()
  })

  it('checks the saved utilities, excludes unsafe ones, and shows the saved base URL', () => {
    expect(checkbox('custom_js')).toBeUndefined()
    expect(checkbox('trim')?.checked).toBe(true)
    expect(checkbox('base64_encode')?.checked).toBe(false)
    expect($<HTMLInputElement>('base-url').value).toBe('https://example.com')
  })

  it('every checkbox is labelled by its utility name', () => {
    const box = checkbox('base64_decode')!
    expect(box.closest('label')?.textContent).toBe('base64 decode')
  })

  it('filters by name, id or alias, keeping checked state across searches', () => {
    const total = $('utility-list').querySelectorAll('input[type="checkbox"]').length
    search('atob') // base64_decode's alias
    expect(checkbox('base64_decode')).toBeDefined()
    expect($('utility-list').querySelectorAll('input[type="checkbox"]').length).toBeLessThan(total)

    toggle('base64_decode', true)
    search('hex_decode') // an id
    expect(checkbox('hex_decode')).toBeDefined()
    search('')
    expect(checkbox('base64_decode')?.checked).toBe(true)
  })

  it('shows an empty message when the search matches nothing', () => {
    search('zzzznomatch')
    expect($('utility-list').querySelectorAll('input[type="checkbox"]')).toHaveLength(0)
    expect($('utility-list').textContent).toMatch(/no utilities match/i)
  })

  it('saves the selected utilities and the normalized base URL', async () => {
    toggle('base64_encode', true)
    $<HTMLInputElement>('base-url').value = ' https://custom.example/app/?x=1 '
    $('save').click()

    await vi.waitFor(() => expect($('status').textContent).toBe('Saved.'))
    expect(sync.store.menuUtilities).toEqual(['trim', 'base64_encode'])
    expect(sync.store.baseUrl).toBe('https://custom.example/app')
    expect($<HTMLInputElement>('base-url').value).toBe('https://custom.example/app')
  })

  it('saves an empty selection as empty', async () => {
    toggle('trim', false)
    $('save').click()
    await vi.waitFor(() => expect($('status').textContent).toBe('Saved.'))
    expect(sync.store.menuUtilities).toEqual([])
  })

  it('refuses a non-http(s) base URL without saving anything', () => {
    const input = $<HTMLInputElement>('base-url')
    input.value = 'javascript:alert(1)'
    $('save').click()

    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(input)
    expect($('status').textContent).toMatch(/https?:\/\//)
    expect(sync.set).not.toHaveBeenCalled()
  })

  it('reports a failed save instead of claiming success', async () => {
    sync.failWith = 'QUOTA_BYTES_PER_ITEM quota exceeded'
    $('save').click()
    await vi.waitFor(() => expect($('status').textContent).toMatch(/could not save.*quota/i))
  })

  it('resets to the default utilities and base URL', async () => {
    $('reset').click()

    await vi.waitFor(() => expect($('status').textContent).toBe('Reset to defaults.'))
    for (const id of DEFAULT_MENU_UTILITIES) expect(checkbox(id)?.checked).toBe(true)
    expect(checkbox('trim')?.checked).toBe(true)
    expect(sync.store.menuUtilities).toEqual([...DEFAULT_MENU_UTILITIES])
    expect($<HTMLInputElement>('base-url').value).toBe('https://stringutilitybelt.com')
  })
})
