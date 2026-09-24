import { describe, it, expect } from 'vitest'
import { parseChangelog, summarizeMarkdown } from './changelog'

const SAMPLE = `# Changelog

Preamble text, ignored.

## [Unreleased]

### Added
- **210 new utilities**
- Pipeline & engine features

## [1.3.0] - 2025-09-18

### Added
- Initial release: 36 utilities
`

describe('parseChangelog', () => {
  it('splits into releases in document order, capturing version and optional date', () => {
    const releases = parseChangelog(SAMPLE)
    expect(releases).toHaveLength(2)
    expect(releases[0]).toMatchObject({ version: 'Unreleased', date: undefined })
    expect(releases[1]).toMatchObject({ version: '1.3.0', date: '2025-09-18' })
  })

  it('captures each release body up to the next heading', () => {
    const releases = parseChangelog(SAMPLE)
    expect(releases[0].bodyMd).toContain('210 new utilities')
    expect(releases[0].bodyMd).not.toContain('Initial release')
    expect(releases[1].bodyMd).toContain('Initial release: 36 utilities')
  })

  it('ignores preamble text before the first release heading', () => {
    expect(parseChangelog(SAMPLE)).toHaveLength(2)
  })

  it('returns an empty list for a document with no release headings', () => {
    expect(parseChangelog('# Changelog\n\njust prose')).toEqual([])
  })
})

describe('summarizeMarkdown', () => {
  it('strips heading and bullet markers and collapses whitespace', () => {
    expect(summarizeMarkdown('### Added\n- one\n-  two  \n')).toBe('Added one two')
  })

  it('truncates long text with an ellipsis', () => {
    const long = 'x'.repeat(500)
    const out = summarizeMarkdown(long, 50)
    expect(out.length).toBe(50)
    expect(out.endsWith('…')).toBe(true)
  })
})
