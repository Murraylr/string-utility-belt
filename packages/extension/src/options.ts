/** Options page: which utilities show up on the context menu, and the app's base URL. */
import type { UtilityMeta } from '../../../src/core/registry'
import { DEFAULT_BASE_URL, DEFAULT_MENU_UTILITIES } from './lib/constants'
import { edgeSafeUtilities } from './lib/registry'
import { getBaseUrl, getMenuUtilities, normalizeBaseUrl, setBaseUrl, setMenuUtilities } from './lib/storage'

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing #${id}`)
  return el as T
}

function matches(meta: UtilityMeta, query: string): boolean {
  if (!query) return true
  return [meta.id, meta.name, meta.category, ...meta.tags, ...meta.aliases]
    .some(s => s.toLowerCase().includes(query))
}

function renderList(container: HTMLElement, metas: UtilityMeta[], selected: Set<string>, query: string): void {
  container.innerHTML = ''
  const legend = document.createElement('legend')
  legend.textContent = 'Context menu utilities'
  container.appendChild(legend)

  const q = query.trim().toLowerCase()
  let lastCategory = ''
  let shown = 0
  for (const meta of metas) {
    if (!matches(meta, q)) continue
    shown++
    if (meta.category !== lastCategory) {
      const heading = document.createElement('div')
      heading.className = 'category'
      heading.textContent = meta.category
      container.appendChild(heading)
      lastCategory = meta.category
    }
    const row = document.createElement('label')
    row.className = 'option-row'
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.value = meta.id
    checkbox.checked = selected.has(meta.id)
    row.appendChild(checkbox)
    row.appendChild(document.createTextNode(meta.name))
    container.appendChild(row)
  }
  if (shown === 0) {
    const empty = document.createElement('p')
    empty.textContent = 'No utilities match your search.'
    container.appendChild(empty)
  }
}

export async function init(): Promise<void> {
  const metas = edgeSafeUtilities()
  const list = byId<HTMLFieldSetElement>('utility-list')
  const search = byId<HTMLInputElement>('search')
  const baseUrlInput = byId<HTMLInputElement>('base-url')
  const status = byId<HTMLDivElement>('status')

  let selected = new Set(await getMenuUtilities())
  baseUrlInput.value = await getBaseUrl()
  renderList(list, metas, selected, search.value)

  search.addEventListener('input', () => renderList(list, metas, selected, search.value))

  list.addEventListener('change', e => {
    const target = e.target
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return
    if (target.checked) selected.add(target.value)
    else selected.delete(target.value)
  })

  baseUrlInput.addEventListener('input', () => baseUrlInput.removeAttribute('aria-invalid'))

  const save = async (ids: string[], url: string, done: string) => {
    try {
      await Promise.all([setMenuUtilities(ids), setBaseUrl(url)])
      status.textContent = done
    } catch (e) {
      status.textContent = `Could not save: ${(e as Error)?.message || String(e)}`
    }
  }

  byId<HTMLButtonElement>('save').addEventListener('click', () => {
    const url = normalizeBaseUrl(baseUrlInput.value || DEFAULT_BASE_URL)
    if (!url) {
      baseUrlInput.setAttribute('aria-invalid', 'true')
      status.textContent = 'Not saved: the app URL must start with https:// or http://.'
      baseUrlInput.focus()
      return
    }
    baseUrlInput.value = url
    void save([...selected], url, 'Saved.')
  })

  byId<HTMLButtonElement>('reset').addEventListener('click', () => {
    selected = new Set(DEFAULT_MENU_UTILITIES)
    baseUrlInput.value = DEFAULT_BASE_URL
    baseUrlInput.removeAttribute('aria-invalid')
    renderList(list, metas, selected, search.value)
    void save([...selected], DEFAULT_BASE_URL, 'Reset to defaults.')
  })
}

/** Started immediately; exported so tests can await full startup. */
export const ready: Promise<void> = init()
