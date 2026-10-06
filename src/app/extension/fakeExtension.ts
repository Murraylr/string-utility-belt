/**
 * Test double for the browser extension's content script: captures what the app
 * posts and answers the way the real bridge does (from this window and origin).
 */
import { vi } from 'vitest'
import { BRIDGE_PROTOCOL, EXTENSION_SOURCE, type BridgeResult } from '@/core/extensionBridge'

export interface FakeExtension {
  /** Messages the app posted, in order. */
  posted: Array<Record<string, any>>
  hello(version?: string): void
  respond(requestId: string, result: BridgeResult): void
  /** Answer every request from now on with `fn(request)`. */
  autoRespond(fn: (request: Record<string, any>) => BridgeResult): void
}

export function fromExtension(data: unknown, init: Partial<MessageEventInit> = {}): void {
  window.dispatchEvent(new MessageEvent('message', { data, origin: window.location.origin, source: window, ...init }))
}

export function installFakeExtension(): FakeExtension {
  let responder: ((request: Record<string, any>) => BridgeResult) | null = null
  const fake: FakeExtension = {
    posted: [],
    hello: (version = '1.0.0') => fromExtension({ source: EXTENSION_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'hello', version }),
    respond: (requestId, result) =>
      fromExtension({ source: EXTENSION_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'response', requestId, result }),
    autoRespond: fn => { responder = fn },
  }
  vi.spyOn(window, 'postMessage').mockImplementation((message: any) => {
    fake.posted.push(message)
    if (responder && message?.type === 'request') {
      const result = responder(message.request)
      queueMicrotask(() => fake.respond(message.requestId, result))
    }
  })
  return fake
}
