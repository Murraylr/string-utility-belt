import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readPref, writePref } from '@/app/prefs'
import { countEvent } from '@/app/events/countEvent'
import IntegrationsNav from './IntegrationsNav'
import { CHROME_WEB_STORE_URL, INTEGRATIONS_SEEN_PREF, VSCODE_MARKETPLACE_URL } from './links'

vi.mock('@/app/events/countEvent', () => ({ countEvent: vi.fn() }))

const nav = () => screen.getByRole('navigation', { name: 'Integrations' })
// stands in for the app's link handler (or the browser): jsdom cannot follow a link
const holdNavigation = (e: MouseEvent) => e.preventDefault()

describe('IntegrationsNav', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(countEvent).mockClear()
    document.addEventListener('click', holdNavigation)
  })
  afterEach(() => document.removeEventListener('click', holdNavigation))

  it('links Chrome and VS Code to their store pages in a new tab, and the MCP server and CLI to their install sections', () => {
    render(<IntegrationsNav />)
    const links = within(nav()).getAllByRole('link')
    expect(links.map(a => a.getAttribute('href'))).toEqual([
      CHROME_WEB_STORE_URL,
      VSCODE_MARKETPLACE_URL,
      '/integrations/#mcp-server-for-ai-agents',
      '/integrations/#command-line-tool',
    ])
    const [chrome, vscode, mcp, cli] = links
    for (const store of [chrome, vscode]) {
      expect(store.getAttribute('target')).toBe('_blank')
      expect(store.getAttribute('rel')).toBe('noopener')
    }
    // in-site links stay in the tab, so the app's link handler navigates in place
    expect(mcp.hasAttribute('target')).toBe(false)
    expect(cli.hasAttribute('target')).toBe(false)
  })

  it('names each link starting with its visible label, so voice control and screen readers agree', () => {
    render(<IntegrationsNav />)
    const names = within(nav()).getAllByRole('link').map(a => a.getAttribute('aria-label'))
    expect(names[0]).toMatch(/^Chrome extension\b.*new tab/)
    expect(names[1]).toMatch(/^VS Code extension\b.*new tab/)
    expect(names[2]).toMatch(/^MCP server/)
    expect(names[3]).toMatch(/^CLI\b/)
    for (const link of within(nav()).getAllByRole('link')) {
      expect(link.getAttribute('title')).toBe(link.getAttribute('aria-label'))
      expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    }
  })

  it('marks itself new until a link is followed, then remembers that', () => {
    const { unmount } = render(<IntegrationsNav />)
    expect(screen.getByTestId('integrations-new').textContent).toBe('New')
    fireEvent.click(within(nav()).getByRole('link', { name: /^CLI/ }))
    expect(screen.queryByTestId('integrations-new')).toBeNull()
    expect(readPref(INTEGRATIONS_SEEN_PREF, false)).toBe(true)
    unmount()
    render(<IntegrationsNav />)
    expect(screen.queryByTestId('integrations-new')).toBeNull()
  })

  it('drops the marker when the integrations page marks it seen elsewhere', () => {
    render(<IntegrationsNav />)
    expect(screen.getByTestId('integrations-new')).toBeTruthy()
    act(() => writePref(INTEGRATIONS_SEEN_PREF, true))
    expect(screen.queryByTestId('integrations-new')).toBeNull()
  })

  it('counts which integration was followed from the header, never anything else', () => {
    render(<IntegrationsNav />)
    fireEvent.click(within(nav()).getByRole('link', { name: /^VS Code/ }))
    expect(countEvent).toHaveBeenCalledWith({ name: 'integration_click', integration: 'vscode', source: 'header' })
  })
})
