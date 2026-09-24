import { asText } from './types'

export type Pair = [string, string]

const HEX2 = /^[0-9a-fA-F]{2}/
const UNICODE = /^(?:\{[0-9a-fA-F]{1,6}\}|[0-9a-fA-F]{4})/
const SIMPLE: Record<string, string> = { n: '\n', t: '\t', r: '\r', f: '\f', v: '\v', 0: '\u0000', '\\': '\\', '#': '#' }

/**
 * Resolves the backslash escapes of the legacy rule grammar (`\n \t \r \f \v \0 \\ \#`,
 * `\xHH`, `\uHHHH`, `\u{H…}`), exactly as `multi_replace` did; anything else is kept verbatim.
 */
function unescapeLegacy(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '\\' || i + 1 >= s.length) { out += c; continue }
    const n = s[i + 1]
    if (n in SIMPLE) { out += SIMPLE[n]; i++; continue }
    if (n === 'x') {
      const m = HEX2.exec(s.slice(i + 2))
      if (m) { out += String.fromCharCode(parseInt(m[0], 16)); i += 1 + m[0].length; continue }
    }
    if (n === 'u') {
      const m = UNICODE.exec(s.slice(i + 2))
      if (m) {
        const cp = parseInt(m[0].replace(/[{}]/g, ''), 16)
        if (cp <= 0x10ffff) { out += String.fromCodePoint(cp); i += 1 + m[0].length; continue }
      }
    }
    out += c
  }
  return out
}

export interface LegacyOptions {
  /** Keys are regex sources (the utility's `regex` flag): their escapes belong to the regex engine. */
  regexKeys?: boolean
}

/**
 * Parses the legacy free-text rule list (`multi_replace` before it took pairs) the way
 * that utility read it: blank and `#` lines are skipped, each line splits on whichever
 * of `=>` (trimmed) or TAB (kept verbatim) comes first, and backslash escapes are
 * resolved — in values always, in keys unless they are regexes. Pairs are used verbatim,
 * so resolving here is what keeps a converted pipeline's output unchanged.
 */
export function parseLegacyKeyValue(text: string, { regexKeys = false }: LegacyOptions = {}): Pair[] {
  const pairs: Pair[] = []
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\r$/, '')
    const probe = line.trim()
    if (!probe || probe.startsWith('#')) continue
    const arrow = line.indexOf('=>')
    const tab = line.indexOf('\t')
    let key: string
    let val: string
    if (arrow !== -1 && (tab === -1 || arrow < tab)) {
      key = line.slice(0, arrow).trim()
      val = line.slice(arrow + 2).trim()
    } else if (tab !== -1) {
      key = line.slice(0, tab)
      val = line.slice(tab + 1)
    } else {
      key = probe
      val = ''
    }
    pairs.push([regexKeys ? key : unescapeLegacy(key), unescapeLegacy(val)])
  }
  return pairs
}

/** Coerces a stored value (arbitrary JSON from a share link or old storage) into string pairs. */
export function toPairs(value: unknown): Pair[] {
  if (!Array.isArray(value)) return []
  const pairs: Pair[] = []
  for (const p of value) {
    if (Array.isArray(p)) pairs.push([asText(p[0]), asText(p[1])])
  }
  return pairs
}
