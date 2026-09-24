import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/**
 * Scores the input against every format this app can plausibly be handed and returns
 * the candidates, best first. It is a triage tool: it never throws, and a low score is
 * information too. Each detector is isolated so one bad guess cannot take down the rest.
 */

type Detection = { format: string; confidence: number; note: string }

type Ctx = {
  raw: string
  text: string
  sample: string
  lines: string[]
  content: string[]
  compact: string
  bytes: Uint8Array | null
  json: { ok: boolean; value: unknown }
}

const MAX_LINES = 500
const MAX_SAMPLE = 20000

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const round2 = (n: number) => Math.round(n * 100) / 100
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** Truncates by code point, never by UTF-16 unit, so an astral character cannot be cut in half. */
function preview(s: string, max = 40): string {
  const flat = s.replace(/\r/g, '').replace(/\n/g, '\\n')
  const points = Array.from(flat)
  return points.length > max ? `${points.slice(0, max).join('')}…` : flat
}

/** True when every character is printable text (tabs and newlines allowed). */
function isTextual(s: string): boolean {
  const limit = Math.min(s.length, 512)
  for (let i = 0; i < limit; i++) {
    const c = s.charCodeAt(i)
    if (c === 9 || c === 10 || c === 13) continue
    if (c < 32 || c === 127) return false
  }
  return true
}

function looksBinary(s: string): boolean {
  const limit = Math.min(s.length, 64)
  for (let i = 0; i < limit; i++) {
    const c = s.charCodeAt(i)
    if (c === 9 || c === 10 || c === 13) continue
    if (c < 32 || (c >= 0x80 && c <= 0xff)) return true
  }
  return false
}

function tryBase64(s: string, urlSafe = false): string | null {
  try {
    let b = urlSafe ? s.replace(/-/g, '+').replace(/_/g, '/') : s
    while (b.length % 4) b += '='
    const bin = atob(b)
    const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return isTextual(text) ? text : null
  } catch {
    /* not decodable as base64 utf-8 text */
    return null
  }
}

function fieldCount(line: string, delimiter: string): number {
  let count = 1
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (quoted && line[i + 1] === '"') {
        i++
        continue
      }
      quoted = !quoted
    } else if (c === delimiter && !quoted) {
      count++
    }
  }
  return count
}

function mostCommon(nums: number[]): { value: number; hits: number } {
  const tally = new Map<number, number>()
  for (const n of nums) tally.set(n, (tally.get(n) ?? 0) + 1)
  let value = 0
  let hits = 0
  for (const [k, v] of tally) {
    if (v > hits || (v === hits && k > value)) {
      value = k
      hits = v
    }
  }
  return { value, hits }
}

const UUID_RE = /^\{?([0-9a-fA-F]{8})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{4})-([0-9a-fA-F]{12})\}?$/

const rot13 = (s: string) =>
  s.replace(/[A-Za-z]/g, (c) => {
    const base = c <= 'Z' ? 65 : 97
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base)
  })

const COMMON_WORDS = new Set([
  'the', 'and', 'that', 'have', 'for', 'not', 'with', 'you', 'this', 'but', 'his', 'her', 'from',
  'they', 'she', 'him', 'been', 'than', 'its', 'who', 'will', 'one', 'all', 'would', 'there',
  'their', 'what', 'out', 'about', 'which', 'when', 'make', 'can', 'like', 'time', 'just', 'know',
  'take', 'into', 'your', 'some', 'could', 'them', 'see', 'other', 'then', 'now', 'look', 'only',
  'come', 'over', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well',
  'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'are', 'was',
  'were', 'has', 'had', 'more', 'said', 'did', 'get', 'got', 'made', 'many', 'such', 'very',
  'much', 'where', 'why', 'hello', 'world', 'quick', 'brown', 'jumps', 'lazy', 'dog', 'attack',
  'dawn', 'secret', 'message', 'meet', 'here', 'text',
])

const englishHits = (s: string) => {
  let hits = 0
  for (const w of s.toLowerCase().split(/[^a-z]+/)) if (w && COMMON_WORDS.has(w)) hits++
  return hits
}

/* ------------------------------------------------------------------ detectors */

function detectJson(ctx: Ctx): Detection | null {
  if (!ctx.json.ok) return null
  const v = ctx.json.value
  if (Array.isArray(v)) {
    return { format: 'JSON', confidence: 0.99, note: `valid JSON array, ${plural(v.length, 'item')}` }
  }
  if (v && typeof v === 'object') {
    const keys = Object.keys(v as Record<string, unknown>).length
    return { format: 'JSON', confidence: 0.99, note: `valid JSON object, ${plural(keys, 'key')}` }
  }
  return { format: 'JSON', confidence: 0.45, note: `valid JSON scalar (${v === null ? 'null' : typeof v})` }
}

function detectJson5(ctx: Ctx): Detection | null {
  const t = ctx.text
  if (!t) return null
  if (ctx.json.ok) {
    if (!/^[{[]/.test(t)) return null
    return { format: 'JSON5', confidence: 0.45, note: 'valid JSON, which is a subset of JSON5' }
  }
  if (!/^[{[]/.test(t)) return null
  const markers: string[] = []
  if (/(^|[\s,{[])\/\//.test(ctx.sample) || /\/\*[\s\S]*?\*\//.test(ctx.sample)) markers.push('comments')
  if (/,\s*[}\]]/.test(ctx.sample)) markers.push('trailing commas')
  if (/'[^'\n]*'\s*:/.test(ctx.sample) || /:\s*'[^'\n]*'/.test(ctx.sample)) markers.push('single quotes')
  if (/[{,]\s*[A-Za-z_$][\w$]*\s*:/.test(ctx.sample)) markers.push('unquoted keys')
  if (/:\s*(Infinity|-Infinity|NaN)\b/.test(ctx.sample)) markers.push('Infinity/NaN')
  if (!markers.length) return null
  return {
    format: 'JSON5',
    confidence: round2(clamp(0.42 + 0.13 * markers.length)),
    note: `JSON-like with ${markers.join(', ')}`,
  }
}

function detectYaml(ctx: Ctx): Detection | null {
  if (/^[{[]/.test(ctx.text)) {
    return ctx.json.ok ? { format: 'YAML', confidence: 0.3, note: 'JSON is also valid YAML' } : null
  }
  const lines = ctx.lines.filter((l) => l.trim() && !/^\s*#/.test(l)).slice(0, MAX_LINES)
  if (!lines.length) return null
  let mapping = 0
  let seq = 0
  let doc = 0
  for (const raw of lines) {
    const t = raw.trim()
    if (t === '---' || t === '...' || t.startsWith('--- ')) {
      doc++
    } else if (/^-(\s+\S|$)/.test(t)) {
      seq++
    } else if (/^(?:"[^"]*"|'[^']*'|[A-Za-z0-9_. -]+):(?:\s|$)/.test(t)) {
      mapping++
    }
  }
  const good = mapping + seq + doc
  if (!good) return null
  const ratio = good / lines.length
  if (ratio < 0.5) return null
  if (mapping === 0) {
    return {
      format: 'YAML',
      confidence: round2(clamp(0.25 + 0.15 * ratio)),
      note: `${seq} sequence entr${seq === 1 ? 'y' : 'ies'} — could also be a Markdown list`,
    }
  }
  let conf = 0.4 + 0.45 * ratio
  if (doc) conf += 0.08
  if (lines.length === 1) conf = Math.min(conf, 0.45)
  return {
    format: 'YAML',
    confidence: round2(clamp(conf)),
    note: `${mapping} mapping and ${seq} sequence lines of ${lines.length}`,
  }
}

function detectToml(ctx: Ctx): Detection | null {
  const lines = ctx.content.filter((l) => !l.startsWith('#')).slice(0, MAX_LINES)
  if (!lines.length) return null
  const tables = lines.filter((l) => /^\[\[?[^\]]+\]\]?$/.test(l)).length
  const pairs = lines.filter((l) => /^[A-Za-z0-9_."'-]+\s*=\s*\S/.test(l))
  if (!pairs.length && !tables) return null
  const typed = pairs.filter((l) =>
    /=\s*("|'|-?\d|true\b|false\b|\[|\{)/.test(l)
  ).length
  const ratio = (tables + pairs.length) / lines.length
  if (ratio < 0.6) return null
  let conf = 0.28 + 0.3 * ratio + 0.25 * (typed / Math.max(1, pairs.length))
  if (tables) conf += 0.1
  // One bare `a=b` line is not a document — base64 padding alone produces that shape.
  if (lines.length === 1 && !tables) conf = Math.min(conf, 0.4)
  return {
    format: 'TOML',
    confidence: round2(clamp(conf)),
    note: `${plural(tables, 'table header')}, ${plural(pairs.length, 'key/value line')}`,
  }
}

function detectIni(ctx: Ctx): Detection | null {
  const body = ctx.content.filter((l) => !/^[;#]/.test(l)).slice(0, MAX_LINES)
  if (!body.length) return null
  const sections = body.filter((l) => /^\[[^\]]+\]$/.test(l)).length
  const pairs = body.filter((l) => /^[^=[\]]+=/.test(l)).length
  if (!pairs) return null
  const ratio = (sections + pairs) / body.length
  if (ratio < 0.7) return null
  let conf = 0.22 + 0.35 * ratio
  if (sections) conf += 0.15
  if (ctx.content.some((l) => l.startsWith(';'))) conf += 0.08
  if (body.length === 1 && !sections) conf = Math.min(conf, 0.4)
  return {
    format: 'INI',
    confidence: round2(clamp(conf)),
    note: `${plural(sections, 'section')}, ${plural(pairs, 'key=value line')}`,
  }
}

function detectDotenv(ctx: Ctx): Detection | null {
  const body = ctx.content.filter((l) => !l.startsWith('#')).slice(0, MAX_LINES)
  if (!body.length) return null
  if (body.some((l) => /^\[[^\]]+\]$/.test(l))) return null
  const keyRe = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/
  const matched = body.filter((l) => keyRe.test(l))
  if (!matched.length) return null
  const ratio = matched.length / body.length
  if (ratio < 0.7) return null
  const upper = matched.filter((l) => {
    const m = l.match(keyRe)
    return !!m && /[A-Z]/.test(m[1]) && m[1] === m[1].toUpperCase()
  }).length
  let conf = 0.22 + 0.3 * ratio + 0.25 * (upper / matched.length)
  if (body.some((l) => l.startsWith('export '))) conf += 0.05
  if (body.length === 1) conf = Math.min(conf, 0.4)
  return {
    format: '.env',
    confidence: round2(clamp(conf)),
    note: `${plural(matched.length, 'KEY=value line')}, ${upper} upper-case keys`,
  }
}

const HTML_TAGS = new Set([
  'html', 'head', 'body', 'div', 'span', 'p', 'a', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
  'thead', 'tbody', 'script', 'style', 'img', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'meta', 'link', 'form', 'input', 'button', 'select', 'option', 'label', 'section', 'article',
  'nav', 'header', 'footer', 'main', 'aside', 'strong', 'em', 'b', 'i', 'code', 'pre', 'title',
])

function htmlTagsIn(sample: string): Set<string> {
  const found = new Set<string>()
  const re = /<\/?([A-Za-z][A-Za-z0-9]*)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(sample))) {
    const tag = m[1].toLowerCase()
    if (HTML_TAGS.has(tag)) found.add(tag)
  }
  return found
}

function detectHtml(ctx: Ctx): Detection | null {
  if (/^\s*<!doctype\s+html/i.test(ctx.raw)) {
    return { format: 'HTML', confidence: 0.99, note: 'starts with an HTML doctype' }
  }
  const found = htmlTagsIn(ctx.sample)
  if (!found.size) return null
  const conf = clamp(0.28 + 0.12 * found.size)
  return {
    format: 'HTML',
    confidence: round2(conf),
    note: `${plural(found.size, 'HTML tag name')}: ${[...found].slice(0, 5).join(', ')}`,
  }
}

function detectXml(ctx: Ctx): Detection | null {
  if (/^\s*<\?xml/i.test(ctx.raw)) {
    return { format: 'XML', confidence: 0.98, note: 'starts with an XML declaration' }
  }
  const m = ctx.text.match(/^<([A-Za-z_][\w.:-]*)/)
  if (!m) return null
  if (/^\s*<!doctype\s+html/i.test(ctx.raw)) return null
  let wellFormed = false
  try {
    if (typeof DOMParser !== 'undefined') {
      const doc = new DOMParser().parseFromString(ctx.text, 'text/xml')
      wellFormed = doc.getElementsByTagName('parsererror').length === 0
    }
  } catch {
    /* no usable DOMParser — fall back to the structural guess */
  }
  const htmlish = htmlTagsIn(ctx.sample).size >= 2
  let conf = wellFormed ? 0.8 : 0.45
  if (htmlish) conf -= 0.35
  if (m[1].includes(':')) conf += 0.05
  return {
    format: 'XML',
    confidence: round2(clamp(conf)),
    note: wellFormed ? `well-formed, root element <${m[1]}>` : `tag-like text, root <${m[1]}>`,
  }
}

function detectDelimited(ctx: Ctx, delimiter: string, format: string): Detection | null {
  if (ctx.json.ok && /^[{[]/.test(ctx.text)) return null
  const lines = ctx.content.slice(0, MAX_LINES)
  if (!lines.length) return null
  if (!lines[0].includes(delimiter)) return null
  const counts = lines.map((l) => fieldCount(l, delimiter))
  const { value: columns, hits } = mostCommon(counts)
  if (columns < 2) return null
  const agree = hits / counts.length
  if (agree < 0.6) return null
  if (lines.length < 2 && columns < 3) return null
  let fields = 0
  let spacey = 0
  for (const l of lines.slice(0, 50)) {
    for (const f of l.split(delimiter)) {
      fields++
      if (f.trim().includes(' ')) spacey++
    }
  }
  let conf = 0.45 + 0.45 * agree
  if (columns === 2) conf -= 0.15
  if (lines.length < 2) conf -= 0.25
  if (delimiter === ',' && fields && spacey / fields > 0.6) conf -= 0.25
  return {
    format,
    confidence: round2(clamp(conf)),
    note: `${plural(lines.length, 'row')} × ${columns} columns, ${Math.round(agree * 100)}% consistent`,
  }
}

function detectBase64(ctx: Ctx): Detection[] {
  const c = ctx.compact
  const out: Detection[] = []
  if (c.length < 8 || c.length > 4_000_000) return out
  // A canonical UUID matches the url-safe alphabet by accident; it is never a base64 payload.
  if (UUID_RE.test(c)) return out
  const std = /^[A-Za-z0-9+/]+={0,2}$/.test(c) && c.length % 4 === 0
  // No base64 stream can have a length of 4n+1, padded or not.
  const url = /^[A-Za-z0-9_-]+={0,2}$/.test(c) && /[-_]/.test(c) && c.length % 4 !== 1
  if (std) {
    const decoded = tryBase64(c)
    let conf = decoded === null ? 0.55 : 0.82
    if (/[+/]/.test(c)) conf += 0.06
    if (c.endsWith('=')) conf += 0.06
    const size = (c.length / 4) * 3 - (c.match(/=+$/)?.[0].length ?? 0)
    out.push({
      format: 'base64',
      confidence: round2(clamp(conf)),
      note:
        decoded === null
          ? `${plural(size, 'byte')} of binary when decoded`
          : `decodes to text: ${preview(decoded)}`,
    })
    // Only the 62/63 characters differ between the alphabets, so this doubles as base64url
    // exactly when neither of them is present.
    if (!/[+/]/.test(c)) {
      out.push({
        format: 'base64url',
        confidence: 0.35,
        note: 'also valid base64url — no + or / characters present',
      })
    }
  } else if (url) {
    const decoded = tryBase64(c, true)
    let conf = decoded === null ? 0.45 : 0.85
    if (decoded === null && c.length % 4 === 0) conf += 0.1
    out.push({
      format: 'base64url',
      confidence: round2(clamp(conf)),
      note: decoded === null ? 'url-safe alphabet, decodes to binary' : `decodes to text: ${preview(decoded)}`,
    })
  }
  return out
}

function detectHex(ctx: Ctx): Detection | null {
  const c = ctx.compact.replace(/^0x/i, '')
  if (c.length < 4 || !/^[0-9a-fA-F]+$/.test(c)) return null
  let conf = c.length % 2 === 0 ? 0.6 : 0.3
  if (/^[0-9]+$/.test(c)) conf -= 0.2
  if (c.length >= 16 && c.length % 2 === 0) conf += 0.1
  if (/^0x/i.test(ctx.compact)) conf += 0.15
  return {
    format: 'hex',
    confidence: round2(clamp(conf)),
    note:
      c.length % 2 === 0
        ? `${plural(c.length, 'hex digit')} (${c.length / 2} bytes)`
        : `${plural(c.length, 'hex digit')} — odd length, not whole bytes`,
  }
}

function detectBase32(ctx: Ctx): Detection | null {
  const c = ctx.compact
  if (c.length < 8 || c.length % 8 !== 0) return null
  if (!/^[A-Za-z2-7]+=*$/.test(c)) return null
  let conf = 0.4
  if (/[2-7]/.test(c)) conf += 0.15
  if (c.endsWith('=')) conf += 0.12
  if (c === c.toUpperCase()) conf += 0.08
  return {
    format: 'base32',
    confidence: round2(clamp(conf)),
    note: `${plural(c.length, 'character')} in the RFC 4648 base32 alphabet`,
  }
}

function detectUrlEncoded(ctx: Ctx): Detection | null {
  const escapes = (ctx.sample.match(/%[0-9A-Fa-f]{2}/g) || []).length
  const queryShape = /^[^=&\s]+=[^&\s]*(?:&[^=&\s]+=[^&\s]*)+$/.test(ctx.text)
  if (!escapes && !queryShape) return null
  const notes: string[] = []
  let conf = 0
  if (escapes) {
    conf = 0.42 + 0.06 * escapes
    notes.push(plural(escapes, 'percent-escape'))
  }
  if (queryShape) {
    conf = Math.max(conf, 0.62)
    notes.push('key=value&… query-string shape')
  }
  try {
    decodeURIComponent(ctx.text)
  } catch {
    conf -= 0.25
    notes.push('contains invalid escape sequences')
  }
  return { format: 'URL-encoded', confidence: round2(clamp(conf)), note: notes.join(', ') }
}

function detectJwt(ctx: Ctx): Detection | null {
  const m = ctx.text.match(/^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]*)$/)
  if (!m) return null
  const head = tryBase64(m[1], true)
  if (head) {
    try {
      const parsed = JSON.parse(head) as Record<string, unknown>
      if (parsed && typeof parsed === 'object' && 'alg' in parsed) {
        const typ = typeof parsed.typ === 'string' ? `, typ=${parsed.typ}` : ''
        return { format: 'JWT', confidence: 0.99, note: `header alg=${String(parsed.alg)}${typ}` }
      }
    } catch {
      /* header is not JSON — fall through to the weak match */
    }
  }
  return { format: 'JWT', confidence: 0.4, note: 'three base64url segments, but the header is not a JSON object' }
}

function detectUuid(ctx: Ctx): Detection | null {
  const lines = ctx.content.slice(0, MAX_LINES)
  if (!lines.length) return null
  const matched = lines.filter((l) => UUID_RE.test(l))
  if (!matched.length) return null
  if (matched.length !== lines.length) {
    return {
      format: 'UUID',
      confidence: round2(clamp(0.2 + 0.4 * (matched.length / lines.length))),
      note: `${matched.length} of ${lines.length} lines are UUIDs`,
    }
  }
  if (lines.length === 1) {
    const parts = UUID_RE.exec(lines[0])
    const version = parts ? parts[3][0] : '?'
    return { format: 'UUID', confidence: 0.99, note: `canonical UUID, version ${version}` }
  }
  return { format: 'UUID', confidence: 0.92, note: `${plural(lines.length, 'UUID')}, one per line` }
}

function detectDataUri(ctx: Ctx): Detection | null {
  const m = ctx.text.match(/^data:([^;,]*)((?:;[^;,]*)*),/i)
  if (!m) return null
  const mime = m[1] || 'text/plain'
  const b64 = /;base64/i.test(m[2])
  return {
    format: 'data URI',
    confidence: 0.98,
    note: `mime ${mime}${b64 ? ', base64 payload' : ', percent-encoded payload'}`,
  }
}

function detectMagic(ctx: Ctx): Detection[] {
  const out: Detection[] = []
  const b = ctx.bytes
  if (b && b.length >= 2) {
    if (b[0] === 0x1f && b[1] === 0x8b) {
      out.push({ format: 'gzip', confidence: 0.99, note: 'gzip magic number 1f 8b' })
    } else if ((b[0] & 0x0f) === 0x08 && ((b[0] << 8) | b[1]) % 31 === 0) {
      // CINFO is log2(window) - 8, so the real window is 2^(CINFO+8) bytes.
      const window = 1 << ((b[0] >> 4) + 8)
      out.push({ format: 'zlib', confidence: 0.8, note: `zlib header, ${window}-byte window` })
    }
  }
  if (/^H4sI/.test(ctx.compact)) {
    out.push({ format: 'gzip', confidence: 0.85, note: 'base64-encoded gzip stream (H4sI…)' })
  }
  return out
}

const EMAIL_RE = /^[^\s@,;:<>]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/

function detectEmail(ctx: Ctx): Detection | null {
  const lines = ctx.content.slice(0, MAX_LINES)
  if (!lines.length) return null
  const matched = lines.filter((l) => EMAIL_RE.test(l)).length
  if (matched !== lines.length) return null
  return lines.length === 1
    ? { format: 'email', confidence: 0.95, note: `single address at ${ctx.text.split('@')[1]}` }
    : { format: 'email', confidence: 0.9, note: `${plural(lines.length, 'address')}, one per line` }
}

function detectUrl(ctx: Ctx): Detection | null {
  const lines = ctx.content.slice(0, MAX_LINES)
  if (!lines.length) return null
  let matched = 0
  let protocol = ''
  for (const l of lines) {
    try {
      const u = new URL(l)
      if (/^(?:https?|ftp|ftps|ws|wss|file|mailto):$/.test(u.protocol)) {
        matched++
        if (!protocol) protocol = u.protocol.replace(':', '')
      }
    } catch {
      /* not a URL */
    }
  }
  if (matched === lines.length && matched > 0) {
    return lines.length === 1
      ? { format: 'URL', confidence: 0.95, note: `${protocol} URL` }
      : { format: 'URL', confidence: 0.9, note: `${plural(lines.length, 'URL')}, one per line` }
  }
  if (lines.length === 1 && /^www\.[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+(\/|$)/.test(lines[0])) {
    return { format: 'URL', confidence: 0.55, note: 'hostname without a scheme' }
  }
  return null
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(?:\/(\d{1,2}))?$/

function isIpv4(s: string): boolean {
  const m = IPV4_RE.exec(s)
  if (!m) return false
  if (m.slice(1, 5).some((o) => Number(o) > 255 || (o.length > 1 && o.startsWith('0')))) return false
  return m[5] === undefined || Number(m[5]) <= 32
}

function isIpv6(s: string): boolean {
  const [addr, prefix] = s.split('/')
  if (prefix !== undefined && !(Number(prefix) >= 0 && Number(prefix) <= 128)) return false
  if (!addr.includes(':') || !/^[0-9a-fA-F:.]+$/.test(addr)) return false
  const double = addr.split('::')
  if (double.length > 2) return false
  const groups = addr.split(':').filter((g) => g !== '')
  if (groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g) && !isIpv4(g))) return false
  return double.length === 2 ? groups.length <= 7 : addr.split(':').length === 8
}

function detectIp(ctx: Ctx): Detection | null {
  const lines = ctx.content.slice(0, MAX_LINES)
  if (!lines.length) return null
  const v4 = lines.filter(isIpv4).length
  const v6 = lines.filter(isIpv6).length
  if (v4 + v6 !== lines.length) return null
  const kind = v4 && v6 ? 'IPv4 and IPv6' : v4 ? 'IPv4' : 'IPv6'
  return {
    format: 'IP address',
    confidence: lines.length === 1 ? 0.95 : 0.9,
    note: `${plural(lines.length, 'address')} (${kind})`,
  }
}

function detectTimestamp(ctx: Ctx): Detection[] {
  const t = ctx.text
  const out: Detection[] = []
  if (!/^\d{9,14}$/.test(t)) return out
  const n = Number(t)
  const iso = (ms: number) => {
    try {
      return new Date(ms).toISOString()
    } catch {
      return 'out of range'
    }
  }
  if (t.length <= 11 && n >= 1e8 && n <= 4e9) {
    out.push({ format: 'unix timestamp (seconds)', confidence: 0.7, note: iso(n * 1000) })
  }
  if (t.length >= 12 && n >= 1e11 && n <= 4e12) {
    out.push({ format: 'unix timestamp (milliseconds)', confidence: 0.7, note: iso(n) })
  }
  return out
}

const MARKDOWN_CHECKS: Array<[RegExp, string]> = [
  [/^#{1,6}\s+\S/m, 'headings'],
  [/^\s{0,3}[-*+]\s+\S/m, 'bullet lists'],
  [/^\s{0,3}\d+\.\s+\S/m, 'ordered lists'],
  [/\[[^\]\n]+\]\([^)\n]*\)/, 'links'],
  [/!\[[^\]\n]*\]\([^)\n]*\)/, 'images'],
  [/```/, 'fenced code'],
  [/^>\s?\S/m, 'blockquotes'],
  [/\*\*[^*\n]+\*\*/, 'bold'],
  [/(?:^|\n)\s*\|[^\n]+\|\s*(?:\n|$)/, 'tables'],
  [/^ {0,3}([-*_])(?:\s*\1){2,}\s*$/m, 'horizontal rules'],
]

function detectMarkdown(ctx: Ctx): Detection | null {
  const hits = MARKDOWN_CHECKS.filter(([re]) => re.test(ctx.sample)).map(([, name]) => name)
  if (!hits.length) return null
  let conf = 0.22 + 0.13 * hits.length
  if (hits.length === 1 && (hits[0] === 'bullet lists' || hits[0] === 'horizontal rules')) conf = 0.3
  return {
    format: 'Markdown',
    confidence: round2(clamp(conf)),
    note: `${hits.length} markers: ${hits.slice(0, 4).join(', ')}`,
  }
}

const SQL_START =
  /^(SELECT|INSERT\s+INTO|INSERT|UPDATE|DELETE\s+FROM|CREATE\s+(?:TABLE|INDEX|VIEW|DATABASE|SCHEMA)|ALTER\s+TABLE|DROP\s+(?:TABLE|INDEX|VIEW|DATABASE)|TRUNCATE|GRANT|EXPLAIN|WITH)\b/i
const SQL_KEYWORDS = [
  'FROM', 'WHERE', 'VALUES', 'SET', 'JOIN', 'GROUP\\s+BY', 'ORDER\\s+BY', 'LIMIT', 'INNER', 'LEFT',
  'HAVING', 'PRIMARY\\s+KEY', 'NOT\\s+NULL', 'DISTINCT', 'AS',
]

function detectSql(ctx: Ctx): Detection | null {
  const head = ctx.text.replace(/^(?:\s*(?:--[^\n]*|\/\*[\s\S]*?\*\/)\s*)+/, '')
  if (!SQL_START.test(head)) return null
  const statement = (SQL_START.exec(head) || [''])[0].toUpperCase().replace(/\s+/g, ' ')
  const hits = SQL_KEYWORDS.filter((k) => new RegExp(`\\b${k}\\b`, 'i').test(ctx.sample)).length
  let conf = 0.68 + Math.min(0.25, 0.05 * hits)
  if (/;\s*$/.test(ctx.text)) conf += 0.05
  return {
    format: 'SQL',
    confidence: round2(clamp(conf)),
    note: `${statement} statement, ${plural(hits, 'other keyword')}`,
  }
}

const MORSE_RE = new RegExp('^[.\\u00B7\\u2022\\u2013\\u2014_|/\\s-]+$')

function detectMorse(ctx: Ctx): Detection | null {
  const t = ctx.text
  if (t.length < 3 || !MORSE_RE.test(t)) return null
  const groups = t.split(/[\s/|]+/).filter(Boolean)
  if (groups.length < 2) return null
  if (!/[.·]/.test(t) && !/[-_–—]/.test(t)) return null
  const wellFormed = groups.filter((g) => g.length <= 7).length / groups.length
  return {
    format: 'Morse code',
    confidence: round2(clamp(0.4 + 0.5 * wellFormed)),
    note: `${plural(groups.length, 'symbol group')}, longest ${Math.max(...groups.map((g) => g.length))} symbols`,
  }
}

function detectBinary(ctx: Ctx): Detection | null {
  const c = ctx.compact
  if (c.length < 8 || !/^[01]+$/.test(c)) return null
  let conf = 0.5
  let note = `${plural(c.length, 'bit')}, not a whole number of bytes`
  if (c.length % 8 === 0) {
    conf = 0.8
    note = `${plural(c.length, 'bit')} (${c.length / 8} bytes)`
  } else if (c.length % 7 === 0) {
    conf = 0.6
    note = `${plural(c.length, 'bit')}, a multiple of 7 (7-bit ASCII?)`
  }
  return { format: 'binary', confidence: conf, note }
}

function detectRot13(ctx: Ctx): Detection | null {
  const sample = ctx.sample
  const letters = (sample.match(/[A-Za-z]/g) || []).length
  if (letters < 12) return null
  const plainHits = englishHits(sample)
  const rotHits = englishHits(rot13(sample))
  if (rotHits < 2 || rotHits <= plainHits) return null
  return {
    format: 'ROT13',
    confidence: round2(clamp(Math.min(0.85, 0.4 + 0.1 * rotHits))),
    note: `rot13 reveals ${plural(rotHits, 'common English word')} (${plainHits} before)`,
  }
}

const DETECTORS: Array<(ctx: Ctx) => Detection | Detection[] | null> = [
  detectJson,
  detectJson5,
  detectYaml,
  detectToml,
  detectIni,
  detectDotenv,
  detectHtml,
  detectXml,
  (ctx) => detectDelimited(ctx, ',', 'CSV'),
  (ctx) => detectDelimited(ctx, '\t', 'TSV'),
  detectBase64,
  detectHex,
  detectBase32,
  detectUrlEncoded,
  detectJwt,
  detectUuid,
  detectDataUri,
  detectMagic,
  detectEmail,
  detectUrl,
  detectIp,
  detectTimestamp,
  detectMarkdown,
  detectSql,
  detectMorse,
  detectBinary,
  detectRot13,
]

function buildContext(input: unknown): Ctx {
  let raw: string
  let bytes: Uint8Array | null = null
  if (isBytes(input)) {
    bytes = input as Uint8Array
    raw = new TextDecoder().decode(bytes)
  } else if (typeof input === 'string') {
    raw = input
  } else if (input && typeof input === 'object') {
    try {
      raw = JSON.stringify(input)
    } catch {
      raw = String(input)
    }
  } else {
    raw = input === null || input === undefined ? '' : String(input)
  }
  if (!bytes && looksBinary(raw)) {
    const head = raw.slice(0, 64)
    if (![...head].some((ch) => (ch.codePointAt(0) ?? 0) > 0xff)) {
      bytes = Uint8Array.from(head, (ch) => ch.charCodeAt(0))
    }
  }
  const text = raw.trim()
  const sample = text.length > MAX_SAMPLE ? text.slice(0, MAX_SAMPLE) : text
  const lines = raw.split(/\r?\n/)
  const content = lines.map((l) => l.trim()).filter(Boolean).slice(0, MAX_LINES)
  let json: { ok: boolean; value: unknown } = { ok: false, value: null }
  try {
    json = { ok: true, value: JSON.parse(text) }
  } catch {
    /* not JSON */
  }
  return {
    raw,
    text,
    sample,
    lines,
    content,
    compact: text.replace(/\s+/g, ''),
    bytes,
    json,
  }
}

const util: Utility = {
  id: 'detect_format',
  name: 'detect format',
  category: 'Analysis',
  description:
    'Guess what the input is — JSON, YAML, TOML, XML, HTML, CSV, base64, hex, JWT, UUID, URLs, timestamps, Markdown, SQL, gzip and more — as a list of candidates with a confidence score and a note; never throws.',
  accepts: ['string', 'bytes'],
  produces: 'json',
  tags: ['format detection', 'sniff', 'identify format', 'guess format', 'content type', 'file type'],
  aliases: ['file -i'],
  params: {},
  examples: [
    {
      title: 'a small JSON object',
      input: '{"a":1,"b":[2,3]}',
      output: JSON.stringify(
        [
          { format: 'JSON', confidence: 0.99, note: 'valid JSON object, 2 keys' },
          { format: 'JSON5', confidence: 0.45, note: 'valid JSON, which is a subset of JSON5' },
          { format: 'YAML', confidence: 0.3, note: 'JSON is also valid YAML' }
        ],
        null,
        2
      )
    }
  ],
  apply: (input: any): any => {
    let results: Detection[] = []
    try {
      const ctx = buildContext(input)
      if (!ctx.raw.length) return []
      for (const detector of DETECTORS) {
        try {
          const found = detector(ctx)
          if (!found) continue
          for (const d of Array.isArray(found) ? found : [found]) {
            if (d.confidence > 0) results.push({ ...d, confidence: round2(d.confidence) })
          }
        } catch {
          /* a single bad detector must never sink the report */
        }
      }
      const best = results.reduce((m, r) => Math.max(m, r.confidence), 0)
      if (best < 0.3) {
        results.push({
          format: 'plain text',
          confidence: results.length ? 0.25 : 0.5,
          note: 'nothing structured matched with confidence',
        })
      }
    } catch {
      /* detection is best-effort: an unexpected failure yields no candidates */
      results = []
    }
    results.sort((a, b) => b.confidence - a.confidence || a.format.localeCompare(b.format))
    return results
  },
}

export default util
