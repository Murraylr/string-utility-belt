import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { track } from '@/app/analytics/analytics'
import { readPref, writePref } from '@/app/prefs'
import IntegrationsNav from './IntegrationsNav'
import { INTEGRATIONS_SEEN_PREF, VSCODE_MARKETPLACE_URL } from './links'

vi.mock('@/app/analytics/analytics', () => ({ track: vi.fn() }))

const nav = () => screen.getByRole('navigation', { name: 'Integrations' })
// stands in for the app's link handler (or the browser): jsdom cannot follow a link
const holdNavigation = (e: MouseEvent) => e.preventDefault()

describe('IntegrationsNav', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.mocked(track).mockClear()
    document.addEventListener('click', holdNavigation)
  })
  afterEach(() => document.removeEventListener('click', holdNavigation))

  it('links VS Code to its store page in a new tab, and the MCP server and CLI to their install sections', () => {
    render(<IntegrationsNav />)
    const links = within(nav()).getAllByRole('link')
    expect(links.map(a => a.getAttribute('href'))).toEqual([
      VSCODE_MARKETPLACE_URL,
      '/integrations/#mcp-server-for-ai-agents',
      '/integrations/#command-line-tool',
    ])
    const [vscode, mcp, cli] = links
    expect(vscode.getAttribute('target')).toBe('_blank')
    expect(vscode.getAttribute('rel')).toBe('noopener')
    // in-site links stay in the tab, so the app's link handler navigates in place
    expect(mcp.hasAttribute('target')).toBe(false)
    expect(cli.hasAttribute('target')).toBe(false)
  })

  it('names each link starting with its visible label, so voice control and screen readers agree', () => {
    render(<IntegrationsNav />)
    const names = within(nav()).getAllByRole('link').map(a => a.getAttribute('aria-label'))
    expect(names[0]).toMatch(/^VS Code extension\b.*new tab/)
    expect(names[1]).toMatch(/^MCP server/)
    expect(names[2]).toMatch(/^CLI\b/)
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

  it('reports which integration was followed, never anything else', () => {
    render(<IntegrationsNav />)
    fireEvent.click(within(nav()).getByRole('link', { name: /^VS Code/ }))
    expect(track).toHaveBeenCalledWith('integration_click', { integration: 'vscode', placement: 'header' })
  })
})
