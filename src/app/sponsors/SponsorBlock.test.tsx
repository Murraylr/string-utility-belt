import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { track } from '@/app/analytics/analytics'
import SponsorBlock from './SponsorBlock'
import PageSponsor from './PageSponsor'
import { utcDay, type Sponsorship } from './sponsors'
import { PROMOS } from './promos'
import { useExtensionStatus, type ExtensionStatus } from '@/app/extension/bridge'
import { canInstallExtension } from '@/app/extension/installable'
import { readPref } from '@/app/prefs'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'

vi.mock('@/app/analytics/analytics', () => ({ track: vi.fn() }))
vi.mock('@/app/extension/bridge', () => ({ useExtensionStatus: vi.fn() }))
vi.mock('@/app/extension/installable', () => ({ canInstallExtension: vi.fn() }))

/** As the browser answers: whether the extension is installed, and whether it could be. */
function browser(status: ExtensionStatus, installable: boolean) {
  vi.mocked(useExtensionStatus).mockReturnValue(status)
  vi.mocked(canInstallExtension).mockReturnValue(installable)
}
beforeEach(() => { vi.mocked(track).mockClear(); browser('absent', false) })

const today = utcDay(new Date())
const booking: Sponsorship = {
  id: 'acme-now', scope: 'site', name: 'Acme', text: 'Single sign-on in an afternoon.',
  url: 'https://acme.example/sso', logo: 'acme.svg', start: today, end: today,
}

describe('SponsorBlock', () => {
  it('is a labelled block: our copy of the logo, the name and text, a plain sponsored link', () => {
    render(<SponsorBlock sponsorship={booking} page={{ kind: 'utility', id: 'trim' }} />)
    const block = screen.getByRole('complementary', { name: 'Sponsor' })
    const link = screen.getByRole('link', { name: 'Acme — Single sign-on in an afternoon. (opens in a new tab)' })
    expect(block.contains(link)).toBe(true)
    expect(link.getAttribute('rel')).toBe('sponsored noopener')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('href')).toBe(
      'https://acme.example/sso?utm_source=stringutilitybelt&utm_medium=sponsorship&utm_campaign=acme-now&utm_content=util%2Ftrim')
    const logo = block.querySelector('img')!
    expect(logo.getAttribute('src')).toBe('/sponsors/acme.svg')
    expect([logo.getAttribute('width'), logo.getAttribute('height'), logo.getAttribute('alt')]).toEqual(['48', '48', ''])
    expect(block.textContent).toContain('SponsorAdvertise here')
    expect(screen.getByRole('link', { name: 'Advertise here' }).getAttribute('href')).toBe('/advertise/')
  })

  it('renders on the server with no script or inline handler', () => {
    const markup = renderToStaticMarkup(<SponsorBlock sponsorship={booking} page={{ kind: 'blog', slug: 'x' }} onFollow={() => {}} />)
    expect(markup).not.toMatch(/<script|\son[a-z]+=/i)
    expect(markup).toContain('data-sponsorship="acme-now"')
  })
})

describe('PageSponsor', () => {
  it('fills an unbooked page with our own extension, labelled as ours and hidden on phones', () => {
    const past = { ...booking, start: '2020-01-01', end: '2020-01-31' }
    render(<PageSponsor page={{ kind: 'utility', id: 'trim' }} sponsorships={[past]} className="mt-3" />)
    expect(screen.queryByRole('complementary', { name: 'Sponsor' })).toBeNull()
    const block = screen.getByRole('complementary', { name: 'From String Utility Belt' })
    expect(block.className).toBe('sponsor hidden sm:grid mt-3')
    expect(block.getAttribute('data-promo')).toBe('vscode')
    const link = screen.getByRole('link', { name: `${PROMOS.vscode.name} — ${PROMOS.vscode.text} (opens in a new tab)` })
    expect(link.getAttribute('href')).toBe(PROMOS.vscode.link.href)
    expect(link.getAttribute('rel')).toBe('noopener')
    expect(block.textContent).toContain('From String Utility BeltAdvertise here')
  })

  it("shows today's sponsor and reports a click by ids only", () => {
    render(<PageSponsor page={{ kind: 'recipe', slug: 'decode-saml-request' }} sponsorships={[booking]} className="mt-3" />)
    expect(screen.getByRole('complementary', { name: 'Sponsor' }).className).toBe('sponsor mt-3')
    fireEvent.click(screen.getByRole('link', { name: /Acme/ }))
    expect(track).toHaveBeenCalledWith('sponsor_click', { sponsorship_id: 'acme-now', sponsor_page: 'recipes/decode-saml-request' })
  })
})

describe('HousePromo', () => {
  const trim = { kind: 'utility', id: 'trim' } as const
  const promoOn = (page: Parameters<typeof PageSponsor>[0]['page']) => {
    const { container, unmount } = render(<PageSponsor page={page} sponsorships={[]} />)
    const id = container.querySelector('[data-promo]')?.getAttribute('data-promo') ?? null
    unmount()
    return id
  }

  it('offers the browser extension only where it can be installed and is not', () => {
    browser('absent', true)
    expect(promoOn(trim)).toBe('chrome')
    expect(promoOn({ kind: 'blog', slug: 'md5-insecure-but-useful' })).toBe('chrome')
    browser({ id: 'x', version: '1.4.1', stepTypes: ['utility'] }, true)
    expect(promoOn(trim)).toBe('vscode')
    browser('absent', false)
    expect(promoOn(trim)).toBe('vscode')
  })

  it('leaves the browser extension to recipe pages themselves, and offers VS Code on data-format pages', () => {
    browser('absent', true)
    expect(promoOn({ kind: 'recipe', slug: 'decode-saml-request' })).toBe('vscode')
    expect(promoOn({ kind: 'utility', id: 'json_pretty' })).toBe('vscode')
  })

  it('shows nothing while the browser extension is still answering, so it never flips', () => {
    browser('checking', true)
    const { container } = render(<PageSponsor page={trim} sponsorships={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows a promo that does not depend on the browser at once, as the pre-render does', () => {
    browser('checking', true)
    expect(promoOn({ kind: 'recipe', slug: 'decode-saml-request' })).toBe('vscode')
    expect(promoOn({ kind: 'utility', id: 'csv_to_json' })).toBe('vscode')
  })

  it('reports a click as an integration click from the promo, and marks the integrations seen', () => {
    browser('absent', true)
    render(<PageSponsor page={trim} sponsorships={[]} />)
    fireEvent.click(screen.getByRole('link', { name: /String Utility Belt for Chrome/ }))
    expect(track).toHaveBeenCalledWith('integration_click', { integration: 'chrome', source: 'promo', sponsor_page: 'util/trim' })
    expect(readPref(INTEGRATIONS_SEEN_PREF, false)).toBe(true)
  })

  it('offers each topic the tool its readers reach for, whatever the browser', () => {
    browser('checking', true)
    expect(promoOn({ kind: 'utility', id: 'cron_describe' })).toBe('cli')
    expect(promoOn({ kind: 'recipe', slug: 'decode-kubernetes-secret' })).toBe('cli')
    expect(promoOn({ kind: 'utility', id: 'sha3' })).toBe('mcp')
    expect(promoOn({ kind: 'utility', id: 'json_pretty' })).toBe('vscode')
    expect(promoOn({ kind: 'recipe', slug: 'decode-saml-request' })).toBe('vscode')
  })

  it('opens the CLI and MCP sections of /integrations/ in place, not in a new tab', () => {
    render(<PageSponsor page={{ kind: 'utility', id: 'sha3' }} sponsorships={[]} />)
    const link = screen.getByRole('link', { name: `${PROMOS.mcp.name} — ${PROMOS.mcp.text}` })
    expect(link.getAttribute('href')).toBe('/integrations/#mcp-server-for-ai-agents')
    expect(link.hasAttribute('target')).toBe(false)
    expect(link.hasAttribute('rel')).toBe(false)
    fireEvent.click(link)
    expect(track).toHaveBeenCalledWith('integration_click', { integration: 'mcp', source: 'promo', sponsor_page: 'util/sha3' })
  })

  it('gives way to a paid sponsor', () => {
    browser('absent', true)
    render(<PageSponsor page={trim} sponsorships={[booking]} />)
    expect(screen.getByRole('complementary', { name: 'Sponsor' })).toBeTruthy()
    expect(screen.queryByRole('complementary', { name: 'From String Utility Belt' })).toBeNull()
  })
})
