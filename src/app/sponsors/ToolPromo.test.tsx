import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useExtensionStatus, type ExtensionStatus } from '@/app/extension/bridge'
import { canInstallExtension } from '@/app/extension/installable'
import { readPref } from '@/app/prefs'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
import ToolPromo from './ToolPromo'
import { PROMOS } from './promos'

vi.mock('@/app/extension/bridge', () => ({ useExtensionStatus: vi.fn() }))
vi.mock('@/app/extension/installable', () => ({ canInstallExtension: vi.fn() }))

function browser(status: ExtensionStatus, installable: boolean) {
  vi.mocked(useExtensionStatus).mockReturnValue(status)
  vi.mocked(canInstallExtension).mockReturnValue(installable)
}
beforeEach(() => localStorage.clear())

describe('ToolPromo', () => {
  it('offers the browser extension where it can be installed and is not', () => {
    browser('absent', true)
    render(<ToolPromo />)
    expect(screen.getByRole('complementary', { name: 'From String Utility Belt' }).getAttribute('data-promo')).toBe('chrome')
  })

  it('offers the VS Code extension once the browser extension is installed, or where it cannot be', () => {
    browser({ id: 'x', version: '1.4.1', stepTypes: ['utility'] }, true)
    const { unmount } = render(<ToolPromo />)
    expect(screen.getByRole('complementary').getAttribute('data-promo')).toBe('vscode')
    unmount()
    browser('absent', false)
    render(<ToolPromo />)
    expect(screen.getByRole('complementary').getAttribute('data-promo')).toBe('vscode')
  })

  it('shows nothing while the extension is still answering', () => {
    browser('checking', true)
    const { container } = render(<ToolPromo />)
    expect(container.innerHTML).toBe('')
  })

  it('is never labelled as a sponsor, and marks the integrations seen when followed', () => {
    browser('absent', false)
    render(<ToolPromo />)
    expect(screen.queryByRole('complementary', { name: 'Sponsor' })).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: new RegExp(PROMOS.vscode.name) }))
    expect(readPref(INTEGRATIONS_SEEN_PREF, false)).toBe(true)
  })
})
