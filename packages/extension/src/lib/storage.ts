/** Thin promise wrappers around the callback-style `chrome.storage` API. */
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

/** The context-menu utility ids the user has chosen; the built-in set until they save one (an empty list is a valid choice). */
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
