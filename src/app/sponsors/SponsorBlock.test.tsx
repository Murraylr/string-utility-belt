import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { track } from '@/app/analytics/analytics'
import SponsorBlock from './SponsorBlock'
import PageSponsor from './PageSponsor'
import { utcDay, type Sponsorship } from './sponsors'

vi.mock('@/app/analytics/analytics', () => ({ track: vi.fn() }))

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
    expect(block.textContent).toContain('Sponsor · Advertise')
    expect(screen.getByRole('link', { name: 'Advertise' }).getAttribute('href')).toBe('/advertise/')
  })

  it('renders on the server with no script or inline handler', () => {
    const markup = renderToStaticMarkup(<SponsorBlock sponsorship={booking} page={{ kind: 'blog', slug: 'x' }} onFollow={() => {}} />)
    expect(markup).not.toMatch(/<script|\son[a-z]+=/i)
    expect(markup).toContain('data-sponsorship="acme-now"')
  })
})

describe('PageSponsor', () => {
  it('renders nothing when the page has no sponsor today', () => {
    const { container } = render(<PageSponsor page={{ kind: 'utility', id: 'trim' }} sponsorships={[]} />)
    expect(container.innerHTML).toBe('')
    const past = { ...booking, start: '2020-01-01', end: '2020-01-31' }
    expect(render(<PageSponsor page={{ kind: 'utility', id: 'trim' }} sponsorships={[past]} />).container.innerHTML).toBe('')
  })

  it("shows today's sponsor and reports a click by ids only", () => {
    render(<PageSponsor page={{ kind: 'recipe', slug: 'decode-saml-request' }} sponsorships={[booking]} className="mt-3" />)
    expect(screen.getByRole('complementary', { name: 'Sponsor' }).className).toBe('sponsor mt-3')
    fireEvent.click(screen.getByRole('link', { name: /Acme/ }))
    expect(track).toHaveBeenCalledWith('sponsor_click', { sponsorship_id: 'acme-now', sponsor_page: 'recipes/decode-saml-request' })
  })
})
