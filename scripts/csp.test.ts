import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SANDBOX_BOOTSTRAP_SCRIPT } from '../src/app/sandbox/frame'
import { hashSource, inlineScripts, pageViolations, parseCsp } from './csp'
import { headersOf, parseHeadersFile, siteHeaders } from './headers'

const root = path.resolve(__dirname, '..')
const policy = siteHeaders(path.join(root, 'public'))['Content-Security-Policy']
const csp = parseCsp(policy ?? '')
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8')

describe('the site CSP (public/_headers)', () => {
  it('is set for every page', () => {
    expect(policy).toBeTruthy()
  })

  it('allows exactly the inline scripts the site runs, by hash', () => {
    const expected = [
      ...inlineScripts(indexHtml).map(s => ({ hash: hashSource(s), what: `index.html: ${s.trim().split('\n')[0]}` })),
      { hash: hashSource(SANDBOX_BOOTSTRAP_SCRIPT), what: 'SANDBOX_BOOTSTRAP_SCRIPT (src/app/sandbox/frame.ts)' },
    ]
    const listed = (csp.get('script-src') ?? []).filter(s => s.startsWith("'sha256-"))
    const missing = expected.filter(e => !listed.includes(e.hash)).map(e => `add ${e.hash} for ${e.what}`)
    const stale = listed.filter(h => !expected.some(e => e.hash === h)).map(h => `remove ${h}`)
    expect([...missing, ...stale], "update script-src in public/_headers").toEqual([])
    expect(inlineScripts(indexHtml)).toHaveLength(2)
  })

  it('never allows inline script or script from anywhere but this site, Google Analytics and Cloudflare Web Analytics', () => {
    const scriptSrc = csp.get('script-src')!
    expect(scriptSrc).not.toContain("'unsafe-inline'")
    expect(scriptSrc).not.toContain('data:')
    expect(scriptSrc.filter(s => /^https?:|^\*/.test(s))).toEqual([
      'https://*.googletagmanager.com',
      'https://static.cloudflareinsights.com'
    ])
    expect(csp.get('default-src')).toEqual(["'self'"])
    expect(csp.get('object-src')).toEqual(["'none'"])
    expect(csp.get('base-uri')).toEqual(["'self'"])
    expect(csp.get('worker-src')).toEqual(["'self'", 'blob:'])
  })

  it('leaves the page frameable, for the #/embed widget', () => {
    expect(csp.has('frame-ancestors')).toBe(false)
    expect(Object.keys(siteHeaders(path.join(root, 'public')))).not.toContain('X-Frame-Options')
  })

  it('stays clear of advertising hosts', () => {
    expect(policy).not.toMatch(/googlesyndication|adservice|adsbygoogle/)
    expect(indexHtml).not.toMatch(/googlesyndication|adsbygoogle|google-adsense/)
  })
})

describe('pageViolations', () => {
  const allow = (script: string) => `script-src 'self' ${hashSource(script)}`

  it('passes a page whose inline scripts are all listed, ignoring data blocks and external scripts', () => {
    const html = '<script>run()</script><script type="application/json">{"a":"<b>"}</script>' +
      '<script type="application/ld+json">{}</script><script type="module" src="/x.js"></script>'
    expect(pageViolations(html, allow('run()'))).toEqual([])
  })

  it('reports an inline script whose hash is not listed, including module scripts', () => {
    expect(pageViolations('<script>a()</script>', allow('b()'))[0]).toMatch(/^inline script 'sha256-.*' is not in/)
    expect(pageViolations('<script type="module">a()</script>', allow('b()'))).toHaveLength(1)
  })

  it('hashes the script as a browser sees it, with CRLF turned into LF', () => {
    expect(pageViolations('<script>a()\r\nb()</script>', allow('a()\nb()'))).toEqual([])
  })

  it('reports inline event handlers and javascript: URLs, but not text inside script data blocks', () => {
    const problems = pageViolations(
      '<img src="x.png" onerror="go()"><a href="javascript:go()">x</a>' +
      '<script type="application/json">{"html":"<img onerror=x>"}</script>', "script-src 'self'")
    expect(problems).toHaveLength(2)
    expect(problems[0]).toMatch(/onerror=/)
    expect(problems[1]).toMatch(/javascript:/)
  })
})

describe('parseHeadersFile', () => {
  it('reads patterns, their indented headers and skips comments', () => {
    const rules = parseHeadersFile('# c\n/*\n  A: 1\n  B: x: y\n\n/guides/*\n  C: 2\n')
    expect(rules).toEqual([
      { pattern: '/*', headers: [['A', '1'], ['B', 'x: y']] },
      { pattern: '/guides/*', headers: [['C', '2']] },
    ])
    expect(headersOf(rules, '/*')).toEqual({ A: '1', B: 'x: y' })
  })

  it('rejects a header line outside any pattern', () => {
    expect(() => parseHeadersFile('  A: 1\n')).toThrow(/line 1/)
  })
})
