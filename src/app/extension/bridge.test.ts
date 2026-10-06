import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { APP_SOURCE, BRIDGE_PROTOCOL, STORE_EXTENSION_ID } from '@/core/extensionBridge'
import { __resetExtensionBridgeForTests, extensionIds, getExtension, sendToExtension, useExtension } from './bridge'
import { installFakeExtension } from './fakeExtension'

beforeEach(() => {
  __resetExtensionBridgeForTests()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('extensionIds', () => {
  it('tries the store extension first, then unpacked builds named at build time', () => {
    expect(extensionIds(undefined)).toEqual([STORE_EXTENSION_ID])
    expect(extensionIds(' abc , ,def,' + STORE_EXTENSION_ID)).toEqual([STORE_EXTENSION_ID, 'abc', 'def'])
  })
})

describe('extension presence', () => {
  it('pings the store extension and reports it once it answers', async () => {
    const fake = installFakeExtension({ version: '2.0.0' })
    const { result } = renderHook(() => useExtension())
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toEqual({ id: STORE_EXTENSION_ID, version: '2.0.0' }))
    expect(fake.sent).toEqual([{ id: STORE_EXTENSION_ID, message: { source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'ping' } }])
  })

  it('stays null when no extension is reachable from the page (no chrome.runtime)', async () => {
    renderHook(() => useExtension())
    await expect(sendToExtension({ type: 'add-favorites', utilityIds: [] })).resolves.toEqual({ ok: false, error: expect.stringMatching(/not installed/) })
    expect(getExtension()).toBeNull()
  })

  it('stays null when the store extension is not installed', async () => {
    const fake = installFakeExtension({ id: 'some-other-extension' })
    renderHook(() => useExtension())
    await waitFor(() => expect(fake.sent).toHaveLength(1))
    await new Promise(r => setTimeout(r, 0))
    expect(getExtension()).toBeNull()
  })
})

describe('sendToExtension', () => {
  it('sends the request to the extension it found and resolves with its answer', async () => {
    const fake = installFakeExtension()
    fake.respond(() => ({ ok: true, message: 'Saved' }))
    const request = { type: 'add-favorites' as const, utilityIds: ['trim'] }
    await expect(sendToExtension(request)).resolves.toEqual({ ok: true, message: 'Saved' })
    expect(fake.sent[fake.sent.length - 1]).toEqual({
      id: STORE_EXTENSION_ID, message: { source: APP_SOURCE, protocol: BRIDGE_PROTOCOL, type: 'request', request },
    })
  })

  it('turns a malformed answer into an error result', async () => {
    const fake = installFakeExtension()
    fake.respond(() => ({ nonsense: true }) as never)
    await expect(sendToExtension({ type: 'add-favorites', utilityIds: [] })).resolves.toMatchObject({ ok: false })
  })

  it('gives up with an error result when the extension never answers', async () => {
    const fake = installFakeExtension()
    await sendToExtension({ type: 'add-favorites', utilityIds: [] }) // detection done with real timers
    fake.respond(() => undefined)
    vi.useFakeTimers()
    const pending = sendToExtension({ type: 'add-favorites', utilityIds: [] }, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    await expect(pending).resolves.toEqual({ ok: false, error: expect.stringMatching(/did not answer/) })
  })
})
