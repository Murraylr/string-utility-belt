import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ChangelogPage from './ChangelogPage'

describe('<ChangelogPage />', () => {
  it('renders the changelog heading from CHANGELOG.md', () => {
    render(<ChangelogPage />)
    expect(screen.getByRole('heading', { level: 1, name: 'Changelog' })).toBeInTheDocument()
  })

  it('renders each release as a heading without link brackets', () => {
    render(<ChangelogPage />)
    const h2s = screen.getAllByRole('heading', { level: 2 }).map(h => h.textContent)
    expect(h2s).toContain('Unreleased')
    expect(h2s.some(t => t?.startsWith('1.3.0'))).toBe(true)
    expect(h2s.some(t => t?.includes('['))).toBe(false)
  })

  it('renders the release notes as real bullet lists, not dash-prefixed paragraphs', () => {
    const { container } = render(<ChangelogPage />)
    const items = screen.getAllByRole('listitem')
    expect(items.length).toBeGreaterThanOrEqual(5)
    expect(items.some(li => li.textContent?.includes('new utilities'))).toBe(true)
    expect(items.every(li => !li.textContent?.startsWith('- '))).toBe(true)
    // no Keep-a-Changelog link-reference footer printed as text
    expect(container.textContent).not.toMatch(/\[[^\]]+\]:\s/)
  })

  it('sets the document title, and restores it on leaving', () => {
    document.title = 'String Utility Belt'
    const { unmount } = render(<ChangelogPage />)
    expect(document.title).toBe('Changelog — String Utility Belt')
    unmount()
    // otherwise the tool page (which sets no title) keeps "Changelog — …"
    expect(document.title).toBe('String Utility Belt')
  })

  it('uses token classes on the article container, not bg-white', () => {
    const { container } = render(<ChangelogPage />)
    const article = container.querySelector('article')
    expect(article?.className).toContain('card')
    expect(article?.className).not.toMatch(/bg-white|text-gray/)
  })

  it("drops the leading heading's top margin so no blank band sits above the title", () => {
    const { container } = render(<ChangelogPage />)
    const article = container.querySelector('article') as HTMLElement
    expect(article.className).toContain('[&>div>:first-child]:mt-0')
    // the rule targets the rendered markdown's first block: the h1
    expect(article.firstElementChild?.firstElementChild?.tagName).toBe('H1')
  })
})
