import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { track } from '@/app/analytics/analytics'
import ExtraPromo from './ExtraPromo'
import PagePromo from './PagePromo'
import { PROMOS, promoPlan, type ExtraSlot, type PromoPage } from './promos'

vi.mock('@/app/analytics/analytics', () => ({ track: vi.fn() }))
beforeEach(() => vi.mocked(track).mockClear())

const SLOTS: ExtraSlot[] = ['inline', 'rail', 'strip']

describe('promoPlan', () => {
  const pages: PromoPage[] = [
    { kind: 'index' },
    { kind: 'utility', id: 'trim' },
    { kind: 'utility', id: 'cron_describe' },
    { kind: 'utility', id: 'hash' },
    { kind: 'recipe', slug: 'decode-kubernetes-secret' },
    { kind: 'recipe', slug: 'decode-saml-request' },
    { kind: 'blog', slug: 'anything' },
  ]

  it.each(pages.filter(p => p.kind !== 'index'))('leaves every extra slot of %o empty: its sponsor slot is its one promo', page => {
    expect(promoPlan(page)).toEqual({})
  })

  it('gives an index page one tool, in whichever content slot its layout carries, and never the strip', () => {
    expect(promoPlan({ kind: 'index' })).toEqual({ inline: 'mcp', rail: 'mcp' })
  })

  it('only uses tools that do not depend on the browser, so the pre-render matches', () => {
    for (const page of pages) expect(Object.values(promoPlan(page))).not.toContain('chrome')
  })

  it('links an index page only within this site', () => {
    for (const id of Object.values(promoPlan({ kind: 'index' }))) expect(PROMOS[id].link.external).toBe(false)
  })
})

describe('ExtraPromo', () => {
  it.each(SLOTS)('%s: labelled as ours, never "Sponsor", hidden on phones', slot => {
    render(<ExtraPromo id="vscode" slot={slot} />)
    const block = screen.getByRole('complementary', { name: 'From String Utility Belt' })
    expect(block.className).toMatch(/(^|\s)hidden sm:/)
    expect(block.getAttribute('data-promo-slot')).toBe(slot)
    expect(screen.queryByText('Sponsor')).toBeNull()
    const cta = screen.getByRole('link', { name: new RegExp(PROMOS.vscode.cta) })
    expect(cta.getAttribute('href')).toBe(PROMOS.vscode.link.href)
    expect(cta.getAttribute('target')).toBe('_blank')
  })

  it('opens a section of /integrations/ in place', () => {
    render(<ExtraPromo id="cli" slot="inline" />)
    const cta = screen.getByRole('link', { name: PROMOS.cli.cta })
    expect(cta.getAttribute('target')).toBeNull()
  })

  it('renders on the server with no script or inline handler', () => {
    const markup = renderToStaticMarkup(<ExtraPromo id="mcp" slot="rail" onFollow={() => {}} />)
    expect(markup).not.toMatch(/<script|\son[a-z]+=/i)
  })
})

describe('PagePromo', () => {
  it('reports a click with its slot as the source', () => {
    render(<PagePromo page={{ kind: 'index' }} slot="rail" />)
    fireEvent.click(screen.getByRole('link', { name: PROMOS.mcp.cta }))
    expect(track).toHaveBeenCalledWith('integration_click', { integration: 'mcp', source: 'promo_rail' })
  })

  it.each([
    [{ kind: 'utility', id: 'trim' } as const, 'rail' as const],
    [{ kind: 'utility', id: 'trim' } as const, 'inline' as const],
    [{ kind: 'index' } as const, 'strip' as const],
  ])('renders nothing for a slot the plan leaves empty (%o, %s)', (page, slot) => {
    const { container } = render(<PagePromo page={page} slot={slot} />)
    expect(container.innerHTML).toBe('')
  })
})
