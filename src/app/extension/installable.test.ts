import { describe, expect, it } from 'vitest'
import { canInstallExtension } from './installable'

describe('canInstallExtension', () => {
  it('is true for a desktop Chromium browser', () => {
    expect(canInstallExtension({ userAgentData: { mobile: false } })).toBe(true)
  })

  it('is false for Chromium on a phone, which has no extensions', () => {
    expect(canInstallExtension({ userAgentData: { mobile: true } })).toBe(false)
  })

  it('is false for browsers without userAgentData (Firefox, Safari)', () => {
    expect(canInstallExtension({})).toBe(false)
  })

  it('reads the page\'s own navigator by default', () => {
    Object.defineProperty(navigator, 'userAgentData', { value: { mobile: false }, configurable: true })
    try {
      expect(canInstallExtension()).toBe(true)
    } finally {
      delete (navigator as { userAgentData?: unknown }).userAgentData
    }
    expect(canInstallExtension()).toBe(false)
  })
})
