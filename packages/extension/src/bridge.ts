/**
 * Content script on the web app's own origin (see `BRIDGE_ORIGINS`): lets the
 * app see that the extension is installed and relays its "save to extension"
 * requests to the service worker, which validates and stores them. Built as one
 * classic script (content scripts can't be ES modules); keep its imports to
 * the small protocol module.
 */
import {
  BRIDGE_PROTOCOL, EXTENSION_SOURCE, isAppMessage, type BridgeResult, type ExtensionMessage,
} from '../../../src/core/extensionBridge'
import { BRIDGE_REQUEST } from './lib/constants'

const post = (message: ExtensionMessage) => window.postMessage(message, window.location.origin)

const announce = () =>
  post({ source: EXTENSION_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'hello', version: chrome.runtime.getManifest().version })

const isResult = (v: unknown): v is BridgeResult =>
  !!v && typeof v === 'object' && ((v as BridgeResult).ok === true || (v as BridgeResult).ok === false)

async function relay(request: unknown): Promise<BridgeResult> {
  try {
    const result: unknown = await chrome.runtime.sendMessage({ type: BRIDGE_REQUEST, request })
    return isResult(result) ? result : { ok: false, error: 'The extension did not answer.' }
  } catch {
    // The extension was reloaded or updated since this page loaded: this script is orphaned.
    return { ok: false, error: 'The extension was updated. Reload this page and try again.' }
  }
}

function onMessage(event: MessageEvent): void {
  // Only the page itself — not a frame, another window, or another origin.
  if (event.source !== window || event.origin !== window.location.origin || !isAppMessage(event.data)) return
  const data = event.data
  if (data.type === 'ping') {
    announce()
    return
  }
  if (data.protocol !== BRIDGE_PROTOCOL) {
    post({ source: EXTENSION_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'response', requestId: data.requestId, result: { ok: false, error: 'This page and the extension are different versions. Update the extension and reload the page.' } })
    return
  }
  void relay(data.request).then(result =>
    post({ source: EXTENSION_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'response', requestId: data.requestId, result }))
}

window.addEventListener('message', onMessage)
// The app may already be listening (it also pings on start, in case it isn't yet).
announce()
