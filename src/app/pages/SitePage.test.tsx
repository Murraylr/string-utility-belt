import React from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import SitePage from './SitePage'
import { parseSitePage } from './sitePages'

describe('SitePage', () => {
  it('renders the privacy policy with its own h1, sections and lists, and sets the head', () => {
    document.title = 'String Utility Belt'
    const { unmount } = render(<SitePage slug="privacy" />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Privacy Policy')
    expect(screen.getByRole('heading', { level: 2, name: 'Cookies, analytics and advertising' })).toBeTruthy()
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(5)
    expect(screen.getByRole('link', { name: "Google's Ads Settings" }).getAttribute('href')).toBe('https://adssettings.google.com/')
    expect(document.title).toBe('Privacy Policy — String Utility Belt')
    unmount()
    expect(document.title).toBe('String Utility Belt')
  })

  it('links the site pages to each other by crawlable paths', () => {
    render(<SitePage slug="about" />)
    const hrefs = screen.getAllByRole('link').map(a => a.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining(['/privacy/', '/utilities/', '/contact/']))
  })
})

describe('parseSitePage', () => {
  it('reads the SEO title and description from frontmatter and keeps the document headings', () => {
    const page = parseSitePage('---\ntitle: About Us\ndescription: Who we are.\n---\n# About\n\n## Why\n\n- one\n- two\n')
    expect(page).toMatchObject({ title: 'About Us', description: 'Who we are.' })
    expect(page.html).toContain('<h1 class="md-h1">About</h1>')
    expect(page.html).toContain('<h2 class="md-h2">Why</h2>')
    expect(page.html).toContain('<ul class="md-ul"><li class="md-li">one</li><li class="md-li">two</li></ul>')
  })
})
