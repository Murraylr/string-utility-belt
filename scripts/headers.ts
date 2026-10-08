/**
 * Reads `public/_headers` — the response headers Workers Static Assets adds to the
 * site's files (https://developers.cloudflare.com/workers/static-assets/headers/) —
 * so `vite preview` (and with it the E2E suite) serves the headers production does,
 * and the CSP checks read the policy that actually ships.
 *
 * The format: an unindented line is a URL pattern; the indented `Name: value` lines
 * under it are that pattern's headers; `#` lines are comments.
 */
import fs from 'node:fs'
import path from 'node:path'

export interface HeaderRule {
  pattern: string
  headers: Array<[name: string, value: string]>
}

export function parseHeadersFile(text: string): HeaderRule[] {
  const rules: HeaderRule[] = []
  const lines = text.split(/\r?\n/)
  lines.forEach((line, i) => {
    if (!line.trim() || line.trimStart().startsWith('#')) return
    if (!/^\s/.test(line)) {
      rules.push({ pattern: line.trim(), headers: [] })
      return
    }
    const rule = rules[rules.length - 1]
    const colon = line.indexOf(':')
    if (!rule || colon < 0) throw new Error(`_headers line ${i + 1}: expected "Name: value" under a URL pattern`)
    rule.headers.push([line.slice(0, colon).trim(), line.slice(colon + 1).trim()])
  })
  return rules
}

/** The headers of the rule for exactly `pattern` (e.g. `/*`), by name. */
export function headersOf(rules: HeaderRule[], pattern: string): Record<string, string> {
  const rule = rules.find(r => r.pattern === pattern)
  if (!rule) throw new Error(`_headers has no rule for ${pattern}`)
  return Object.fromEntries(rule.headers)
}

/** The `/*` headers — every page and file of the site — from `<dir>/_headers`. */
export function siteHeaders(dir: string): Record<string, string> {
  return headersOf(parseHeadersFile(fs.readFileSync(path.join(dir, '_headers'), 'utf8')), '/*')
}
