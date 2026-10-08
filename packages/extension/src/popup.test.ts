import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as registry from './lib/registry'

// See background.test.ts: importing the registry pulls in the generated
// utility manifest, which can be slow to transform on a cold Vite cache.
vi.setConfig({ hookTimeout: 60000, testTimeout: 30000 })

/** The real popup.html body (minus its module script), so ids can't drift from popup.ts. */
const POPUP_BODY = (() => {
  const doc = new DOMParser().parseFromString(readFileSync(resolve(__dirname, '../popup.html'), 'utf8'), 'text/html')
  doc.querySelectorAll('script').forEach(s => s.remove())
  return doc.body.innerHTML
})()

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

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

function choose(id: string): void {
  const select = $<HTMLSelectElement>('utility')
  select.value = id
  select.dispatchEvent(new Event('change'))
}

function run(input: string): void {
  $<HTMLTextAreaElement>('input').value = input
  $('run').click()
}

// One module import for the whole file (see background.test.ts for why): each
// test gets a fresh DOM and chrome mock, then re-runs the exported `init()`.
describe('popup', () => {
  let mod: typeof import('./popup')
  let local: ReturnType<typeof makeArea>
  let setBadgeText: ReturnType<typeof vi.fn>

  async function open(localInitial: Record<string, unknown> = { lastResult: 'previous result' }, syncInitial: Record<string, unknown> = {}) {
    document.body.innerHTML = POPUP_BODY
    local = makeArea(localInitial)
    setBadgeText = vi.fn()
    vi.stubGlobal('chrome', {
      storage: { local, sync: makeArea({ baseUrl: 'https://example.test/app', ...syncInitial }) },
      action: { setBadgeText },
    })
    await mod.init()
  }

  beforeAll(async () => {
    document.body.innerHTML = POPUP_BODY
    vi.stubGlobal('chrome', { storage: { local: makeArea(), sync: makeArea() } })
    mod = await import('./popup')
    await mod.ready
  })

  beforeEach(async () => {
    vi.restoreAllMocks()
    await open()
  })

  it('prefills the input from lastResult, links to the configured base URL, and lists edge-safe utilities by category', () => {
    expect($<HTMLTextAreaElement>('input').value).toBe('previous result')
    expect($<HTMLAnchorElement>('open-app').href).toBe('https://example.test/app/')

    const select = $<HTMLSelectElement>('utility')
    const groups = [...select.querySelectorAll('optgroup')]
    expect(groups.length).toBeGreaterThan(1)
    expect(new Set(groups.map(g => g.label)).size).toBe(groups.length) // one group per category
    const ids = [...select.querySelectorAll('option')].map(o => o.value)
    expect(ids).not.toContain('custom_js')
    expect(ids).toContain('base64_encode')
  })

  it('opens the options page from the header', () => {
    const openOptionsPage = vi.fn()
    vi.stubGlobal('chrome', { ...chrome, runtime: { openOptionsPage } })
    const event = new MouseEvent('click', { bubbles: true, cancelable: true })
    $('open-options').dispatchEvent(event)
    expect(openOptionsPage).toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(true)
  })

  it('shows a failure flagged by the context menu once, then clears it and the badge', async () => {
    await open({ lastResult: 'not json', lastError: 'json pretty failed: Unexpected token' })

    expect($('last-error').hidden).toBe(false)
    expect($('last-error-text').textContent).toBe('json pretty failed: Unexpected token')
    expect($('error').textContent).toBe('')
    expect($<HTMLTextAreaElement>('input').value).toBe('not json')
    expect(setBadgeText).toHaveBeenCalledWith({ text: '' })
    expect(local.store.lastError).toBe('')

    $('dismiss-error').click()
    expect($('last-error').hidden).toBe(true)
  })

  it('shows no failure banner when the last menu run succeeded', () => {
    expect($('last-error').hidden).toBe(true)
  })

  it('renders labelled param controls for the selected utility and re-renders on change', () => {
    choose('case')
    const control = $('params').querySelector<HTMLSelectElement>('[data-param-key="mode"]')!
    expect(control).not.toBeNull()
    expect(document.querySelector(`label[for="${control.id}"]`)).not.toBeNull()

    choose('trim')
    expect($('params').querySelector('[data-param-key="mode"]')).toBeNull()
  })

  it('runs the selected utility with the chosen params, shows the result, and keeps it as lastResult', async () => {
    choose('case')
    $('params').querySelector<HTMLSelectElement>('[data-param-key="mode"]')!.value = 'upper'
    run('shout')

    await vi.waitFor(() => expect($<HTMLTextAreaElement>('output').value).toBe('SHOUT'))
    expect($('status').textContent).toBe('Done.')
    expect(local.store.lastResult).toBe('SHOUT')
  })

  it('decodes a bytes result as text', async () => {
    choose('hex_decode')
    run('6869')
    await vi.waitFor(() => expect($<HTMLTextAreaElement>('output').value).toBe('hi'))
  })

  it('shows the utility error when a run fails, clearing the previous (now stale) result', async () => {
    $<HTMLTextAreaElement>('output').value = 'result of an earlier run'
    choose('json_pretty')
    run('not json')
    await vi.waitFor(() => expect($('error').textContent).not.toBe(''))
    expect($<HTMLTextAreaElement>('output').value).toBe('')
  })

  it('refuses to run with an invalid param and says which one', () => {
    const spy = vi.spyOn(registry, 'runUtilityById')
    choose('json_pretty')
    $('params').querySelector<HTMLInputElement>('[data-param-key="indent"]')!.value = '-1'
    run('{}')

    expect($('error').textContent).toMatch(/^indent: /)
    expect(spy).not.toHaveBeenCalled()
  })

  it('ignores a slower earlier run that finishes after a newer one', async () => {
    const pending: Array<(v: string) => void> = []
    vi.spyOn(registry, 'runUtilityById').mockImplementation(() => new Promise(r => pending.push(r)))
    choose('trim')
    run('first')
    run('second')
    pending[1]('second result')
    await vi.waitFor(() => expect($<HTMLTextAreaElement>('output').value).toBe('second result'))
    pending[0]('first result')
    await new Promise(r => setTimeout(r, 0))
    expect($<HTMLTextAreaElement>('output').value).toBe('second result')
    expect(local.store.lastResult).toBe('second result')
  })

  it('copies the output and announces it', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    $<HTMLTextAreaElement>('output').value = 'result text'
    $('copy').click()

    expect(writeText).toHaveBeenCalledWith('result text')
    await vi.waitFor(() => expect($('status').textContent).toBe('Copied.'))
  })

  it('says so when copying fails', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    $('copy').click()
    await vi.waitFor(() => expect($('status').textContent).toMatch(/couldn’t copy/i))
  })

  describe('favourites and saved pipelines', () => {
    const pipeline = { id: 'p1', name: 'Shout', steps: [{ id: 'a', utilityId: 'trim' }, { id: 'b', utilityId: 'case', params: { mode: 'upper' } }] }

    beforeEach(async () => {
      await open({ pipelines: [pipeline] }, { menuUtilities: ['sha3', 'custom_js', 'trim'] })
    })

    it('lists runnable favourites, then saved pipelines, above the categories, and selects the first favourite', () => {
      const select = $<HTMLSelectElement>('utility')
      const [favorites, pipelines] = [...select.querySelectorAll('optgroup')]
      expect(favorites.label).toBe('Favourites')
      expect([...favorites.querySelectorAll('option')].map(o => o.value)).toEqual(['sha3', 'trim'])
      expect(pipelines.label).toBe('Saved pipelines')
      expect([...pipelines.querySelectorAll('option')].map(o => [o.value, o.textContent])).toEqual([['pipeline:p1', 'Shout']])
      expect(select.value).toBe('sha3')
    })

    it('runs a saved pipeline with its own params and shows no param controls for it', async () => {
      expect($('pipeline-summary').hidden).toBe(true)
      choose('pipeline:p1')
      expect($('params').children).toHaveLength(0)
      expect($('pipeline-summary').hidden).toBe(false)
      expect($('pipeline-summary').textContent).toBe('2 steps: trim → change case. Runs with its saved settings.')
      run('  quiet ')
      await vi.waitFor(() => expect($<HTMLTextAreaElement>('output').value).toBe('QUIET'))
    })

    it('omits both groups when there is nothing in them', async () => {
      await open({}, { menuUtilities: [] })
      const labels = [...$('utility').querySelectorAll('optgroup')].map(g => g.label)
      expect(labels).not.toContain('Favourites')
      expect(labels).not.toContain('Saved pipelines')
    })
  })
})
