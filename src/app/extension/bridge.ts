/**
 * The app's side of the browser-extension bridge (protocol: `@/core/extensionBridge`).
 * The extension's content script runs only in the top frame of the site's own
 * origin; it says "hello" when it loads and whenever the app pings, and relays
 * requests to the extension, which validates them again before storing anything.
 */
import { useSyncExternalStore } from 'react'
import {
  APP_SOURCE, BRIDGE_PROTOCOL, isExtensionMessage, type AppMessage, type AppRequest, type BridgeResult,
} from '@/core/extensionBridge'
import { stepId } from '@/core/steps'

export interface ExtensionInfo {
  version: string
}

/** How long a request may take before the app gives up on the extension answering. */
export const REQUEST_TIMEOUT_MS = 10_000

let extension: ExtensionInfo | null = null
const subscribers = new Set<() => void>()
const pending = new Map<string, (result: BridgeResult) => void>()
let listening = false

const post = (message: AppMessage) => window.postMessage(message, window.location.origin)

function onMessage(event: MessageEvent): void {
  // The content script posts to this window from this origin; anything else is someone else's.
  if (event.source !== window || event.origin !== window.location.origin || !isExtensionMessage(event.data)) return
  const data = event.data
  if (data.type === 'hello') {
    if (extension?.version === data.version) return
    extension = { version: data.version }
    subscribers.forEach(notify => notify())
    return
  }
  const settle = pending.get(data.requestId)
  pending.delete(data.requestId)
  settle?.(data.result)
}

function listen(): void {
  if (listening || typeof window === 'undefined') return
  window.addEventListener('message', onMessage)
  listening = true
}

/** `useSyncExternalStore`-shaped: `notify` runs when the extension announces itself. */
export function subscribeExtension(notify: () => void): () => void {
  listen()
  subscribers.add(notify)
  // The content script also says hello on load; this covers it having loaded first.
  if (!extension) post({ source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'ping' })
  return () => { subscribers.delete(notify) }
}

export const getExtension = (): ExtensionInfo | null => extension

/** The installed extension, or null until (unless) it announces itself on this page. */
export function useExtension(): ExtensionInfo | null {
  return useSyncExternalStore(subscribeExtension, getExtension, () => null)
}

/** Sends `request` to the extension. Never rejects: no answer within `timeoutMs` is an error result. */
export function sendToExtension(request: AppRequest, timeoutMs: number = REQUEST_TIMEOUT_MS): Promise<BridgeResult> {
  listen()
  const requestId = stepId('req')
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.delete(requestId)
      resolve({ ok: false, error: 'The extension did not answer. Reload the page and try again.' })
    }, timeoutMs)
    pending.set(requestId, result => {
      clearTimeout(timer)
      resolve(result)
    })
    post({ source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'request', requestId, request })
  })
}

export function __resetExtensionBridgeForTests(): void {
  if (listening) window.removeEventListener('message', onMessage)
  listening = false
  extension = null
  subscribers.clear()
  pending.clear()
}
