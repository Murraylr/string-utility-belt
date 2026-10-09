import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRESET_INDEX } from '../src/presets/_generated/index'
import { PRESETS_PATH, presetPath } from '../src/presets/types'
import { matchRedirect, parseRedirectsFile, redirectLocation, siteRedirects } from './redirects'

const rules = siteRedirects(path.resolve(__dirname, '..', 'public'))

describe('the site redirects (public/_redirects)', () => {
  it('sends every old recipe page to its preset page, permanently', () => {
    expect(PRESET_INDEX.length).toBeGreaterThan(0)
    for (const { slug } of PRESET_INDEX) {
      expect(matchRedirect(rules, `/recipes/${slug}/`), slug).toEqual({ location: presetPath(slug), status: 301 })
    }
  })

  it('sends the old recipe index to the preset index, with or without its slash', () => {
    for (const old of ['/recipes', '/recipes/']) {
      expect(matchRedirect(rules, old), old).toEqual({ location: PRESETS_PATH, status: 301 })
    }
  })

  it('leaves every other path alone', () => {
    for (const p of ['/', '/presets/', '/presets/decode-saml-request/', '/recipesx', '/util/recipes/', '/blog/recipes/']) {
      expect(matchRedirect(rules, p), p).toBeUndefined()
    }
  })
})

describe('parseRedirectsFile', () => {
  it('reads exact and splat rules, skips comments and blank lines, and defaults to 302 as production does', () => {
    expect(parseRedirectsFile('# moved\n\n/old /new\n/a/* /b/:splat 308\n')).toEqual([
      { from: '/old', to: '/new', status: 302 },
      { from: '/a/*', to: '/b/:splat', status: 308 },
    ])
  })

  it('prefers an exact rule to a splat rule, then the first in the file, and places the splat', () => {
    const parsed = parseRedirectsFile('/a/* /b/:splat 301\n/a/* /never/:splat 301\n/a/x /exact 302')
    expect(matchRedirect(parsed, '/a/x')).toEqual({ location: '/exact', status: 302 })
    expect(matchRedirect(parsed, '/a/y/z/')).toEqual({ location: '/b/y/z/', status: 301 })
    expect(matchRedirect(parsed, '/a/')).toEqual({ location: '/b/', status: 301 })
  })

  it('carries the query string over unless the destination has its own, as production does', () => {
    expect(redirectLocation('/presets/x/', '?utm_source=news')).toBe('/presets/x/?utm_source=news')
    expect(redirectLocation('/presets/x/', '')).toBe('/presets/x/')
    expect(redirectLocation('/presets/?from=old#top', '?utm_source=news')).toBe('/presets/?from=old#top')
  })

  it('rejects rules the preview could not apply the way production does', () => {
    for (const line of [
      '/a',                            // no destination
      '/a /b 301 Country=us',          // conditions
      '/a /b 200',                     // proxying
      '/a /b 404',                     // rewrites
      '/:slug /b/:slug 301',           // placeholders
      '/a/*/b /c 301',                 // a splat that is not the last segment
      '/a https://example.com/ 301',   // another site
      '/a //example.com/ 301',         // protocol-relative: another site
      '/a /b/:splat 301',              // a splat the source does not capture
      'a /b 301',                      // not a path
    ]) {
      expect(() => parseRedirectsFile(line), line).toThrow(/_redirects line 1/)
    }
  })
})
