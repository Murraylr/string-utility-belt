import { describe, it, expect } from 'vitest'
import { renderChangelogHtml, renderChangelogReleases } from './changelogHtml'

const parse = (html: string) => {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

const SAMPLE = `# Changelog

Intro paragraph.

## [Unreleased]

### Added

- **Bold lead** — first item that wraps
  onto a continuation line.
- Second item with \`code\`.

- Loose third item after a blank line.

### Fixed

- A fix.

## [1.3.0] - 2025-09-27

- Baseline.

[Unreleased]: https://example.com/compare
[1.3.0]: #
`

describe('renderChangelogHtml', () => {
  it('renders bullet runs as real lists, one <li> per item (continuation lines included)', () => {
    const root = parse(renderChangelogHtml(SAMPLE))
    const lists = root.querySelectorAll('ul')
    // Added (3 items, the loose one merged in), Fixed (1), 1.3.0 (1)
    expect([...lists].map(ul => ul.querySelectorAll(':scope > li').length)).toEqual([3, 1, 1])
    const first = lists[0].querySelector('li')!
    expect(first.querySelector('strong')?.textContent).toBe('Bold lead')
    expect(first.textContent).toContain('onto a continuation line.')
    expect(first.textContent?.startsWith('- ')).toBe(false)
    expect(lists[0].querySelectorAll('li')[1].querySelector('code')?.textContent).toBe('code')
  })

  it('shows release headings without Keep-a-Changelog link brackets', () => {
    const root = parse(renderChangelogHtml(SAMPLE))
    expect([...root.querySelectorAll('h2')].map(h => h.textContent)).toEqual(['Unreleased', '1.3.0 - 2025-09-27'])
  })

  it('drops link-reference definition lines instead of printing them', () => {
    const html = renderChangelogHtml(SAMPLE)
    expect(html).not.toContain('example.com/compare')
    expect(parse(html).textContent).not.toMatch(/\[1\.3\.0\]:/)
  })

  it('keeps ordinary paragraphs as paragraphs', () => {
    const root = parse(renderChangelogHtml(SAMPLE))
    expect([...root.querySelectorAll('p')].map(p => p.textContent)).toContain('Intro paragraph.')
  })

  it('still escapes raw HTML and neutralizes script URLs, inside list items too', () => {
    const root = parse(renderChangelogHtml('- <img src=x onerror="alert(1)"> and [click](javascript:alert(1))\n- "><script>alert(1)</script>'))
    expect(root.querySelector('img')).toBeNull()
    expect(root.querySelector('script')).toBeNull()
    expect(root.querySelector('a')?.getAttribute('href')).toBe('#')
    expect(root.querySelectorAll('li')).toHaveLength(2)
    expect(root.textContent).toContain('<img src=x onerror="alert(1)">')
  })

  it('does not turn a hyphen inside a fenced code block into a list', () => {
    const root = parse(renderChangelogHtml('```\n- not a bullet\n```'))
    expect(root.querySelector('ul')).toBeNull()
    expect(root.querySelector('pre')?.textContent).toBe('- not a bullet')
  })

  it('lets a long inline code span (a file path) break instead of forcing the page wider', () => {
    const root = parse(renderChangelogHtml('- see `src/utilities/_generated/manifest.ts` for counts'))
    const li = root.querySelector('li')!
    const code = li.querySelector('code')!
    expect(code.className).toContain('md-code')
    expect(code.className).toContain('wrap-break-word')
    expect(code.textContent).toBe('src/utilities/_generated/manifest.ts')
    // the list is `grid` (for spacing between items): without `min-w-0` on the <li> grid
    // item, it blows out to the code span's unwrapped width instead of wrapping within it
    expect(li.className).toContain('min-w-0')
  })

  it('leaves a fenced code block alone (it already scrolls via its .md-pre ancestor)', () => {
    const root = parse(renderChangelogHtml('```\nconst x = 1\n```'))
    const code = root.querySelector('pre code')!
    expect(code.className).toBe('md-code-block')
    expect(code.className).not.toContain('wrap-break-word')
  })
})

describe('renderChangelogReleases', () => {
  it('splits the releases out, newest first, without the title, the intro or the link references', () => {
    const releases = renderChangelogReleases(SAMPLE)
    expect(releases.map(r => [r.version, r.date])).toEqual([['Unreleased', undefined], ['1.3.0', '2025-09-27']])
    const unreleased = parse(releases[0].html)
    expect([...unreleased.querySelectorAll('h3')].map(h => h.textContent)).toEqual(['Added', 'Fixed'])
    expect(unreleased.querySelectorAll('li')).toHaveLength(4)
    expect(releases.map(r => r.html).join('')).not.toMatch(/Intro paragraph|example\.com|<h[12]/)
    expect(parse(releases[1].html).textContent).toBe('Baseline.')
  })

  it('reads plain headings and ignores a release-like line inside a code fence', () => {
    const releases = renderChangelogReleases('## 2.0.0 - 2026-01-02\n\n```\n## [9.9.9]\n```\n\n## Older\n\n- x\n')
    expect(releases.map(r => [r.version, r.date])).toEqual([['2.0.0', '2026-01-02'], ['Older', undefined]])
    expect(parse(releases[0].html).querySelector('pre')?.textContent).toBe('## [9.9.9]')
  })
})
