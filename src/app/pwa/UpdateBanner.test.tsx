import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import UpdateBanner from './UpdateBanner'
import { registerSW, __resetForTests } from './registerSW'

/** Drives the real registerSW module into "an update is waiting" through a fake SW container. */
async function detectUpdate(waiting = { postMessage: vi.fn() }) {
  const container = new EventTarget() as unknown as ServiceWorkerContainer
  const reg = Object.assign(new EventTarget(), { waiting, installing: null })
  Object.assign(container, { controller: {}, register: vi.fn(async () => reg), ready: new Promise(() => {}) })
  Object.defineProperty(navigator, 'serviceWorker', { value: container, configurable: true })
  await act(async () => {
    registerSW({ prod: true, serviceWorkerSupported: true, isEmbedded: () => false })
    for (let i = 0; i < 5; i++) await Promise.resolve()
  })
  return { container, waiting }
}

describe('UpdateBanner', () => {
  beforeEach(() => __resetForTests())
  afterEach(() => {
    // @ts-expect-error cleanup of a property the test defined
    delete navigator.serviceWorker
  })

  it('renders an empty polite live region (no visible banner, no button) until an update is announced', () => {
    render(<UpdateBanner />)
    const region = screen.getByRole('status')
    expect(region).toHaveTextContent('')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('announces the update in the pre-existing live region and posts SKIP_WAITING on Reload', async () => {
    const user = userEvent.setup()
    render(<UpdateBanner />)
    const region = screen.getByRole('status')
    const { waiting } = await detectUpdate()

    // same node: screen readers only announce changes to a region that was already in the DOM
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent(/new version is available/i)
    await user.click(screen.getByRole('button', { name: /reload/i }))
    expect(waiting.postMessage).toHaveBeenCalledWith('SKIP_WAITING')
  })

  it('shows immediately when it mounts after the update was already detected', async () => {
    await detectUpdate()
    render(<UpdateBanner />)
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  })
})
