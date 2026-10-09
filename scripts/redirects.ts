/**
 * Reads `public/_redirects` — the redirects Workers Static Assets answers before serving a
 * file (https://developers.cloudflare.com/workers/static-assets/redirects/) — so `vite preview`
 * (and with it the E2E suite) redirects the paths production does.
 *
 * The format: `source destination [status]` per line; `#` lines are comments. Only the subset
 * the site uses is understood — an exact source path, or one ending in a single `/*` splat that
 * a local destination may place as `:splat`, with a 301/302/303/307/308 status (302 when left
 * out, as in production). Anything else throws, so the file cannot grow a rule the preview
 * would silently skip.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

export interface RedirectRule {
  from: string
  to: string
  status: number
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

export function parseRedirectsFile(text: string): RedirectRule[] {
  const rules: RedirectRule[] = []
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const fail = (why: string): never => { throw new Error(`_redirects line ${i + 1}: ${why}`) }
    const fields = line.split(/\s+/)
    if (fields.length < 2 || fields.length > 3) fail('expected "source destination [status]"')
    const [from, to, code = '302'] = fields
    const status = Number(code)
    if (!REDIRECT_STATUSES.has(status)) fail(`${code} is not a redirect status`)
    const splat = from.endsWith('/*')
    const fixed = splat ? from.slice(0, -1) : from
    if (!fixed.startsWith('/') || /[*:]/.test(fixed)) fail(`unsupported source ${from}: use an exact path or one ending in /*`)
    if (!to.startsWith('/') || to.startsWith('//')) fail(`unsupported destination ${to}: use a path on this site`)
    if (/:(?!splat\b)[A-Za-z]/.test(to) || (to.includes(':splat') && !splat)) fail(`${to} names a placeholder ${from} does not capture`)
    rules.push({ from, to, status })
  })
  return rules
}

const isSplat = (rule: RedirectRule) => rule.from.endsWith('/*')

/**
 * Where `rules` send `pathname`, or undefined when none matches. As in production, an exact
 * rule wins over a splat rule, and the first one in the file wins among each.
 */
export function matchRedirect(rules: readonly RedirectRule[], pathname: string): { location: string; status: number } | undefined {
  const exact = rules.find(rule => !isSplat(rule) && rule.from === pathname)
  if (exact) return { location: exact.to, status: exact.status }
  for (const rule of rules.filter(isSplat)) {
    const prefix = rule.from.slice(0, -1)
    if (pathname.startsWith(prefix)) return { location: rule.to.replace(':splat', pathname.slice(prefix.length)), status: rule.status }
  }
  return undefined
}

/** The `Location` production sends: the request's query string carries over unless the destination has its own. */
export function redirectLocation(destination: string, search: string): string {
  const target = new URL(destination, 'http://site.invalid')
  return `${target.pathname}${target.search || search}${target.hash}`
}

/** The rules in `<dir>/_redirects`. */
export function siteRedirects(dir: string): RedirectRule[] {
  return parseRedirectsFile(fs.readFileSync(path.join(dir, '_redirects'), 'utf8'))
}

/** Vite plugin: `vite preview` answers the `_redirects` rules in `dir` before serving a file. */
export function previewRedirects(dir: string): Plugin {
  const rules = siteRedirects(dir)
  return {
    name: 'preview-redirects',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://site.invalid')
        const hit = matchRedirect(rules, url.pathname)
        if (!hit) return next()
        res.statusCode = hit.status
        res.setHeader('Location', redirectLocation(hit.location, url.search))
        res.end()
      })
    },
  }
}
