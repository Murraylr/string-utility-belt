/**
 * The toolbar popup: a mini single-utility runner. Plain TS + DOM (no React,
 * no bundler-heavy UI kit) to keep this entry small — it is loaded fresh on
 * every open.
 */
import { validateParams } from '../../../src/core/params'
import type { UtilityMeta } from '../../../src/core/registry'
import type { Value } from '../../../src/types/utility'
import { edgeSafeUtilities, getEdgeSafeUtilityMeta, resultToText, runPipelineSteps, runUtilityById } from './lib/registry'
import { readParamValues, renderParamControls } from './lib/paramControls'
import {
  getBaseUrl, getLastError, getLastResult, getMenuUtilities, getPipelines, setLastError, setLastResult,
  type SavedPipeline,
} from './lib/storage'

/** Option values for saved pipelines; utility ids never contain a colon. */
const PIPELINE_VALUE = 'pipeline:'

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing #${id}`)
  return el as T
}

function addGroup(select: HTMLSelectElement, label: string, entries: Array<{ value: string; text: string }>): void {
  if (!entries.length) return
  const group = document.createElement('optgroup')
  group.label = label
  for (const { value, text } of entries) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    group.appendChild(option)
  }
  select.appendChild(group)
}

/** Favourites and saved pipelines first (the context menu's items), then every utility by category. */
function populateUtilitySelect(select: HTMLSelectElement, metas: UtilityMeta[], favorites: UtilityMeta[], pipelines: SavedPipeline[]): void {
  select.innerHTML = ''
  addGroup(select, 'Favourites', favorites.map(m => ({ value: m.id, text: m.name })))
  addGroup(select, 'Saved pipelines', pipelines.map(p => ({ value: `${PIPELINE_VALUE}${p.id}`, text: p.name })))
  const byCategory = new Map<string, UtilityMeta[]>()
  for (const meta of metas) byCategory.set(meta.category, [...(byCategory.get(meta.category) ?? []), meta])
  for (const [category, items] of byCategory) addGroup(select, category, items.map(m => ({ value: m.id, text: m.name })))
}

/** The first param problem as "<label>: <problem>", or null when all are valid. */
function paramProblem(meta: UtilityMeta, params: Record<string, unknown>): string | null {
  const [key, problem] = Object.entries(validateParams(meta, params))[0] ?? []
  return key ? `${meta.params[key]?.label ?? key}: ${problem}` : null
}

export async function init(): Promise<void> {
  const metas = edgeSafeUtilities()
  const utilitySelect = byId<HTMLSelectElement>('utility')
  const paramsEl = byId<HTMLDivElement>('params')
  const inputEl = byId<HTMLTextAreaElement>('input')
  const outputEl = byId<HTMLTextAreaElement>('output')
  const errorEl = byId<HTMLDivElement>('error')
  const statusEl = byId<HTMLDivElement>('status')
  const openAppLink = byId<HTMLAnchorElement>('open-app')
  const runButton = byId<HTMLButtonElement>('run')
  const copyButton = byId<HTMLButtonElement>('copy')

  const [lastResult, lastError, baseUrl, favoriteIds, pipelines] = await Promise.all([
    getLastResult(), getLastError(), getBaseUrl(), getMenuUtilities(), getPipelines(),
  ])
  const favorites = favoriteIds.map(getEdgeSafeUtilityMeta).filter((m): m is UtilityMeta => !!m)
  populateUtilitySelect(utilitySelect, metas, favorites, pipelines)
  const first = utilitySelect.querySelector('option')
  if (first) utilitySelect.value = first.value

  const currentMeta = () => metas.find(m => m.id === utilitySelect.value)
  const currentPipeline = () => utilitySelect.value.startsWith(PIPELINE_VALUE)
    ? pipelines.find(p => `${PIPELINE_VALUE}${p.id}` === utilitySelect.value)
    : undefined
  const renderParams = () => {
    const meta = currentMeta()
    if (meta) renderParamControls(paramsEl, meta)
    else paramsEl.innerHTML = '' // a saved pipeline runs with the params it was saved with
  }
  renderParams()
  utilitySelect.addEventListener('change', renderParams)

  inputEl.value = lastResult
  openAppLink.href = `${baseUrl}/`
  if (lastError) {
    // Shown once: the failure the context menu flagged with the toolbar badge.
    errorEl.textContent = lastError
    chrome.action?.setBadgeText?.({ text: '' })
    await setLastError('')
  }

  // Each run takes a ticket so a slow earlier run can't overwrite a newer result.
  let latestRun = 0
  /** The selected utility (with its params) or saved pipeline as a run, or an error message. */
  const prepare = (): (() => Promise<Value>) | string | null => {
    const pipeline = currentPipeline()
    if (pipeline) return () => runPipelineSteps(pipeline.steps, inputEl.value)
    const meta = currentMeta()
    if (!meta) return null
    const params = readParamValues(paramsEl, meta)
    return paramProblem(meta, params) ?? (() => runUtilityById(meta.id, inputEl.value, params))
  }

  runButton.addEventListener('click', () => {
    const job = prepare()
    if (!job) return
    const ticket = ++latestRun
    errorEl.textContent = ''
    if (typeof job === 'string') {
      errorEl.textContent = job
      return
    }
    statusEl.textContent = 'Running…'
    outputEl.setAttribute('aria-busy', 'true')
    job()
      .then(async out => {
        if (ticket !== latestRun) return
        const text = resultToText(out)
        outputEl.value = text
        statusEl.textContent = 'Done.'
        await setLastResult(text)
      })
      .catch((e: unknown) => {
        if (ticket !== latestRun) return
        outputEl.value = ''
        statusEl.textContent = ''
        errorEl.textContent = (e as Error)?.message || String(e)
      })
      .finally(() => {
        if (ticket === latestRun) outputEl.removeAttribute('aria-busy')
      })
  })

  copyButton.addEventListener('click', () => {
    navigator.clipboard.writeText(outputEl.value).then(
      () => { statusEl.textContent = 'Copied.' },
      () => { statusEl.textContent = 'Copy failed — select the result and copy it manually.' },
    )
  })
}

/** Started immediately: a `<script type="module">` only runs after the DOM it
 * references has parsed. Exported so tests can await full startup. */
export const ready: Promise<void> = init()
