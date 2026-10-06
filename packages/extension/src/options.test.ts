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
type ChangeListener = (changes: Record<string, unknown>, area: string) => void

const favoriteNames = () => [...$('favorites').querySelectorAll('li')].map(li => li.querySelector('.grow')!.textContent)
const pipelineRows = () => [...$('pipelines').querySelectorAll('li')]
const button = (row: Element, action: string) => row.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)!

const PIPELINES = [
  { id: 'p1', name: 'First', steps: [{ id: 'a', utilityId: 'trim', params: {} }, { id: 'b', utilityId: 'base64_encode', params: {} }], updatedAt: 1 },
  { id: 'p2', name: 'Second', steps: [{ id: 'c', utilityId: 'sha3', params: {} }], updatedAt: 2 },
]

describe('options', () => {
  let sync: ReturnType<typeof makeArea>
  let local: ReturnType<typeof makeArea>
  let changeListeners: ChangeListener[]
  let mod: typeof import('./options')

  function stubChrome() {
    changeListeners = []
    vi.stubGlobal('chrome', {
      runtime,
      storage: { sync, local, onChanged: { addListener: (fn: ChangeListener) => changeListeners.push(fn) } },
    })
  }

  beforeAll(async () => {
    document.body.innerHTML = OPTIONS_BODY
    sync = makeArea()
    local = makeArea()
    stubChrome()
    mod = await import('./options')
    await mod.ready
  })

  beforeEach(async () => {
    document.body.innerHTML = OPTIONS_BODY
    sync = makeArea({ menuUtilities: ['trim'], baseUrl: 'https://example.com' })
    local = makeArea({ pipelines: structuredClone(PIPELINES) })
    stubChrome()
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

  describe('favourites', () => {
    it('lists the favourites in menu order; checking a utility appends it, unchecking removes it', () => {
      expect(favoriteNames()).toEqual(['trim'])
      toggle('base64_encode', true)
      toggle('sha3', true)
      expect(favoriteNames()).toEqual(['trim', 'base64_encode', 'sha3 / keccak'])
      toggle('trim', false)
      expect(favoriteNames()).toEqual(['base64_encode', 'sha3 / keccak'])
      expect($('status').textContent).toBe('Unsaved changes.')
    })

    it('reorders and removes from the list, then saves that order', async () => {
      toggle('base64_encode', true)
      const [first, second] = $('favorites').querySelectorAll('li')
      expect(button(first, 'up').disabled).toBe(true)
      expect(button(second, 'down').disabled).toBe(true)

      button(second, 'up').click()
      expect(favoriteNames()).toEqual(['base64_encode', 'trim'])
      expect(document.activeElement?.getAttribute('aria-label')).toBe('Move base64_encode down') // its own row; "up" is now disabled

      button($('favorites').querySelectorAll('li')[1], 'remove').click()
      expect(favoriteNames()).toEqual(['base64_encode'])
      expect(checkbox('trim')?.checked).toBe(false)

      $('save').click()
      await vi.waitFor(() => expect($('status').textContent).toBe('Saved.'))
      expect(sync.store.menuUtilities).toEqual(['base64_encode'])
    })

    it('keeps focus on a checkbox the keyboard toggled', () => {
      const box = checkbox('sha3')!
      box.focus()
      toggle('sha3', true)
      expect(document.activeElement).toBe(box)
      expect(favoriteNames()).toEqual(['trim', 'sha3 / keccak'])
    })

    it('shows an empty-state hint with no favourites', () => {
      expect($('favorites-empty').hidden).toBe(true)
      toggle('trim', false)
      expect($('favorites-empty').hidden).toBe(false)
    })

    it('follows favourites added elsewhere unless there are unsaved edits', async () => {
      sync.store.menuUtilities = ['trim', 'sha3']
      changeListeners.forEach(fn => fn({ menuUtilities: {} }, 'sync'))
      await vi.waitFor(() => expect(favoriteNames()).toEqual(['trim', 'sha3 / keccak']))

      toggle('base64_encode', true)
      sync.store.menuUtilities = ['url_encode']
      changeListeners.forEach(fn => fn({ menuUtilities: {} }, 'sync'))
      await new Promise(r => setTimeout(r, 0))
      expect(favoriteNames()).toEqual(['trim', 'sha3 / keccak', 'base64_encode'])
    })
  })

  describe('saved pipelines', () => {
    it('lists each pipeline with its name, steps and an "open in app" link at the base URL', () => {
      const rows = pipelineRows()
      expect(rows.map(r => r.querySelector<HTMLInputElement>('.pipeline-name')!.value)).toEqual(['First', 'Second'])
      expect(rows[0].textContent).toContain('2 steps: trim → base64_encode')
      const link = rows[0].querySelector('a')!
      expect(link.href).toMatch(/^https:\/\/example\.com\/#\/p\//)
      expect(link.target).toBe('_blank')
      expect(link.rel).toBe('noopener noreferrer')
    })

    it('reorders immediately', async () => {
      button(pipelineRows()[1], 'up').click()
      await vi.waitFor(() => expect($('pipeline-status').textContent).toBe('Order saved.'))
      expect((local.store.pipelines as Array<{ id: string }>).map(p => p.id)).toEqual(['p2', 'p1'])
    })

    it('deletes after confirmation only', async () => {
      const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
      button(pipelineRows()[0], 'remove').click()
      expect(local.set).not.toHaveBeenCalled()

      button(pipelineRows()[0], 'remove').click()
      await vi.waitFor(() => expect($('pipeline-status').textContent).toBe('Deleted "First".'))
      expect((local.store.pipelines as Array<{ id: string }>).map(p => p.id)).toEqual(['p2'])
      expect(confirm).toHaveBeenCalledWith('Delete the pipeline "First"?')
    })

    it('renames, refusing an empty name or one another pipeline has', async () => {
      const rename = (value: string) => {
        const input = pipelineRows()[0].querySelector<HTMLInputElement>('.pipeline-name')!
        input.value = value
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return input
      }
      expect(rename('second').value).toBe('First')
      expect($('pipeline-status').textContent).toMatch(/already named/)
      expect(rename('  ').value).toBe('First')
      expect(local.set).not.toHaveBeenCalled()

      rename(' Renamed  one ')
      await vi.waitFor(() => expect($('pipeline-status').textContent).toBe('Renamed to "Renamed one".'))
      expect((local.store.pipelines as Array<{ name: string }>)[0].name).toBe('Renamed one')
    })

    it('adds a pipeline from a share link', async () => {
      const { encodeShare } = await import('../../../src/core/serialize')
      const link = `https://stringutilitybelt.com/#/p/${encodeShare({ v: 2, name: 'Shared', steps: [{ id: 'x', utilityId: 'url_encode', params: {} }] })}`
      $<HTMLInputElement>('import-link').value = link
      $('import').click()

      await vi.waitFor(() => expect($('pipeline-status').textContent).toBe('Added "Shared".'))
      expect(pipelineRows()).toHaveLength(3)
      expect($<HTMLInputElement>('import-link').value).toBe('')
    })

    it('explains a link it cannot use', () => {
      $<HTMLInputElement>('import-link').value = 'https://example.com/not a share link'
      $('import').click()
      expect($('pipeline-status').textContent).toMatch(/paste a share link/i)
      expect(local.set).not.toHaveBeenCalled()
    })

    it('follows pipelines saved from the web app while open', async () => {
      local.store.pipelines = [...PIPELINES, { id: 'p3', name: 'From the app', steps: [{ id: 'z', utilityId: 'trim' }], updatedAt: 3 }]
      changeListeners.forEach(fn => fn({ pipelines: {} }, 'local'))
      await vi.waitFor(() => expect(pipelineRows()).toHaveLength(3))
    })

    it('shows an empty-state hint with no pipelines', async () => {
      local = makeArea()
      stubChrome()
      document.body.innerHTML = OPTIONS_BODY
      await mod.init()
      expect(pipelineRows()).toHaveLength(0)
      expect($('pipelines-empty').hidden).toBe(false)
    })
  })
})
