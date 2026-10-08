import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import BlogIndex from './BlogIndex'

describe('<BlogIndex />', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders Blog heading', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<BlogIndex />)
    expect(screen.getByRole('heading', { level: 1, name: 'Blog' })).toBeInTheDocument()
    await screen.findByText('No posts yet.')
  })

  it('shows the translated empty state when there are no posts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }))
    render(<BlogIndex />)
    await waitFor(() => expect(screen.getByText('No posts yet.')).toBeInTheDocument())
  })

  it('lists fetched posts as hairline rows with their tags (no hardcoded bg-white)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ slug: 'a', title: 'Post A', date: '2025-01-01', description: 'desc', tags: ['base64', 7, 'cli'] }]),
    }))
    render(<BlogIndex />)
    const link = await screen.findByText('Post A')
    // the pre-rendered post's crawlable path, not a #/ route
    expect(link).toHaveAttribute('href', '/blog/a/')
    const row = link.closest('li')
    expect(row.className).toContain('border-t')
    expect(row.className).not.toMatch(/bg-white|text-gray/)
    expect(screen.getByText('desc')).toBeInTheDocument()
    // string tags only
    expect([...row.querySelectorAll('.chip')].map(c => c.textContent)).toEqual(['base64', 'cli'])
  })

  it('shows one of our own tools after the newest post, never a sponsor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([{ slug: 'a', title: 'Post A' }, { slug: 'b', title: 'Post B' }]),
    }))
    const { container } = render(<BlogIndex />)
    await screen.findByText('Post B')
    const rows = [...container.querySelectorAll('ul > li')]
    expect(rows[0].textContent).toContain('Post A')
    expect(rows[1].querySelector('[data-promo-slot="inline"]')).toHaveAccessibleName('From String Utility Belt')
    expect(rows[2].textContent).toContain('Post B')
  })

  it('falls back to an empty list when the fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<BlogIndex />)
    await waitFor(() => expect(screen.getByText('No posts yet.')).toBeInTheDocument())
  })
})

describe('<BlogIndex /> (review regressions)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('does not flash the empty state while the manifest is loading', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<BlogIndex />)
    expect(screen.queryByText('No posts yet.')).toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
  })

  it('survives a manifest that is not an array', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ posts: 'nope' }) }))
    render(<BlogIndex />)
    await screen.findByText('No posts yet.')
  })

  it('drops malformed manifest entries and formats dates for the locale', async () => {
    const tz = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([null, { title: 'no slug' }, { slug: 'a', title: 'Post A', date: '2025-01-15' }]),
      }))
      render(<BlogIndex />)
      await screen.findByText('Post A')
      expect(screen.getAllByRole('link').filter(a => a.getAttribute('href')?.startsWith('/blog/'))).toHaveLength(1)
      expect(screen.getByText('January 15, 2025').tagName).toBe('TIME')
    } finally {
      process.env.TZ = tz
    }
  })
})
