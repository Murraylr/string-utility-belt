/**
 * Options page: favourite utilities (the context menu's "Apply:" items, in
 * order), the app's base URL, and saved pipelines (the "Pipeline:" items).
 * Favourites and the URL are a form saved with the Save button; pipeline
 * changes apply immediately, and the page follows changes made elsewhere
 * (the web app's "save to extension") while it is open.
 */
import { decodeShare, encodeShare } from '../../../src/core/serialize'
import { MAX_PIPELINE_NAME, normalizePipelineName } from '../../../src/core/extensionBridge'
import type { UtilityMeta } from '../../../src/core/registry'
import { DEFAULT_BASE_URL, DEFAULT_MENU_UTILITIES } from './lib/constants'
import { icon } from './lib/icons'
import { move, pipelineSummary, upsertPipeline } from './lib/library'
import { edgeSafeUtilities, getEdgeSafeUtilityMeta } from './lib/registry'
import {
  getBaseUrl, getMenuUtilities, getPipelines, normalizeBaseUrl, setBaseUrl, setMenuUtilities, setPipelines,
  type SavedPipeline,
} from './lib/storage'

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing #${id}`)
  return el as T
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] {
  return Object.assign(document.createElement(tag), props)
}

const errorText = (e: unknown) => (e as Error)?.message || String(e)

/** A name in a status message or label, in the curly quotes the rest of the page uses. */
const quoted = (name: string) => `“${name}”`

/** Shows `text` in a status line, in the danger colour when it says something went wrong. */
function say(status: HTMLElement, text: string, isError = false): void {
  status.textContent = text
  status.classList.toggle('error', isError)
}

/** How long a "Confirm delete" button waits for its second click. */
const CONFIRM_MS = 5000

function matches(meta: UtilityMeta, query: string): boolean {
  if (!query) return true
  return [meta.id, meta.name, meta.category, ...meta.tags, ...meta.aliases]
    .some(s => s.toLowerCase().includes(query))
}

function renderList(container: HTMLElement, metas: UtilityMeta[], selected: string[], query: string): void {
  container.innerHTML = ''
  container.appendChild(el('legend', { className: 'visually-hidden', textContent: 'All utilities' }))

  const q = query.trim().toLowerCase()
  let lastCategory = ''
  let shown = 0
  for (const meta of metas) {
    if (!matches(meta, q)) continue
    shown++
    if (meta.category !== lastCategory) {
      container.appendChild(el('div', { className: 'category', textContent: meta.category }))
      lastCategory = meta.category
    }
    const row = el('label', { className: 'option-row' })
    row.appendChild(el('input', { type: 'checkbox', value: meta.id, checked: selected.includes(meta.id) }))
    row.appendChild(document.createTextNode(meta.name))
    container.appendChild(row)
  }
  if (shown === 0) container.appendChild(el('p', { className: 'no-match', textContent: 'No utilities match your search.' }))
}

function actionButton(content: string | SVGSVGElement, action: string, label: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', disabled })
  button.append(content)
  button.className = typeof content === 'string' ? 'ghost' : 'ghost icon-only'
  if (action === 'remove') button.classList.add('danger')
  button.dataset.action = action
  button.setAttribute('aria-label', label)
  return button
}

/**
 * One row of an ordered list: its position (when `numbered`), the label
 * content, any `extra` controls, then move up / move down / remove buttons.
 */
function itemRow(
  label: string, index: number, total: number, content: Node[],
  { removeText = 'Remove', numbered = false, extra = [] }: { removeText?: string; numbered?: boolean; extra?: Node[] } = {},
): HTMLLIElement {
  const li = el('li')
  li.dataset.index = String(index)
  if (numbered) li.appendChild(el('span', { className: 'num', textContent: String(index + 1) }))
  const grow = el('div', { className: 'grow' })
  grow.append(...content)
  li.append(
    grow,
    ...extra,
    actionButton(icon('arrow-up'), 'up', `Move ${label} up`, index === 0),
    actionButton(icon('arrow-down'), 'down', `Move ${label} down`, index === total - 1),
    actionButton(removeText, 'remove', `${removeText} ${label}`),
  )
  return li
}

/** After a list re-renders, puts focus back where the keyboard user was: the same control on the item's new row. */
function refocus(list: HTMLOListElement, index: number, action: string): void {
  const rows = list.querySelectorAll('li')
  const at = action === 'remove' ? Math.min(index, rows.length - 1) : index + (action === 'up' ? -1 : 1)
  const row = rows[at]
  ;(row?.querySelector<HTMLButtonElement>(`button[data-action="${action}"]:not(:disabled)`) ?? row?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus()
}

function renderFavorites(list: HTMLOListElement, empty: HTMLElement, ids: string[]): void {
  list.innerHTML = ''
  const metas = ids.map(getEdgeSafeUtilityMeta).filter((m): m is UtilityMeta => !!m)
  metas.forEach((meta, i) => list.appendChild(itemRow(meta.name, i, metas.length, [
    el('span', { className: 'name', textContent: meta.name }),
    el('span', { className: 'meta', textContent: meta.category }),
  ], { numbered: true })))
  empty.hidden = metas.length > 0
}

/** Where the web app opens `pipeline` for editing (a share link; its steps are in the fragment, never sent to a server). */
export function pipelineAppUrl(baseUrl: string, pipeline: SavedPipeline): string {
  return `${baseUrl}/#/p/${encodeShare({ v: 2, name: pipeline.name, steps: pipeline.steps })}`
}

function renderPipelines(list: HTMLOListElement, empty: HTMLElement, pipelines: SavedPipeline[], baseUrl: string): void {
  list.innerHTML = ''
  pipelines.forEach((pipeline, i) => {
    const name = el('input', { type: 'text', value: pipeline.name, className: 'pipeline-name', spellcheck: false, maxLength: MAX_PIPELINE_NAME })
    name.setAttribute('aria-label', `Name of pipeline ${i + 1}`)
    const summary = el('span', { className: 'meta', textContent: pipelineSummary(pipeline.steps), title: pipelineSummary(pipeline.steps) })
    const open = el('a', { href: pipelineAppUrl(baseUrl, pipeline), target: '_blank', rel: 'noopener noreferrer', textContent: 'Open in app', className: 'ghost' })
    list.appendChild(itemRow(quoted(pipeline.name), i, pipelines.length, [name, summary], { removeText: 'Delete', extra: [open] }))
  })
  empty.hidden = pipelines.length > 0
}

/** The pipeline payload in a share or embed link (or a bare payload). */
export function sharePayload(link: string): string | null {
  const text = link.trim()
  const m = /#\/(?:p|embed)\/([^?#\s]+)/.exec(text)
  if (m) return m[1]
  return /^[A-Za-z0-9+\-$]+$/.test(text) ? text : null
}

export async function init(): Promise<void> {
  const metas = edgeSafeUtilities()
  const list = byId<HTMLFieldSetElement>('utility-list')
  const search = byId<HTMLInputElement>('search')
  const baseUrlInput = byId<HTMLInputElement>('base-url')
  const status = byId<HTMLElement>('status')
  const favoritesList = byId<HTMLOListElement>('favorites')
  const favoritesEmpty = byId<HTMLElement>('favorites-empty')
  const pipelinesList = byId<HTMLOListElement>('pipelines')
  const pipelinesEmpty = byId<HTMLElement>('pipelines-empty')
  const pipelineStatus = byId<HTMLElement>('pipeline-status')
  const importInput = byId<HTMLInputElement>('import-link')

  let [selected, savedBaseUrl, pipelines] = await Promise.all([getMenuUtilities(), getBaseUrl(), getPipelines()])
  // Only runnable ids are shown, so only they are kept on the next save.
  selected = selected.filter(id => getEdgeSafeUtilityMeta(id))
  let dirty = false
  baseUrlInput.value = savedBaseUrl

  const showFavorites = () => {
    renderFavorites(favoritesList, favoritesEmpty, selected)
    renderList(list, metas, selected, search.value)
  }
  const showPipelines = () => renderPipelines(pipelinesList, pipelinesEmpty, pipelines, savedBaseUrl)
  /** `fromChecklist`: the checkbox already shows the change; re-rendering the list would take focus from it. */
  const edit = (next: string[], fromChecklist = false) => {
    selected = next
    dirty = true
    say(status, 'Unsaved changes.')
    if (fromChecklist) renderFavorites(favoritesList, favoritesEmpty, selected)
    else showFavorites()
  }
  showFavorites()
  showPipelines()

  search.addEventListener('input', () => renderList(list, metas, selected, search.value))

  list.addEventListener('change', e => {
    const target = e.target
    if (!(target instanceof HTMLInputElement) || target.type !== 'checkbox') return
    const without = selected.filter(id => id !== target.value)
    edit(target.checked ? [...without, target.value] : without, true)
  })

  favoritesList.addEventListener('click', e => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-action]')
    const index = Number(button?.closest('li')?.dataset.index)
    if (!button || !Number.isInteger(index)) return
    const action = button.dataset.action ?? ''
    edit(action === 'remove' ? selected.filter((_, i) => i !== index) : move(selected, index, action === 'up' ? -1 : 1))
    refocus(favoritesList, index, action)
  })

  baseUrlInput.addEventListener('input', () => {
    baseUrlInput.removeAttribute('aria-invalid')
    dirty = true
    say(status, 'Unsaved changes.')
  })

  const save = async (ids: string[], url: string, done: string) => {
    try {
      await Promise.all([setMenuUtilities(ids), setBaseUrl(url)])
      dirty = false
      savedBaseUrl = url
      say(status, done)
      showPipelines() // "Open in app" links follow the base URL
    } catch (e) {
      say(status, `Could not save: ${errorText(e)}`, true)
    }
  }

  byId<HTMLButtonElement>('save').addEventListener('click', () => {
    const url = normalizeBaseUrl(baseUrlInput.value || DEFAULT_BASE_URL)
    if (!url) {
      baseUrlInput.setAttribute('aria-invalid', 'true')
      say(status, 'Not saved. The address needs to start with https:// or http://.', true)
      baseUrlInput.focus()
      return
    }
    baseUrlInput.value = url
    void save([...selected], url, 'Saved. The menu is updated.')
  })

  byId<HTMLButtonElement>('reset').addEventListener('click', () => {
    selected = [...DEFAULT_MENU_UTILITIES]
    baseUrlInput.value = DEFAULT_BASE_URL
    baseUrlInput.removeAttribute('aria-invalid')
    showFavorites()
    void save([...selected], DEFAULT_BASE_URL, 'Back to the defaults.')
  })

  const commitPipelines = async (next: SavedPipeline[], done: string) => {
    try {
      await setPipelines(next)
      pipelines = next
      say(pipelineStatus, done)
    } catch (e) {
      say(pipelineStatus, `Could not save: ${errorText(e)}`, true)
    }
    showPipelines()
  }

  // Deleting takes two clicks on the same button: the first turns it into
  // "Confirm delete" for a few seconds.
  let confirming: { button: HTMLButtonElement; timer: ReturnType<typeof setTimeout> } | null = null
  const resetConfirm = () => {
    if (!confirming) return
    clearTimeout(confirming.timer)
    const { button } = confirming
    button.textContent = 'Delete'
    button.classList.remove('confirming')
    button.setAttribute('aria-label', button.dataset.label ?? 'Delete')
    confirming = null
  }
  const askToConfirm = (button: HTMLButtonElement, pipeline: SavedPipeline) => {
    resetConfirm()
    button.dataset.label = button.getAttribute('aria-label') ?? ''
    button.textContent = 'Confirm delete'
    button.classList.add('confirming')
    button.setAttribute('aria-label', `Confirm delete ${quoted(pipeline.name)}`)
    say(pipelineStatus, `Delete ${quoted(pipeline.name)}? Select Confirm delete to go ahead.`)
    confirming = { button, timer: setTimeout(resetConfirm, CONFIRM_MS) }
  }

  pipelinesList.addEventListener('click', e => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-action]')
    const index = Number(button?.closest('li')?.dataset.index)
    const pipeline = pipelines[index]
    if (!button || !pipeline) return
    const action = button.dataset.action ?? ''
    if (action === 'remove' && confirming?.button !== button) {
      askToConfirm(button, pipeline)
      return
    }
    resetConfirm()
    const next = action === 'remove' ? pipelines.filter((_, i) => i !== index) : move(pipelines, index, action === 'up' ? -1 : 1)
    void commitPipelines(next, action === 'remove' ? `Deleted ${quoted(pipeline.name)}.` : 'Order saved.')
      .then(() => refocus(pipelinesList, index, action))
  })

  pipelinesList.addEventListener('keydown', e => {
    const input = e.target
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('pipeline-name')) return
    if (e.key === 'Escape') input.value = pipelines[Number(input.closest('li')?.dataset.index)]?.name ?? input.value
    if (e.key === 'Enter' || e.key === 'Escape') input.blur()
  })

  pipelinesList.addEventListener('change', e => {
    const input = e.target
    if (!(input instanceof HTMLInputElement) || !input.classList.contains('pipeline-name')) return
    const index = Number(input.closest('li')?.dataset.index)
    const pipeline = pipelines[index]
    if (!pipeline) return
    const name = normalizePipelineName(input.value)
    const clash = pipelines.some((p, i) => i !== index && p.name.toLocaleLowerCase() === name.toLocaleLowerCase())
    if (!name || clash) {
      input.value = pipeline.name
      say(pipelineStatus, name ? `There’s already a pipeline called ${quoted(name)}.` : 'A pipeline needs a name.', true)
      return
    }
    if (name === pipeline.name) {
      input.value = name
      return
    }
    void commitPipelines(pipelines.map((p, i) => (i === index ? { ...p, name, updatedAt: Date.now() } : p)), `Renamed to ${quoted(name)}.`)
  })

  byId<HTMLFormElement>('import-form').addEventListener('submit', e => {
    e.preventDefault()
    const payload = sharePayload(importInput.value)
    if (!payload) {
      say(pipelineStatus, 'Paste a share link from the website. It has #/p/ in it.', true)
      return
    }
    let doc
    try {
      doc = decodeShare(payload)
    } catch (e) {
      say(pipelineStatus, errorText(e), true)
      return
    }
    const outcome = upsertPipeline(pipelines, doc.name || 'Imported pipeline', doc.steps, Date.now())
    if (!outcome.ok) {
      say(pipelineStatus, outcome.error, true)
      return
    }
    importInput.value = ''
    const { saved, replaced } = outcome.value
    void commitPipelines(outcome.value.list, `${replaced ? 'Updated' : 'Added'} ${quoted(saved.name)}.`)
  })

  // Changes from elsewhere — the web app's "save to extension", another options tab.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pipelines) {
      void getPipelines().then(next => {
        if (JSON.stringify(next) === JSON.stringify(pipelines)) return
        pipelines = next
        showPipelines()
      })
    }
    // Unsaved edits win; they are saved over this on Save.
    if (area === 'sync' && changes.menuUtilities && !dirty) {
      void getMenuUtilities().then(next => {
        selected = next.filter(id => getEdgeSafeUtilityMeta(id))
        showFavorites()
      })
    }
  })
}

/** Started immediately; exported so tests can await full startup. */
export const ready: Promise<void> = init()
