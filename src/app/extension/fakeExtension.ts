/**
 * Test double for the browser extension as a page sees it: the
 * `chrome.runtime.sendMessage(extensionId, …)` Chrome exposes when an
 * installed extension is externally connectable from the page.
 */
import { vi } from 'vitest'
import type { BridgeResult } from '@/core/extensionBridge'

export interface FakeExtension {
  /** Messages the app sent, with the id it sent them to. */
  sent: Array<{ id: string; message: Record<string, any> }>
  /** Answer requests with `fn(request)`; a function returning undefined never answers. */
  respond(fn: (request: Record<string, any>) => BridgeResult | undefined): void
}

/** Installs `chrome.runtime` with an extension (by default the store one) answering pings with `version`. */
export function installFakeExtension({ id = 'onmlbgadajghegkcpkkhlmmognihjfbh', version = '1.0.0' } = {}): FakeExtension {
  let responder: (request: Record<string, any>) => BridgeResult | undefined = () => ({ ok: true, message: 'ok' })
  const runtime: { lastError?: { message: string }; sendMessage: ReturnType<typeof vi.fn> } = {
    sendMessage: vi.fn((target: string, message: Record<string, any>, callback: (response: unknown) => void) => {
      fake.sent.push({ id: target, message })
      queueMicrotask(() => {
        if (target !== id) {
          runtime.lastError = { message: 'Could not establish connection. Receiving end does not exist.' }
          callback(undefined)
          delete runtime.lastError
          return
        }
        const answer = message.type === 'ping' ? { protocol: 1, version } : responder(message.request)
        if (answer !== undefined) callback(answer)
      })
    }),
  }
  const fake: FakeExtension = { sent: [], respond: fn => { responder = fn } }
  vi.stubGlobal('chrome', { runtime })
  return fake
}
