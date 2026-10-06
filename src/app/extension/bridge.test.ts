import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { APP_SOURCE, BRIDGE_PROTOCOL, EXTENSION_SOURCE } from '@/core/extensionBridge'
import { __resetExtensionBridgeForTests, getExtension, sendToExtension, subscribeExtension, useExtension } from './bridge'
import { fromExtension, installFakeExtension, type FakeExtension } from './fakeExtension'

let fake: FakeExtension

beforeEach(() => {
  __resetExtensionBridgeForTests()
  fake = installFakeExtension()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('extension presence', () => {
  it('pings on subscribe and reports the extension once it says hello', () => {
    const { result } = renderHook(() => useExtension())
    expect(result.current).toBeNull()
    expect(fake.posted).toEqual([{ source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'ping' }])
    expect(window.postMessage).toHaveBeenCalledWith(expect.anything(), window.location.origin)

    act(() => fake.hello('2.0.0'))
    expect(result.current).toEqual({ version: '2.0.0' })
  })

  it('hears a hello that arrives before anything subscribed', () => {
    const unsubscribe = subscribeExtension(() => {})
    unsubscribe()
    fake.hello()
    expect(getExtension()).toEqual({ version: '1.0.0' })
  })

  it('ignores a hello from another origin or another window', () => {
    subscribeExtension(() => {})
    const hello = { source: EXTENSION_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'hello', version: '1' }
    fromExtension(hello, { origin: 'https://evil.example' })
    fromExtension(hello, { source: null })
    expect(getExtension()).toBeNull()
  })
})

describe('sendToExtension', () => {
  it('posts the request and resolves with the answer to its own request id', async () => {
    fake.autoRespond(() => ({ ok: true, message: 'Saved' }))
    const request = { type: 'add-favorites' as const, utilityIds: ['trim'] }
    await expect(sendToExtension(request)).resolves.toEqual({ ok: true, message: 'Saved' })
    expect(fake.posted[fake.posted.length - 1]).toMatchObject({ source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'request', request })
  })

  it('ignores answers to other requests', async () => {
    const pending = sendToExtension({ type: 'add-favorites', utilityIds: [] })
    const { requestId } = fake.posted[fake.posted.length - 1]!
    fake.respond('someone-else', { ok: false, error: 'not yours' })
    fake.respond(requestId, { ok: true, message: 'mine' })
    await expect(pending).resolves.toEqual({ ok: true, message: 'mine' })
  })

  it('gives up with an error result when the extension never answers', async () => {
    vi.useFakeTimers()
    const pending = sendToExtension({ type: 'add-favorites', utilityIds: [] }, 1000)
    vi.advanceTimersByTime(1000)
    await expect(pending).resolves.toEqual({ ok: false, error: expect.stringMatching(/did not answer/) })
  })
})
