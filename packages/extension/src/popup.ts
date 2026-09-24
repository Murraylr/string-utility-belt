/**
 * The toolbar popup: a mini single-utility runner. Plain TS + DOM (no React,
 * no bundler-heavy UI kit) to keep this entry small — it is loaded fresh on
 * every open.
 */
import { validateParams } from '../../../src/core/params'
import type { UtilityMeta } from '../../../src/core/registry'
import { edgeSafeUtilities, resultToText, runUtilityById } from './lib/registry'
import { readParamValues, renderParamControls } from './lib/paramControls'
import { getBaseUrl, getLastError, getLastResult, setLastError, setLastResult } from './lib/storage'

function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`missing #${id}`)
  return el as T
}

function populateUtilitySelect(select: HTMLSelectElement, metas: UtilityMeta[]): void {
  select.innerHTML = ''
  let group: HTMLOptGroupElement | null = null
  for (const meta of metas) {
    if (!group || group.label !== meta.category) {
      group = document.createElement('optgroup')
      group.label = meta.category
      select.appendChild(group)
    }
    const option = document.createElement('option')
    option.value = meta.id
    option.textContent = meta.name
    group.appendChild(option)
  }
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

  populateUtilitySelect(utilitySelect, metas)
  if (metas.length > 0) utilitySelect.value = metas[0].id

  const currentMeta = () => metas.find(m => m.id === utilitySelect.value)
  const renderParams = () => {
    const meta = currentMeta()
    if (meta) renderParamControls(paramsEl, meta)
  }
  renderParams()
  utilitySelect.addEventListener('change', renderParams)

  const [lastResult, lastError, baseUrl] = await Promise.all([getLastResult(), getLastError(), getBaseUrl()])
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
  runButton.addEventListener('click', () => {
    const meta = currentMeta()
    if (!meta) return
    const ticket = ++latestRun
    errorEl.textContent = ''
    const params = readParamValues(paramsEl, meta)
    const problem = paramProblem(meta, params)
    if (problem) {
      errorEl.textContent = problem
      return
    }
    statusEl.textContent = 'Running…'
    outputEl.setAttribute('aria-busy', 'true')
    runUtilityById(meta.id, inputEl.value, params)
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
