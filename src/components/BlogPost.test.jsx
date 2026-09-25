import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import BlogPost from './BlogPost'

const POST = `---\ntitle: Hello World\ndate: 2025-01-15\n---\n# Heading\n\nSome **bold** text.`

describe('<BlogPost />', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows not-found when the fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    render(<BlogPost slug="base64-encode-decode-online" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Post not found.')
  })

  it('renders the frontmatter title, a locale-formatted date, and the markdown body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(POST) }))
    render(<BlogPost slug="hello" />)
    await screen.findByText('Hello World')
    // a date-only value is a calendar day: no time-zone shift to the 14th
    expect(screen.getByText('January 15, 2025')).toBeInTheDocument()
    expect(screen.getByText('Heading').tagName).toBe('H1')
    expect(document.querySelector('.md-p strong')?.textContent).toBe('bold')
  })

  it('shows the translated not-found message on a failed fetch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    render(<BlogPost slug="missing" />)
    await waitFor(() => expect(screen.getByText('Post not found.')).toBeInTheDocument())
  })

  it('uses token classes on the article container, not bg-white', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(POST) }))
    const { container } = render(<BlogPost slug="hello" />)
    await screen.findByText('Hello World')
    const article = container.querySelector('article')
    expect(article.className).toContain('card')
    expect(article.className).not.toMatch(/bg-white/)
  })
})

describe('<BlogPost /> (review regressions)', () => {
  afterEach(() => vi.unstubAllGlobals())
  const res = (text, type = 'text/markdown') => ({ ok: true, headers: { get: () => type }, text: () => Promise.resolve(text) })

  it('parses CRLF frontmatter and strips quotes from the title', async () => {
    const crlf = ['---', 'title: "Quoted: Title"', 'date: 2025-09-18', '---', '', '# H', '', 'para'].join('\r\n')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(crlf)))
    const { container } = render(<BlogPost slug="q" />)
    await screen.findByText('Quoted: Title')
    expect(container.textContent).not.toContain('---')
    expect(container.querySelector('.md-p')?.textContent).toBe('para')
  })

  it('shows the frontmatter date as that calendar day regardless of time zone', async () => {
    const tz = process.env.TZ
    process.env.TZ = 'America/Los_Angeles'
    try {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(POST)))
      render(<BlogPost slug="hello" />)
      const time = await screen.findByText('January 15, 2025')
      expect(time.closest('time')?.getAttribute('datetime')).toBe('2025-01-15')
    } finally {
      process.env.TZ = tz
    }
  })

  it('treats an HTML response (SPA fallback for a missing .md) as not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res('<!doctype html><html></html>', 'text/html; charset=utf-8')))
    render(<BlogPost slug="missing" />)
    await screen.findByText('Post not found.')
  })

  it('recovers from a not-found post when navigating to another slug', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(res(POST))
    vi.stubGlobal('fetch', fetchMock)
    const { rerender } = render(<BlogPost slug="missing" />)
    await screen.findByText('Post not found.')
    rerender(<BlogPost slug="hello" />)
    await screen.findByText('Hello World')
    expect(screen.queryByText('Post not found.')).toBeNull()
  })

  it('announces loading instead of rendering an empty card', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
    render(<BlogPost slug="slow" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(document.querySelector('article')?.getAttribute('aria-busy')).toBe('true')
  })
})

describe('<BlogPost /> (responsive regressions)', () => {
  afterEach(() => vi.unstubAllGlobals())
  const res = (text, type = 'text/markdown') => ({ ok: true, headers: { get: () => type }, text: () => Promise.resolve(text) })

  it('lets a long inline code span (a file path) break instead of forcing the page wider', async () => {
    const text = '---\ntitle: Paths\n---\n\n# Paths\n\nsee `src/utilities/_generated/manifest.ts` for counts'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res(text)))
    render(<BlogPost slug="paths" />)
    await screen.findByText('Paths')
    const code = document.querySelector('.md-code')
    expect(code?.textContent).toBe('src/utilities/_generated/manifest.ts')
    expect(code.className).toContain('break-words')
  })
})

describe('<BlogPost /> title', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('renders a single h1 when the body repeats the frontmatter title', async () => {
    const text = '---\ntitle: Same\n---\n\n# Same\n\nBody text.'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(text) }))
    render(<BlogPost slug="same" />)
    await screen.findByText('Body text.')
    expect(screen.getAllByRole('heading', { level: 1 }).map(h => h.textContent)).toEqual(['Same'])
  })
})

describe('<BlogPost /> revisions and markup', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows the update date of a revised post, and keeps lists and h2 sections as written', async () => {
    const text = '---\ntitle: Revised\ndate: 2025-09-18\nupdated: 2026-09-25\n---\n\n## Part\n\n- one\n- two\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: () => Promise.resolve(text) }))
    render(<BlogPost slug="revised" />)
    await screen.findByText('Revised')
    expect(screen.getByText('September 25, 2026').closest('time')?.getAttribute('datetime')).toBe('2026-09-25')
    expect(screen.getByRole('heading', { level: 2, name: 'Part' })).toBeTruthy()
    expect(screen.getAllByRole('listitem').map(li => li.textContent)).toEqual(['one', 'two'])
    expect(document.title).toBe('Revised — String Utility Belt')
  })
})
