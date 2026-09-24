import type { Utility } from '@/types/utility'

type Check = { valid: boolean; reason: string; normalized?: string }

const ok = (reason: string, normalized?: string): Check =>
  normalized === undefined ? { valid: true, reason } : { valid: true, reason, normalized }
const bad = (reason: string): Check => ({ valid: false, reason })

/* ------------------------------------------------------------------ shared */

const DOMAIN_LABEL = /^[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?$/u

/** Shared by email / domain: syntax of a registrable (multi-label) domain name. */
function checkDomain(host: string, requireDot: boolean): Check {
  let h = host
  if (h.endsWith('.')) h = h.slice(0, -1) // a trailing root dot is legal
  if (!h) return bad('domain is empty')
  const nameLength = Array.from(h).length
  if (nameLength > 253) return bad(`domain is ${nameLength} characters (max 253)`)
  if (h.startsWith('[') && h.endsWith(']')) return bad('IP address literals are not domain names')
  const labels = h.split('.')
  if (requireDot && labels.length < 2) return bad('needs at least two labels (e.g. example.com)')
  for (const label of labels) {
    if (!label) return bad('empty label (consecutive dots)')
    if (Array.from(label).length > 63) return bad(`label "${label}" exceeds 63 characters`)
    if (label.startsWith('-') || label.endsWith('-')) return bad(`label "${label}" starts or ends with "-"`)
    if (!DOMAIN_LABEL.test(label)) return bad(`label "${label}" contains invalid characters`)
  }
  if (requireDot) {
    const tld = labels[labels.length - 1]
    if (!/^xn--[a-z0-9-]+$/i.test(tld) && !/^\p{L}{2,}$/u.test(tld)) {
      return bad(`"${tld}" is not a valid top-level domain`)
    }
  }
  return ok('valid domain name', h.toLowerCase())
}

function checkIpv4Parts(value: string): { octets: number[] } | { error: string } {
  const parts = value.split('.')
  if (parts.length !== 4) return { error: `expected 4 dot-separated octets, found ${parts.length}` }
  const octets: number[] = []
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return { error: `"${p}" is not a decimal octet` }
    if (p.length > 1 && p[0] === '0') return { error: `octet "${p}" has a leading zero` }
    const n = Number(p)
    if (n > 255) return { error: `octet ${n} is greater than 255` }
    octets.push(n)
  }
  return { octets }
}

function ipv4Kind(o: number[]): string {
  if (o[0] === 127) return 'loopback'
  if (o[0] === 10 || (o[0] === 172 && o[1] >= 16 && o[1] <= 31) || (o[0] === 192 && o[1] === 168)) return 'private'
  if (o[0] === 169 && o[1] === 254) return 'link-local'
  if (o.every(x => x === 255)) return 'broadcast'
  if (o[0] >= 224 && o[0] <= 239) return 'multicast'
  if (o[0] >= 240) return 'reserved'
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return 'shared (CGNAT)'
  if (o[0] === 0) return 'unspecified'
  return 'public'
}

/** Expand an IPv6 literal to 8 numeric groups, or throw a specific reason. */
export function parseIpv6(input: string): { groups: number[]; zone: string } {
  let v = input.trim()
  if (v.startsWith('[') && v.endsWith(']')) v = v.slice(1, -1)
  let zone = ''
  const pct = v.indexOf('%')
  if (pct >= 0) {
    zone = v.slice(pct + 1)
    v = v.slice(0, pct)
    if (!zone) throw new Error('empty zone identifier after "%"')
  }
  if (!v) throw new Error('address is empty')
  const sides = v.split('::')
  if (sides.length > 2) throw new Error('only one "::" is allowed')
  const split = (side: string) => (side === '' ? [] : side.split(':'))
  let head = split(sides[0])
  let tail = sides.length === 2 ? split(sides[1]) : []
  if ([...head, ...tail].some(p => p === '')) throw new Error('empty group (stray ":")')

  let embedded: number[] = []
  const all = [...head, ...tail]
  const last = all[all.length - 1]
  if (last !== undefined && last.includes('.')) {
    // A dotted group is only legal as the very last component of the address:
    // in "1.2.3.4::" the "::" follows it, so it is not last and the address is invalid.
    if (sides.length === 2 && tail.length === 0) {
      throw new Error('an embedded IPv4 address must be the last component')
    }
    const res = checkIpv4Parts(last)
    if ('error' in res) throw new Error(`embedded IPv4 "${last}": ${res.error}`)
    const o = res.octets
    embedded = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]]
    if (tail.length) tail = tail.slice(0, -1)
    else head = head.slice(0, -1)
  }

  const hex = (p: string) => {
    if (!/^[0-9a-fA-F]{1,4}$/.test(p)) throw new Error(`"${p}" is not a 1-4 digit hex group`)
    return parseInt(p, 16)
  }
  const h = head.map(hex)
  const t = tail.map(hex)
  const total = h.length + t.length + embedded.length

  if (sides.length === 2) {
    if (total > 7) throw new Error('"::" must stand for at least one group of zeros')
    return { groups: [...h, ...new Array(8 - total).fill(0), ...t, ...embedded], zone }
  }
  if (total !== 8) throw new Error(`expected 8 groups, found ${total}`)
  return { groups: [...h, ...t, ...embedded], zone }
}

/**
 * RFC 5952 §5 keeps the dotted tail only for the well-known IPv4-mapped prefix
 * ::ffff:0:0/96. The IPv4-compatible ::a.b.c.d form is deprecated (RFC 4291 §2.5.5.1)
 * and must NOT be used here — otherwise ::1 would canonicalize to "::0.0.0.1".
 */
const isIpv4Embedded = (g: number[]) => g.slice(0, 5).every(x => x === 0) && g[5] === 0xffff

const dottedTail = (g: number[]) =>
  [g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff].join('.')

/** RFC 5952 canonical form: lowercase, longest zero run collapsed to "::". */
export function compressIpv6(groups: number[]): string {
  if (isIpv4Embedded(groups)) return `::ffff:${dottedTail(groups)}`
  let bestStart = -1
  let bestLen = 0
  let i = 0
  while (i < groups.length) {
    if (groups[i] !== 0) { i++; continue }
    let j = i
    while (j < groups.length && groups[j] === 0) j++
    if (j - i > bestLen) { bestLen = j - i; bestStart = i }
    i = j
  }
  const hex = groups.map(g => g.toString(16))
  if (bestLen < 2) return hex.join(':')
  return `${hex.slice(0, bestStart).join(':')}::${hex.slice(bestStart + bestLen).join(':')}`
}

const B64URL_CHARS = /^[A-Za-z0-9_-]+$/

function base64UrlToText(part: string): string {
  const std = part.replace(/-/g, '+').replace(/_/g, '/')
  const padded = std + '='.repeat((4 - (std.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
const daysInMonth = (y: number, m: number) =>
  [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December']

function checkYmd(y: number, m: number, d: number): string {
  if (m < 1 || m > 12) return `month ${m} is out of range (1-12)`
  const max = daysInMonth(y, m)
  if (d < 1 || d > max) return `${MONTHS[m - 1]} ${y} has ${max} days, got ${d}`
  return ''
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** A year has 53 ISO weeks exactly when 1 January or 31 December is a Thursday. */
function isoWeeksInYear(y: number): number {
  // Date.UTC maps years 0-99 onto 1900-1999, so set the year explicitly.
  const weekday = (month: number, day: number) => {
    const d = new Date(Date.UTC(2000, month, day))
    d.setUTCFullYear(y)
    return d.getUTCDay()
  }
  return weekday(0, 1) === 4 || weekday(11, 31) === 4 ? 53 : 52
}

/* ------------------------------------------------------------- validators */

function validateEmail(value: string): Check {
  if (Array.from(value).length > 254) return bad('address exceeds 254 characters')
  const at = value.lastIndexOf('@')
  if (at < 0) return bad('missing "@"')
  const local = value.slice(0, at)
  const domain = value.slice(at + 1)
  if (!local) return bad('local part (before "@") is empty')
  if (Array.from(local).length > 64) return bad('local part exceeds 64 characters')
  const quoted = /^"(?:[^"\\]|\\.)*"$/.test(local)
  if (!quoted) {
    if (local.startsWith('.') || local.endsWith('.')) return bad('local part starts or ends with "."')
    if (local.includes('..')) return bad('local part contains ".."')
    if (!/^[\p{L}\p{N}!#$%&'*+/=?^_`{|}~.-]+$/u.test(local)) {
      return bad('local part contains characters that must be quoted')
    }
  }
  const dom = checkDomain(domain, true)
  if (!dom.valid) return bad(`invalid domain: ${dom.reason}`)
  return ok('valid email address', `${local}@${dom.normalized}`)
}

function validateUrl(value: string): Check {
  if (/\s/u.test(value)) return bad('contains whitespace')
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return bad('not an absolute URL (a scheme such as "https://" is required)')
  }
  const scheme = u.protocol.replace(/:$/, '')
  const needsHost = ['http', 'https', 'ftp', 'ftps', 'ws', 'wss'].includes(scheme)
  if (needsHost && !u.hostname) return bad(`"${scheme}" URLs require a host`)
  return ok(`valid ${scheme} URL`, u.href)
}

function validateUuid(value: string): Check {
  let v = value.trim().replace(/^urn:uuid:/i, '')
  // Brackets must match: "{...)" is not a registry-format UUID.
  if (/^\{.*\}$/s.test(v) || /^\(.*\)$/s.test(v)) v = v.slice(1, -1)
  const canonical = v.toLowerCase()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(canonical)) {
    if (/^[0-9a-f]{32}$/.test(canonical)) {
      const hy = `${canonical.slice(0, 8)}-${canonical.slice(8, 12)}-${canonical.slice(12, 16)}-${canonical.slice(16, 20)}-${canonical.slice(20)}`
      return bad(`missing hyphens (did you mean ${hy}?)`)
    }
    return bad('expected 8-4-4-4-12 hexadecimal digits')
  }
  if (/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(canonical)) return ok('valid nil UUID', canonical)
  if (/^f{8}-f{4}-f{4}-f{4}-f{12}$/.test(canonical)) return ok('valid max UUID', canonical)
  const version = canonical[14]
  const variant = canonical[19]
  if (!/[1-8]/.test(version)) return bad(`unknown UUID version "${version}"`)
  if (!/[89ab]/.test(variant)) return bad(`invalid variant digit "${variant}" (RFC 4122 requires 8, 9, a or b)`)
  return ok(`valid UUID version ${version}`, canonical)
}

function validateIpv4(value: string): Check {
  const res = checkIpv4Parts(value)
  if ('error' in res) return bad(res.error)
  return ok(`valid IPv4 address (${ipv4Kind(res.octets)})`, res.octets.join('.'))
}

function validateIpv6(value: string): Check {
  let parsed: { groups: number[]; zone: string }
  try {
    parsed = parseIpv6(value)
  } catch (e: any) {
    return bad(e?.message || 'invalid IPv6 address')
  }
  const { groups, zone } = parsed
  const compressed = compressIpv6(groups) + (zone ? `%${zone}` : '')
  const kind =
    groups.every(g => g === 0) ? 'unspecified'
      : groups.slice(0, 7).every(g => g === 0) && groups[7] === 1 ? 'loopback'
        : groups.slice(0, 5).every(g => g === 0) && groups[5] === 0xffff ? 'IPv4-mapped'
          : (groups[0] & 0xfe00) === 0xfc00 ? 'unique local'
            : (groups[0] & 0xffc0) === 0xfe80 ? 'link-local'
              : (groups[0] & 0xff00) === 0xff00 ? 'multicast'
                : 'global unicast'
  return ok(`valid IPv6 address (${kind})`, compressed)
}

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

function validateSemver(value: string): Check {
  const hadV = /^v/i.test(value)
  const v = hadV ? value.slice(1) : value
  const m = SEMVER.exec(v)
  if (!m) {
    // Order matters: the generic "bad pre-release" message matches almost anything
    // that starts with three numbers, so the specific diagnoses have to come first.
    if (/^\d+\.\d+$/.test(v)) return bad('missing patch version (expected MAJOR.MINOR.PATCH)')
    if (/^\d+(?:\.\d+){3,}$/.test(v)) return bad('too many numeric components (expected exactly MAJOR.MINOR.PATCH)')
    // Only the core MAJOR.MINOR.PATCH — build metadata may legitimately hold "01".
    if (/(?:^|\.)0\d/.test(v.split(/[-+]/)[0])) {
      return bad('numeric identifiers must not have leading zeros')
    }
    const pre = /^\d+\.\d+\.\d+-([^+]*)/.exec(v)
    if (pre && pre[1].split('.').some(id => /^0\d+$/.test(id))) {
      return bad('numeric pre-release identifiers must not have leading zeros')
    }
    if (/^\d+\.\d+\.\d+/.test(v)) return bad('invalid pre-release or build metadata')
    return bad('expected MAJOR.MINOR.PATCH (SemVer 2.0.0)')
  }
  const bits = [`${m[1]}.${m[2]}.${m[3]}`]
  if (m[4]) bits.push(`pre-release "${m[4]}"`)
  if (m[5]) bits.push(`build "${m[5]}"`)
  return ok(`valid SemVer${hadV ? ' (leading "v" ignored)' : ''}: ${bits.join(', ')}`, v)
}

function luhn(digits: string): boolean {
  let sum = 0
  let dbl = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits.charCodeAt(i) - 48
    if (dbl) { n *= 2; if (n > 9) n -= 9 }
    sum += n
    dbl = !dbl
  }
  return sum % 10 === 0
}

function cardBrand(d: string): string {
  const n = (a: number, b: number) => Number(d.slice(a, b))
  if (/^4/.test(d) && [13, 16, 19].includes(d.length)) return 'Visa'
  if ((n(0, 2) >= 51 && n(0, 2) <= 55) || (n(0, 4) >= 2221 && n(0, 4) <= 2720)) return 'Mastercard'
  if (/^3[47]/.test(d) && d.length === 15) return 'American Express'
  if (/^(6011|65)/.test(d) || (n(0, 3) >= 644 && n(0, 3) <= 649)) return 'Discover'
  if (n(0, 4) >= 3528 && n(0, 4) <= 3589) return 'JCB'
  if (/^3(0[0-5]|[68])/.test(d)) return 'Diners Club'
  if (/^62/.test(d)) return 'UnionPay'
  if (/^(5018|5020|5038|6304|6759|676[1-3])/.test(d)) return 'Maestro'
  return 'unknown brand'
}

function validateCreditCard(value: string): Check {
  const d = value.replace(/[\s-]/g, '')
  if (!d) return bad('no digits found')
  if (!/^\d+$/.test(d)) return bad('contains non-digit characters (only spaces and hyphens may separate digits)')
  if (d.length < 12 || d.length > 19) return bad(`card numbers are 12-19 digits, got ${d.length}`)
  if (!luhn(d)) return bad('fails the Luhn checksum')
  const brand = cardBrand(d)
  const groups = brand === 'American Express'
    ? [d.slice(0, 4), d.slice(4, 10), d.slice(10)]
    : (d.match(/.{1,4}/g) as string[])
  return ok(`valid card number (${brand}, Luhn check passed)`, groups.filter(Boolean).join(' '))
}

function validateIsbn(value: string): Check {
  const raw = value.replace(/[\s-]/g, '').toUpperCase()
  if (!raw) return bad('no digits found')
  if (raw.length === 10) {
    if (!/^\d{9}[\dX]$/.test(raw)) return bad('ISBN-10 must be 9 digits plus a check digit (0-9 or X)')
    let sum = 0
    for (let i = 0; i < 9; i++) sum += (10 - i) * (raw.charCodeAt(i) - 48)
    sum += raw[9] === 'X' ? 10 : raw.charCodeAt(9) - 48
    if (sum % 11 !== 0) return bad('ISBN-10 check digit does not match')
    const core = `978${raw.slice(0, 9)}`
    let s = 0
    for (let i = 0; i < 12; i++) s += (i % 2 ? 3 : 1) * (core.charCodeAt(i) - 48)
    const check = (10 - (s % 10)) % 10
    return ok(`valid ISBN-10 (ISBN-13 equivalent: ${core}${check})`, raw)
  }
  if (raw.length === 13) {
    if (!/^\d{13}$/.test(raw)) return bad('ISBN-13 must be 13 digits')
    if (!/^97[89]/.test(raw)) return bad('ISBN-13 must start with the 978 or 979 prefix')
    let s = 0
    for (let i = 0; i < 13; i++) s += (i % 2 ? 3 : 1) * (raw.charCodeAt(i) - 48)
    if (s % 10 !== 0) return bad('ISBN-13 check digit does not match')
    return ok('valid ISBN-13', raw)
  }
  return bad(`expected 10 or 13 characters after removing separators, got ${raw.length}`)
}

function validateMac(value: string): Check {
  const v = value.trim()
  let hex = ''
  if (/^[0-9a-fA-F]{12}$/.test(v) || /^[0-9a-fA-F]{16}$/.test(v)) {
    hex = v
  } else if (/^[0-9a-fA-F]{2}([:-])(?:[0-9a-fA-F]{2}\1){4,6}[0-9a-fA-F]{2}$/.test(v)) {
    hex = v.replace(/[:-]/g, '')
  } else if (/^[0-9a-fA-F]{4}(?:\.[0-9a-fA-F]{4}){2,3}$/.test(v)) {
    hex = v.replace(/\./g, '')
  } else {
    if (/[^0-9a-fA-F:.\-\s]/.test(v)) return bad('contains non-hexadecimal characters')
    return bad('expected 12 (EUI-48) or 16 (EUI-64) hex digits separated consistently by ":", "-" or "."')
  }
  if (hex.length !== 12 && hex.length !== 16) {
    return bad(`expected 12 or 16 hex digits, got ${hex.length}`)
  }
  const first = parseInt(hex.slice(0, 2), 16)
  const cast = first & 0x01 ? 'multicast' : 'unicast'
  const admin = first & 0x02 ? 'locally administered' : 'universally administered'
  const normalized = (hex.toLowerCase().match(/.{2}/g) as string[]).join(':')
  return ok(`valid ${hex.length === 12 ? 'EUI-48' : 'EUI-64'} address (${cast}, ${admin})`, normalized)
}

function validateHexColor(value: string): Check {
  const v = value.trim()
  const hadHash = v.startsWith('#')
  const hex = hadHash ? v.slice(1) : v
  if (!hex) return bad('no hex digits found')
  if (!/^[0-9a-fA-F]+$/.test(hex)) return bad('contains characters outside 0-9 and a-f')
  if (![3, 4, 6, 8].includes(hex.length)) {
    return bad(`expected 3, 4, 6 or 8 hex digits, got ${hex.length}`)
  }
  const expanded = hex.length <= 4 ? Array.from(hex).map(c => c + c).join('') : hex
  const kind = expanded.length === 8 ? 'RGBA' : 'RGB'
  return ok(`valid ${hex.length}-digit hex color (${kind})${hadHash ? '' : ' — the "#" is missing'}`,
    `#${expanded.toLowerCase()}`)
}

function validateJson(value: string): Check {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch (e: any) {
    return bad(e?.message || 'invalid JSON')
  }
  const kind = Array.isArray(parsed) ? 'array'
    : parsed === null ? 'null'
      : typeof parsed === 'object' ? 'object'
        : typeof parsed
  return ok(`valid JSON (${kind})`, JSON.stringify(parsed))
}

function validateBase64(value: string): Check {
  const v = value.replace(/\s+/g, '')
  if (!v) return bad('no base64 data found')
  const urlSafe = /[-_]/.test(v)
  if (urlSafe && /[+/]/.test(v)) return bad('mixes the standard (+/) and url-safe (-_) alphabets')
  const std = v.replace(/-/g, '+').replace(/_/g, '/')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(std)) return bad('contains characters outside the base64 alphabet')
  const body = std.replace(/=+$/, '')
  if (body.length % 4 === 1) return bad('length is not a valid base64 length')
  if (std.includes('=') && std.length % 4 !== 0) return bad('incorrect padding')
  const padded = body + '='.repeat((4 - (body.length % 4)) % 4)
  let bytes = 0
  try {
    bytes = atob(padded).length
  } catch {
    return bad('not decodable as base64')
  }
  return ok(`valid base64${urlSafe ? 'url' : ''} (${bytes} byte${bytes === 1 ? '' : 's'})`, padded)
}

function validateDate(value: string): Check {
  const v = value.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(v)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const err = checkYmd(y, mo, d)
    if (err) return bad(err)
    const iso = `${m[1]}-${pad2(mo)}-${pad2(d)}`
    if (v.length > 10) {
      const t = Date.parse(v)
      if (Number.isNaN(t)) return bad('the time portion is not a valid time')
      return ok('valid date-time', new Date(t).toISOString())
    }
    return ok('valid calendar date', iso)
  }
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v)
  if (m) {
    const [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const err = checkYmd(y, mo, d)
    if (err) return bad(`${err} (read as MM/DD/YYYY)`)
    return ok('valid calendar date (MM/DD/YYYY)', `${y}-${pad2(mo)}-${pad2(d)}`)
  }
  m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(v)
  if (m) {
    const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const err = checkYmd(y, mo, d)
    if (err) return bad(`${err} (read as DD.MM.YYYY)`)
    return ok('valid calendar date (DD.MM.YYYY)', `${y}-${pad2(mo)}-${pad2(d)}`)
  }
  const t = Date.parse(v)
  if (Number.isNaN(t)) return bad('not a recognizable date')
  return ok('valid date (parsed leniently)', new Date(t).toISOString())
}

const ISO_DURATION = /^P(?!$)(?:\d+(?:[.,]\d+)?Y)?(?:\d+(?:[.,]\d+)?M)?(?:\d+(?:[.,]\d+)?W)?(?:\d+(?:[.,]\d+)?D)?(?:T(?!$)(?:\d+(?:[.,]\d+)?H)?(?:\d+(?:[.,]\d+)?M)?(?:\d+(?:[.,]\d+)?S)?)?$/
const ISO_TIME = /^(\d{2}):?(\d{2})(?::?(\d{2}))?([.,]\d+)?(Z|[+-]\d{2}(?::?\d{2})?)?$/

function checkIso8601Point(v: string): Check {
  const sep = v.indexOf('T')
  const datePart = sep >= 0 ? v.slice(0, sep) : v
  const timePart = sep >= 0 ? v.slice(sep + 1) : ''
  if (sep >= 0 && !timePart) return bad('"T" is not followed by a time')

  let kind = ''
  let cal = ''
  let complete = false // a date precise to the day — the only kind a time may follow
  let m: RegExpExecArray | null
  if ((m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(datePart))) {
    const err = checkYmd(Number(m[1]), Number(m[2]), Number(m[3]))
    if (err) return bad(err)
    kind = 'calendar date'
    cal = `${m[1]}-${m[2]}-${m[3]}`
    complete = true
  } else if ((m = /^(\d{4})-?W(\d{2})(?:-?(\d))?$/.exec(datePart))) {
    const week = Number(m[2])
    const weeks = isoWeeksInYear(Number(m[1]))
    if (week < 1 || week > 53) return bad(`week ${week} is out of range (01-53)`)
    if (week > weeks) return bad(`${m[1]} has only ${weeks} ISO weeks`)
    if (m[3] && (Number(m[3]) < 1 || Number(m[3]) > 7)) return bad('week day must be 1-7')
    kind = 'week date'
    complete = !!m[3]
  } else if ((m = /^(\d{4})-?(\d{3})$/.exec(datePart))) {
    const day = Number(m[2])
    const max = isLeap(Number(m[1])) ? 366 : 365
    if (day < 1 || day > max) return bad(`ordinal day ${day} is out of range (001-${max})`)
    kind = 'ordinal date'
    complete = true
  } else if (/^\d{4}-\d{2}$/.test(datePart)) {
    const mo = Number(datePart.slice(5))
    if (mo < 1 || mo > 12) return bad(`month ${mo} is out of range (1-12)`)
    kind = 'year-month'
  } else if (/^\d{4}$/.test(datePart)) {
    kind = 'year'
  } else {
    return bad('date part is not ISO 8601 (expected YYYY-MM-DD, YYYY-Www-D or YYYY-DDD)')
  }

  if (!timePart) return ok(`valid ISO 8601 ${kind}`, cal || undefined)
  if (!complete) return bad(`a time cannot follow a ${kind} — the date must be precise to the day`)

  const t = ISO_TIME.exec(timePart)
  if (!t) return bad('time part is not ISO 8601 (expected HH:MM[:SS[.sss]][Z|±HH:MM])')
  const [hh, mm, ss] = [Number(t[1]), Number(t[2]), t[3] ? Number(t[3]) : 0]
  if (hh > 24) return bad(`hour ${hh} is out of range (00-24)`)
  if (mm > 59) return bad(`minute ${mm} is out of range (00-59)`)
  if (ss > 60) return bad(`second ${ss} is out of range (00-60)`)
  if (hh === 24 && (mm !== 0 || ss !== 0)) return bad('24:00 is only valid as exactly 24:00:00')
  const zone = t[5] ? (t[5] === 'Z' ? 'UTC' : `offset ${t[5]}`) : 'no timezone (local)'
  const parsed = Date.parse(v)
  return ok(`valid ISO 8601 date-time, ${zone}`,
    Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString())
}

function validateIso8601(value: string): Check {
  const v = value.trim()
  if (ISO_DURATION.test(v)) return ok('valid ISO 8601 duration')
  if (v.includes('/')) {
    const parts = v.split('/')
    if (parts.length !== 2) return bad('an interval has exactly two parts separated by "/"')
    const durations = parts.map(p => ISO_DURATION.test(p))
    for (const [i, p] of parts.entries()) {
      const good = durations[i] || checkIso8601Point(p).valid
      if (!good) return bad(`interval part "${p}" is not a valid ISO 8601 date-time or duration`)
    }
    // <start>/<end>, <start>/<duration> and <duration>/<end> are the three legal forms.
    if (durations[0] && durations[1]) return bad('an interval cannot be two durations')
    return ok('valid ISO 8601 interval')
  }
  return checkIso8601Point(v)
}

function validateJwt(value: string): Check {
  const v = value.trim()
  const parts = v.split('.')
  if (parts.length !== 3) return bad(`expected 3 dot-separated parts, found ${parts.length}`)
  const [h, p, s] = parts
  if (!h || !p) return bad('header and payload must not be empty')
  for (const [name, part] of [['header', h], ['payload', p]] as const) {
    if (!B64URL_CHARS.test(part)) return bad(`${name} is not base64url encoded`)
  }
  if (s && !B64URL_CHARS.test(s)) return bad('signature is not base64url encoded')
  let header: any
  let payload: any
  try {
    header = JSON.parse(base64UrlToText(h))
  } catch {
    return bad('header does not decode to JSON')
  }
  try {
    payload = JSON.parse(base64UrlToText(p))
  } catch {
    return bad('payload does not decode to JSON')
  }
  if (!header || typeof header !== 'object' || Array.isArray(header)) return bad('header is not a JSON object')
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return bad('payload is not a JSON object')
  const alg = header.alg
  if (typeof alg !== 'string' || !alg) return bad('header has no "alg" claim')
  if (!s && alg !== 'none') return bad(`signature is empty but "alg" is "${alg}"`)
  const notes = [`alg ${alg}`]
  // Deliberately no wall-clock comparison: this utility must be a pure function of its
  // input (the clock belongs to jwt_decode/jwt_verify), so only the claim itself is reported.
  if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
    notes.push(`expires ${new Date(payload.exp * 1000).toISOString()}`)
  }
  return ok(`well-formed JWT (${notes.join(', ')}); the signature is not verified`)
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function validateSlug(value: string): Check {
  const v = value.trim()
  const normalized = slugify(v)
  const suggestion = normalized || undefined
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) return ok('valid slug', v)
  if (/[A-Z]/.test(v)) return { ...bad('contains uppercase letters'), normalized: suggestion }
  if (/^-|-$/.test(v)) return { ...bad('starts or ends with "-"'), normalized: suggestion }
  if (/--/.test(v)) return { ...bad('contains consecutive hyphens'), normalized: suggestion }
  if (/\s/.test(v)) return { ...bad('contains whitespace'), normalized: suggestion }
  return { ...bad('contains characters outside a-z, 0-9 and "-"'), normalized: suggestion }
}

function validateHostname(value: string): Check {
  let h = value.trim()
  if (h.endsWith('.')) h = h.slice(0, -1)
  if (!h) return bad('hostname is empty')
  if (h.length > 253) return bad(`hostname is ${h.length} characters (max 253)`)
  const labels = h.split('.')
  for (const label of labels) {
    if (!label) return bad('empty label (consecutive dots)')
    if (label.length > 63) return bad(`label "${label}" exceeds 63 characters`)
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(label)) {
      return bad(`label "${label}" is not a valid RFC 1123 label`)
    }
  }
  if (/^\d+$/.test(labels[labels.length - 1])) {
    return bad('the last label must not be all-numeric (that would be ambiguous with an IP address)')
  }
  return ok(labels.length === 1 ? 'valid single-label hostname' : 'valid hostname', h.toLowerCase())
}

function validatePort(value: string): Check {
  const v = value.trim()
  if (!/^\d+$/.test(v)) return bad('not a decimal number')
  const n = Number(v)
  if (n === 0) return bad('port 0 is reserved')
  if (n > 65535) return bad(`${n} is above the maximum port 65535`)
  const range = n < 1024 ? 'well-known' : n < 49152 ? 'registered' : 'dynamic/ephemeral'
  return ok(`valid port (${range} range)`, String(n))
}

const VALIDATORS: Record<string, (value: string) => Check> = {
  email: validateEmail,
  url: validateUrl,
  uuid: validateUuid,
  ipv4: validateIpv4,
  ipv6: validateIpv6,
  semver: validateSemver,
  'credit-card': validateCreditCard,
  isbn: validateIsbn,
  mac: validateMac,
  'hex-color': validateHexColor,
  json: validateJson,
  base64: validateBase64,
  date: validateDate,
  iso8601: validateIso8601,
  domain: value => checkDomain(value.trim(), true),
  port: validatePort,
  jwt: validateJwt,
  slug: validateSlug,
  hostname: validateHostname
}

export const VALIDATION_TYPES = Object.keys(VALIDATORS)

/* ----------------------------------------------------------------- utility */

const util: Utility = {
  id: 'validate',
  name: 'validate',
  category: 'Analysis',
  description:
    'Check whether the text is a valid email, url, uuid, ipv4, ipv6, semver, credit-card, isbn, mac, hex-color, json, base64, date, iso8601, domain, port, jwt, slug or hostname, reporting why it fails and a normalized form when it passes — one line at a time with perLine.',
  accepts: 'string',
  produces: 'json',
  tags: ['input validation', 'format checker', 'sanity check', 'email validator', 'uuid validator', 'schema check'],
  examples: [
    {
      title: 'a valid email',
      input: 'user@example.com',
      params: { type: 'email' },
      output: JSON.stringify(
        { type: 'email', value: 'user@example.com', valid: true, reason: 'valid email address', normalized: 'user@example.com' },
        null,
        2
      )
    },
    {
      title: 'an invalid email',
      input: 'not-an-email',
      params: { type: 'email' },
      output: JSON.stringify({ type: 'email', value: 'not-an-email', valid: false, reason: 'missing "@"' }, null, 2)
    }
  ],
  params: {
    type: {
      kind: 'select',
      label: 'type',
      options: [
        'email', 'url', 'uuid', 'ipv4', 'ipv6', 'semver', 'credit-card', 'isbn', 'mac',
        'hex-color', 'json', 'base64', 'date', 'iso8601', 'domain', 'port', 'jwt', 'slug', 'hostname'
      ],
      default: 'email'
    },
    perLine: { kind: 'boolean', label: 'validate each line', default: false }
  },
  apply: (input: any, params: any) => {
    const type = String(params?.type ?? 'email')
    const perLine = params?.perLine === true
    const validator = VALIDATORS[type]
    if (!validator) {
      throw new Error(`unknown validation type: ${type} (expected one of ${VALIDATION_TYPES.join(', ')})`)
    }
    const text = String(input ?? '')

    if (perLine) {
      const results = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line !== '')
        .map(line => ({ value: line, ...validator(line) }))
      const validCount = results.filter(r => r.valid).length
      return {
        type,
        total: results.length,
        validCount,
        invalidCount: results.length - validCount,
        results
      }
    }

    const value = text.trim()
    if (!value) return { type, value: '', valid: false, reason: 'empty input' }
    return { type, value, ...validator(value) }
  }
}

export default util
