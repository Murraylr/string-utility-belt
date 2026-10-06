import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { APP_SOURCE, BRIDGE_PROTOCOL, EXTENSION_SOURCE } from '../../../src/core/extensionBridge'

const sendMessage = vi.fn()
const posted: unknown[] = []

/** A message as the page would post it: from this window, at this origin. */
function fromPage(data: unknown, init: Partial<MessageEventInit> = {}) {
  window.dispatchEvent(new MessageEvent('message', { data, origin: window.location.origin, source: window, ...init }))
}

const responses = () => posted.filter((m): m is { type: 'response'; requestId: string; result: unknown } =>
  (m as { type?: string }).type === 'response')

beforeAll(async () => {
  vi.stubGlobal('chrome', { runtime: { sendMessage, getManifest: () => ({ version: '9.9.9' }) } })
  vi.spyOn(window, 'postMessage').mockImplementation((message: unknown) => { posted.push(message) })
  await import('./bridge')
})

beforeEach(() => {
  sendMessage.mockReset()
})

afterEach(() => {
  posted.length = 0
})

describe('page bridge content script', () => {
  it('announces itself on load, and again whenever the app pings', () => {
    const hello = { source: EXTENSION_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'hello', version: '9.9.9' }
    expect(posted).toEqual([hello]) // on load (this is the first test)
    fromPage({ source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'ping' })
    expect(posted).toEqual([hello, hello])
    expect(window.postMessage).toHaveBeenCalledWith(expect.anything(), window.location.origin)
  })

  it('relays a request to the service worker and posts its answer back under the request id', async () => {
    sendMessage.mockResolvedValue({ ok: true, message: 'Saved' })
    const request = { type: 'add-favorites', utilityIds: ['trim'] }
    fromPage({ source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'request', requestId: 'r1', request })

    await vi.waitFor(() => expect(responses()).toHaveLength(1))
    expect(sendMessage).toHaveBeenCalledWith({ type: 'subelt-bridge-request', request })
    expect(responses()[0]).toEqual({ source: EXTENSION_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'response', requestId: 'r1', result: { ok: true, message: 'Saved' } })
  })

  it('answers with an error when the extension was reloaded under the page', async () => {
    sendMessage.mockRejectedValue(new Error('Extension context invalidated.'))
    fromPage({ source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'request', requestId: 'r2', request: {} })
    await vi.waitFor(() => expect(responses()[0]?.result).toEqual({ ok: false, error: expect.stringMatching(/reload this page/i) }))
  })

  it('refuses a request from an incompatible protocol version without relaying it', () => {
    fromPage({ source: APP_SOURCE, protocol: BRIDGE_PROTOCOL + 1, type: 'request', requestId: 'r3', request: {} })
    expect(sendMessage).not.toHaveBeenCalled()
    expect(responses()[0]?.result).toMatchObject({ ok: false })
  })

  it('ignores messages from another origin, another window or frame, and anything that is not the app', () => {
    const ping = { source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'ping' }
    fromPage(ping, { origin: 'https://evil.example' })
    fromPage(ping, { source: null })
    fromPage({ ...ping, source: 'someone-else' })
    fromPage({ source: APP_SOURCE, type: 'request', request: {} }) // no request id
    expect(posted).toEqual([])
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
