import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import InstallButton from './InstallButton'
import { canInstall, promptInstall, __resetForTests } from './installPrompt'

function makePromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true }) as any
  event.prompt = vi.fn(async () => {})
  event.userChoice = Promise.resolve({ outcome, platform: 'web' })
  return event
}

function firePrompt(outcome?: 'accepted' | 'dismissed') {
  const event = makePromptEvent(outcome)
  act(() => { window.dispatchEvent(event) })
  return event
}

describe('InstallButton', () => {
  beforeEach(() => __resetForTests())

  it('is hidden until beforeinstallprompt fires', () => {
    render(<InstallButton />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an accessible install control after the browser signals installability, suppressing the mini-infobar', () => {
    render(<InstallButton />)
    const event = firePrompt()
    expect(event.defaultPrevented).toBe(true)
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument()
  })

  it('still shows when the browser fired beforeinstallprompt before the button mounted', () => {
    firePrompt()
    render(<InstallButton />)
    expect(screen.getByRole('button', { name: /install app/i })).toBeInTheDocument()
  })

  it('prompts and hides itself again once the user responds', async () => {
    const user = userEvent.setup()
    render(<InstallButton />)
    const event = firePrompt('dismissed')
    await user.click(screen.getByRole('button', { name: /install app/i }))
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('hides on appinstalled even without a prior click', () => {
    render(<InstallButton />)
    firePrompt()
    expect(screen.getByRole('button')).toBeInTheDocument()
    act(() => { window.dispatchEvent(new Event('appinstalled')) })
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})

describe('promptInstall', () => {
  beforeEach(() => __resetForTests())

  it('reports unavailable when the browser never offered an install', async () => {
    expect(await promptInstall()).toBe('unavailable')
  })

  it('uses a prompt only once and reports the outcome', async () => {
    const event = makePromptEvent('accepted')
    window.dispatchEvent(event)
    expect(canInstall()).toBe(true)
    expect(await promptInstall()).toBe('accepted')
    expect(canInstall()).toBe(false)
    expect(await promptInstall()).toBe('unavailable')
    expect(event.prompt).toHaveBeenCalledTimes(1)
  })

  it('treats a prompt that throws (already used, no user gesture) as dismissed instead of rejecting', async () => {
    const event = makePromptEvent()
    event.prompt = vi.fn(async () => { throw new DOMException('already shown', 'InvalidStateError') })
    window.dispatchEvent(event)
    expect(await promptInstall()).toBe('dismissed')
    expect(canInstall()).toBe(false)
  })
})
