/**
 * Options page: favourite utilities (the context menu's "Apply:" items, in
 * order), the app's base URL, and saved pipelines (the "Pipeline:" items).
 * Favourites and the URL are a form saved with the Save button; pipeline
 * changes apply immediately, and the page follows changes made elsewhere
 * (the web app's "save to extension") while it is open.
 */
import { decodeShare, encodeShare } from '../../../src/core/serialize'
import { MAX_PIPELINE_NAME, normalizePipelineName } from '../../../src/core/extensionBridge'
import { countSteps, isBranchStep, isMacroStep } from '../../../src/core/steps'
import type { UtilityMeta } from '../../../src/core/registry'
import type { PipelineStep } from '../../../src/types/utility'
import { DEFAULT_BASE_URL, DEFAULT_MENU_UTILITIES } from './lib/constants'
import { move, upsertPipeline } from './lib/library'
import { edgeSafeUtilities, getEdgeSafeUtilityMeta, getUtilityMeta } from './lib/registry'
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

function matches(meta: UtilityMeta, query: string): boolean {
  if (!query) return true
  return [meta.id, meta.name, meta.category, ...meta.tags, ...meta.aliases]
    .some(s => s.toLowerCase().includes(query))
}

function renderList(container: HTMLElement, metas: UtilityMeta[], selected: string[], query: string): void {
  container.innerHTML = ''
  container.appendChild(el('legend', { textContent: 'All utilities' }))

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
  if (shown === 0) container.appendChild(el('p', { textContent: 'No utilities match your search.' }))
}

function actionButton(text: string, action: string, label: string, disabled = false): HTMLButtonElement {
  const button = el('button', { type: 'button', textContent: text, disabled })
  button.dataset.action = action
  button.setAttribute('aria-label', label)
  if (action === 'remove') button.className = 'danger'
  return button
}

/** One row of an ordered list: the label content, then move up / move down / remove buttons. */
function itemRow(label: string, index: number, total: number, content: Node[], removeText = 'Remove'): HTMLLIElement {
  const li = el('li')
  li.dataset.index = String(index)
  const grow = el('div', { className: 'grow' })
  grow.append(...content)
  li.append(
    grow,
    actionButton('↑', 'up', `Move ${label} up`, index === 0),
    actionButton('↓', 'down', `Move ${label} down`, index === total - 1),
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
  metas.forEach((meta, i) => list.appendChild(itemRow(meta.name, i, metas.length, [document.createTextNode(meta.name)])))
  empty.hidden = metas.length > 0
}

function stepTitle(step: PipelineStep): string {
  if (isBranchStep(step)) return `branch (${step.branches.length} lanes)`
  if (isMacroStep(step)) return step.name
  return step.label || getUtilityMeta(step.utilityId)?.name || step.utilityId
}

/** "3 steps: base64 decode → json pretty → trim", for a pipeline's row. */
export function pipelineSummary(steps: PipelineStep[]): string {
  const n = countSteps(steps)
  return `${n} ${n === 1 ? 'step' : 'steps'}: ${steps.map(stepTitle).join(' → ')}`
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
    const summary = el('span', { className: 'summary', textContent: pipelineSummary(pipeline.steps), title: pipelineSummary(pipeline.steps) })
    const open = el('a', { href: pipelineAppUrl(baseUrl, pipeline), target: '_blank', rel: 'noopener noreferrer', textContent: 'Open in app' })
    open.className = 'summary'
    list.appendChild(itemRow(`"${pipeline.name}"`, i, pipelines.length, [name, summary, open], 'Delete'))
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
  const status = byId<HTMLDivElement>('status')
  const favoritesList = byId<HTMLOListElement>('favorites')
  const favoritesEmpty = byId<HTMLElement>('favorites-empty')
  const pipelinesList = byId<HTMLOListElement>('pipelines')
  const pipelinesEmpty = byId<HTMLElement>('pipelines-empty')
  const pipelineStatus = byId<HTMLDivElement>('pipeline-status')
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
    status.textContent = 'Unsaved changes.'
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
  })

  const save = async (ids: string[], url: string, done: string) => {
    try {
      await Promise.all([setMenuUtilities(ids), setBaseUrl(url)])
      dirty = false
      savedBaseUrl = url
      status.textContent = done
      showPipelines() // "Open in app" links follow the base URL
    } catch (e) {
      status.textContent = `Could not save: ${errorText(e)}`
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
    selected = [...DEFAULT_MENU_UTILITIES]
    baseUrlInput.value = DEFAULT_BASE_URL
    baseUrlInput.removeAttribute('aria-invalid')
    showFavorites()
    void save([...selected], DEFAULT_BASE_URL, 'Reset to defaults.')
  })

  const commitPipelines = async (next: SavedPipeline[], done: string) => {
    try {
      await setPipelines(next)
      pipelines = next
      pipelineStatus.textContent = done
    } catch (e) {
      pipelineStatus.textContent = `Could not save: ${errorText(e)}`
    }
    showPipelines()
  }

  pipelinesList.addEventListener('click', e => {
    const button = (e.target as Element).closest<HTMLButtonElement>('button[data-action]')
    const index = Number(button?.closest('li')?.dataset.index)
    const pipeline = pipelines[index]
    if (!button || !pipeline) return
    const action = button.dataset.action ?? ''
    if (action === 'remove' && !window.confirm(`Delete the pipeline "${pipeline.name}"?`)) return
    const next = action === 'remove' ? pipelines.filter((_, i) => i !== index) : move(pipelines, index, action === 'up' ? -1 : 1)
    void commitPipelines(next, action === 'remove' ? `Deleted "${pipeline.name}".` : 'Order saved.')
      .then(() => refocus(pipelinesList, index, action))
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
      pipelineStatus.textContent = name ? `Another pipeline is already named "${name}".` : 'A pipeline needs a name.'
      return
    }
    if (name === pipeline.name) {
      input.value = name
      return
    }
    void commitPipelines(pipelines.map((p, i) => (i === index ? { ...p, name, updatedAt: Date.now() } : p)), `Renamed to "${name}".`)
  })

  byId<HTMLButtonElement>('import').addEventListener('click', () => {
    const payload = sharePayload(importInput.value)
    if (!payload) {
      pipelineStatus.textContent = 'Paste a share link from the web app (it contains #/p/).'
      return
    }
    let doc
    try {
      doc = decodeShare(payload)
    } catch (e) {
      pipelineStatus.textContent = errorText(e)
      return
    }
    const outcome = upsertPipeline(pipelines, doc.name || 'Imported pipeline', doc.steps, Date.now())
    if (!outcome.ok) {
      pipelineStatus.textContent = outcome.error
      return
    }
    importInput.value = ''
    const { saved, replaced } = outcome.value
    void commitPipelines(outcome.value.list, `${replaced ? 'Updated' : 'Added'} "${saved.name}".`)
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
