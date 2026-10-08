import { describe, expect, it } from 'vitest'
import {
  TITLE_BUDGET, displayName, homeDescription, pageTitle, utilitiesDescription, utilitiesTitle, HOME_TITLE,
  DOCS_TITLE, DOCS_DESCRIPTION,
} from './seo'

describe('pageTitle', () => {
  it('adds the site name when the whole title still fits a search result', () => {
    expect(pageTitle('Blog')).toBe('Blog | String Utility Belt')
    expect(pageTitle('Trim Whitespace Online: Strip Spaces')).toBe('Trim Whitespace Online: Strip Spaces | String Utility Belt')
  })

  it('keeps a long title whole rather than letting the site name push its words out of view', () => {
    const title = 'Base64 Encode Online — Convert Text to Base64'
    expect(pageTitle(title)).toBe(title)
  })

  it('does not repeat the site name', () => {
    expect(pageTitle('About String Utility Belt')).toBe('About String Utility Belt')
  })
})

describe('site copy', () => {
  it('keeps titles within a search result and descriptions within a snippet', () => {
    expect(HOME_TITLE.length).toBeLessThanOrEqual(TITLE_BUDGET)
    expect(utilitiesTitle(246).length).toBeLessThanOrEqual(TITLE_BUDGET)
    expect(DOCS_TITLE.length).toBeLessThanOrEqual(TITLE_BUDGET)
    for (const d of [homeDescription(246), utilitiesDescription(246), DOCS_DESCRIPTION]) {
      expect(d.length).toBeGreaterThanOrEqual(80)
      expect(d.length).toBeLessThanOrEqual(160)
    }
  })

  it('spaces out legacy ids-as-names', () => {
    expect(displayName('base64_encode')).toBe('base64 encode')
    expect(displayName('url decode')).toBe('url decode')
  })
})
