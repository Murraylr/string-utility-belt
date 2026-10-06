/** Thin promise wrappers around the callback-style `chrome.storage` API. */
import { normalizePipelineName } from '../../../../src/core/extensionBridge'
import { sanitizeSteps } from '../../../../src/core/serialize'
import type { PipelineStep } from '../../../../src/types/utility'
import { DEFAULT_BASE_URL, DEFAULT_MENU_UTILITIES } from './constants'

type Area = chrome.storage.StorageArea

const get = <T extends Record<string, unknown>>(area: Area, defaults: T): Promise<T> =>
  new Promise(resolve => area.get(defaults, items => resolve(items as T)))

/** Rejects with `chrome.runtime.lastError` (e.g. a sync quota error) instead of silently dropping the write. */
const set = (area: Area, items: Record<string, unknown>): Promise<void> =>
  new Promise((resolve, reject) => area.set(items, () => {
    const err = chrome.runtime?.lastError
    if (err) reject(new Error(err.message ?? 'storage write failed'))
    else resolve()
  }))

/** The favourite utility ids, in menu order — the context menu's "Apply:" items; the built-in set until the user saves one (an empty list is a valid choice). */
export async function getMenuUtilities(): Promise<string[]> {
  const { menuUtilities } = await get(chrome.storage.sync, { menuUtilities: [...DEFAULT_MENU_UTILITIES] as unknown })
  return Array.isArray(menuUtilities)
    ? menuUtilities.filter((id): id is string => typeof id === 'string')
    : [...DEFAULT_MENU_UTILITIES]
}

export const setMenuUtilities = (ids: string[]): Promise<void> => set(chrome.storage.sync, { menuUtilities: ids })

/**
 * `input` as a base URL for the web app — origin plus path, no trailing slash,
 * query or hash, so `${base}/?text=…` is always well-formed — or `null` unless
 * it is an absolute http(s) URL.
 */
export function normalizeBaseUrl(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '')
}

/** The web app's base URL used for "Open selection in String Utility Belt". */
export async function getBaseUrl(): Promise<string> {
  const { baseUrl } = await get(chrome.storage.sync, { baseUrl: DEFAULT_BASE_URL as unknown })
  return (typeof baseUrl === 'string' && normalizeBaseUrl(baseUrl)) || DEFAULT_BASE_URL
}

/** Saves a base URL; rejects anything `normalizeBaseUrl` refuses. */
export async function setBaseUrl(url: string): Promise<void> {
  const normalized = normalizeBaseUrl(url)
  if (!normalized) throw new Error('The app URL must be an absolute http(s) URL.')
  await set(chrome.storage.sync, { baseUrl: normalized })
}

/** Where the web app opens with `text` as its input (the app's share-target handler reads `?text=`). */
export function appUrl(baseUrl: string, text: string): string {
  return text ? `${baseUrl}/?text=${encodeURIComponent(text)}` : `${baseUrl}/`
}

/** The text the popup opens with: the last result the menu couldn't insert, or the input of a failed run. */
export async function getLastResult(): Promise<string> {
  const { lastResult } = await get(chrome.storage.local, { lastResult: '' as unknown })
  return typeof lastResult === 'string' ? lastResult : ''
}

export const setLastResult = (text: string): Promise<void> => set(chrome.storage.local, { lastResult: text })

/** Why the last context-menu run failed, for the popup to show once; '' when it didn't. */
export async function getLastError(): Promise<string> {
  const { lastError } = await get(chrome.storage.local, { lastError: '' as unknown })
  return typeof lastError === 'string' ? lastError : ''
}

export const setLastError = (message: string): Promise<void> => set(chrome.storage.local, { lastError: message })

/**
 * A named pipeline on the context menu. Kept in `chrome.storage.local`, not
 * `sync`: sync caps each item at 8 KB, which one pipeline with a lookup table or
 * a long regex can exceed, and a quota failure there would lose the save.
 */
export interface SavedPipeline {
  id: string
  name: string
  steps: PipelineStep[]
  updatedAt: number
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

/** Stored pipelines are re-validated on read: storage can be stale, hand-edited or from an older version. */
function readPipelines(raw: unknown): SavedPipeline[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: SavedPipeline[] = []
  for (const item of raw) {
    if (!isObj(item) || typeof item.id !== 'string' || !item.id || seen.has(item.id)) continue
    const name = typeof item.name === 'string' ? normalizePipelineName(item.name) : ''
    const steps = sanitizeSteps(item.steps)
    if (!name || !steps.length) continue
    seen.add(item.id)
    out.push({ id: item.id, name, steps, updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : 0 })
  }
  return out
}

export async function getPipelines(): Promise<SavedPipeline[]> {
  const { pipelines } = await get(chrome.storage.local, { pipelines: [] as unknown })
  return readPipelines(pipelines)
}

export const setPipelines = (pipelines: SavedPipeline[]): Promise<void> => set(chrome.storage.local, { pipelines })

/** A fresh pipeline id: random where the platform allows (every Chrome that runs MV3 does). */
export function newPipelineId(): string {
  return `p_${crypto.randomUUID()}`
}
