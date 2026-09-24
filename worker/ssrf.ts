/**
 * Target validation for the `/api/fetch` proxy.
 *
 * A Cloudflare Worker cannot reach the network it happens to run next to (there is
 * no RFC 1918 space behind `fetch()`), so these checks are not what keeps an
 * internal network safe. They exist so the proxy never becomes an SSRF oracle:
 * something that will politely probe loopback, link-local metadata endpoints or
 * private ranges on an attacker's behalf and report what answered.
 *
 * Every check runs on the hostname AFTER `new URL()` has normalised it, so the
 * WHATWG parser has already turned `2130706433`, `0x7f.1`, `017700000001` and
 * `127.1` into `127.0.0.1`, percent-decoded and IDNA-mapped names, and compressed
 * IPv6 literals. The IPv4 parser below still accepts every inet_aton spelling, so a
 * runtime whose URL parser were less thorough would not open a bypass.
 *
 * Residual risk: only literal IPs and names can be judged. A public name that
 * resolves to a private address (including DNS rebinding between a check and the
 * connection) is not caught here; the platform's lack of private-network egress is
 * the backstop for that.
 */

export type TargetCheck =
  | { ok: true; url: URL }
  | { ok: false; status: 400 | 403; error: string }

const MAX_URL_LENGTH = 4096

/**
 * Explicit ports a target may use: the HTTP and HTTPS ports Cloudflare proxies. Any
 * other port is refused so the proxy cannot be turned on third-party hosts as a port
 * scanner (connect vs. refuse vs. time out would otherwise leak what listens where).
 */
const WEB_PORTS = new Set([80, 443, 8080, 8443, 8880, 2052, 2053, 2082, 2083, 2086, 2087, 2095, 2096])

/** Suffixes that never name a public host (RFC 6761/6762/8375 and common LAN conventions). */
const BLOCKED_SUFFIXES = [
  'localhost', 'local', 'internal', 'home.arpa', 'arpa', 'localdomain', 'lan', 'intranet', 'corp',
  'test', 'invalid', 'onion',
]

/** Well-known names that resolve to loopback or cloud metadata for everyone. */
const BLOCKED_NAMES = [
  'metadata.google.internal', 'metadata.goog', 'metadata.azure.com',
  'localtest.me', 'lvh.me', 'vcap.me', 'nip.io', 'sslip.io', 'xip.io',
]

// ---------------------------------------------------------------------------
// IPv4
// ---------------------------------------------------------------------------

/**
 * inet_aton-style parse: 1–4 dot-separated parts, each decimal, octal (leading 0) or
 * hex (0x), the last part filling the remaining bytes. Returns the address as an
 * unsigned 32-bit number, or null when `host` is not an IPv4 literal.
 */
export function parseIPv4(host: string): number | null {
  const parts = host.split('.')
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  if (parts.length === 0 || parts.length > 4) return null
  const nums: number[] = []
  for (const p of parts) {
    let n: number
    if (/^0x[0-9a-f]*$/i.test(p)) n = p.length === 2 ? 0 : parseInt(p.slice(2), 16)
    else if (/^0[0-7]+$/.test(p)) n = parseInt(p, 8)
    else if (/^(0|[1-9][0-9]*)$/.test(p)) n = parseInt(p, 10)
    else return null
    if (!Number.isFinite(n)) return null
    nums.push(n)
  }
  const last = nums.pop() as number
  if (nums.some(n => n > 255)) return null
  if (last >= 256 ** (4 - nums.length)) return null
  return nums.reduce((acc, n, i) => acc + n * 256 ** (3 - i), last)
}

const v4 = (dotted: string) => parseIPv4(dotted) as number

/** [network, prefix length, reason]; the first match wins, so specific entries come first. */
const V4_BLOCKS: Array<[number, number, string]> = ([
  ['169.254.169.254', 32, 'cloud metadata endpoint'],
  ['100.100.100.200', 32, 'cloud metadata endpoint'],
  ['168.63.129.16', 32, 'cloud metadata endpoint'],
  ['192.0.0.192', 32, 'cloud metadata endpoint'],
  ['255.255.255.255', 32, 'broadcast address'],
  ['0.0.0.0', 8, 'unspecified / "this network" address'],
  ['10.0.0.0', 8, 'private address'],
  ['100.64.0.0', 10, 'carrier-grade NAT address'],
  ['127.0.0.0', 8, 'loopback address'],
  ['169.254.0.0', 16, 'link-local address'],
  ['172.16.0.0', 12, 'private address'],
  ['192.0.0.0', 24, 'IETF protocol assignment'],
  ['192.0.2.0', 24, 'documentation address'],
  ['192.88.99.0', 24, '6to4 relay anycast address'],
  ['192.168.0.0', 16, 'private address'],
  ['198.18.0.0', 15, 'benchmarking address'],
  ['198.51.100.0', 24, 'documentation address'],
  ['203.0.113.0', 24, 'documentation address'],
  ['224.0.0.0', 4, 'multicast address'],
  ['240.0.0.0', 4, 'reserved address'],
] as const).map(([net, bits, why]) => [v4(net), bits, why])

const inV4 = (ip: number, net: number, bits: number) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0
  return ((ip & mask) >>> 0) === ((net & mask) >>> 0)
}

/** Why an IPv4 address may not be fetched, or null for a public unicast address. */
export function classifyIPv4(ip: number): string | null {
  for (const [net, bits, why] of V4_BLOCKS) if (inV4(ip, net, bits)) return why
  return null
}

// ---------------------------------------------------------------------------
// IPv6
// ---------------------------------------------------------------------------

/** Eight 16-bit words, or null. Accepts `::` compression and a trailing dotted IPv4. Zone ids are refused. */
export function parseIPv6(input: string): number[] | null {
  const s = input.toLowerCase()
  if (!s || s.includes('%') || !/^[0-9a-f:.]+$/.test(s)) return null
  const dbl = s.indexOf('::')
  if (dbl !== s.lastIndexOf('::')) return null
  const split = (part: string) => (part === '' ? [] : part.split(':'))
  const head = dbl >= 0 ? split(s.slice(0, dbl)) : split(s)
  const tail = dbl >= 0 ? split(s.slice(dbl + 2)) : []

  const words = (groups: string[], allowV4Last: boolean): number[] | null => {
    const out: number[] = []
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]
      if (allowV4Last && i === groups.length - 1 && g.includes('.')) {
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(g)) return null
        const octets = g.split('.').map(Number)
        if (octets.some(o => o > 255)) return null
        out.push((octets[0] << 8) | octets[1], (octets[2] << 8) | octets[3])
        continue
      }
      if (!/^[0-9a-f]{1,4}$/.test(g)) return null
      out.push(parseInt(g, 16))
    }
    return out
  }

  const h = words(head, dbl < 0)
  const t = words(tail, true)
  if (!h || !t) return null
  if (dbl < 0) return h.length === 8 ? h : null
  const fill = 8 - h.length - t.length
  if (fill < 1) return null
  return [...h, ...new Array(fill).fill(0), ...t]
}

/** Does the address fall in `prefix/bits` (prefix given as words)? */
function inV6(w: number[], prefix: number[], bits: number): boolean {
  for (let i = 0; i < 8 && bits > 0; i++, bits -= 16) {
    const take = Math.min(16, bits)
    const mask = (0xffff << (16 - take)) & 0xffff
    if ((w[i] & mask) !== ((prefix[i] ?? 0) & mask)) return false
  }
  return true
}

const embedded = (hi: number, lo: number) => ((hi << 16) >>> 0) + lo

const V6_BLOCKS: Array<[number[], number, string]> = [
  [[0x64, 0xff9b, 0x1], 48, 'local-use NAT64 address'],
  [[0x2001], 23, 'IETF protocol assignment (Teredo, benchmarking, ORCHID…)'],
  [[0x2001, 0xdb8], 32, 'documentation address'],
  [[0x3fff], 20, 'documentation address'],
]

const V6_OUTSIDE_GLOBAL: Array<[number[], number, string]> = [
  [[0xfc00], 7, 'unique-local address'],
  [[0xfe80], 10, 'link-local address'],
  [[0xfec0], 10, 'site-local address'],
  [[0xff00], 8, 'multicast address'],
  [[0x100], 64, 'discard-only address'],
]

/** Why an IPv6 address may not be fetched, or null for a public global-unicast address. */
export function classifyIPv6(w: number[]): string | null {
  const zeros = (from: number, to: number) => w.slice(from, to).every(x => x === 0)
  if (zeros(0, 8)) return 'unspecified address'
  if (zeros(0, 7) && w[7] === 1) return 'loopback address'
  // ::ffff:a.b.c.d (IPv4-mapped) and ::a.b.c.d (IPv4-compatible, deprecated)
  if (zeros(0, 5) && (w[5] === 0xffff || w[5] === 0)) {
    const inner = classifyIPv4(embedded(w[6], w[7]))
    if (inner) return `IPv4-${w[5] ? 'mapped' : 'compatible'} ${inner}`
    return w[5] ? null : 'deprecated IPv4-compatible address'
  }
  // NAT64 well-known prefix 64:ff9b::/96
  if (inV6(w, [0x64, 0xff9b], 96)) {
    const inner = classifyIPv4(embedded(w[6], w[7]))
    return inner ? `NAT64-embedded ${inner}` : null
  }
  // 6to4 2002:AABB:CCDD::/48 carries AA.BB.CC.DD
  if (w[0] === 0x2002) {
    const inner = classifyIPv4(embedded(w[1], w[2]))
    return inner ? `6to4-embedded ${inner}` : null
  }
  for (const [p, bits, why] of V6_BLOCKS) if (inV6(w, p, bits)) return why
  // everything outside 2000::/3 (global unicast) is special-purpose or unallocated
  if (!inV6(w, [0x2000], 3)) {
    for (const [p, bits, why] of V6_OUTSIDE_GLOBAL) if (inV6(w, p, bits)) return why
    return 'reserved address'
  }
  return null
}

// ---------------------------------------------------------------------------
// Hostnames and URLs
// ---------------------------------------------------------------------------

const matchesSuffix = (host: string, suffix: string) => host === suffix || host.endsWith(`.${suffix}`)

const NUMERIC_LABEL = /^(0x[0-9a-f]*|\d+)$/i
/** a-b-c-d anywhere in the name, not glued to other digits; overlapping runs are all tried */
const DASHED_V4 = /(?<![0-9])(?=(\d{1,3})-(\d{1,3})-(\d{1,3})-(\d{1,3})(?![0-9]))/g

/**
 * Why a hostname that spells out a non-public IPv4 address (`127.0.0.1.traefik.me`,
 * `10-0-0-1.example.org`) may not be fetched. nip.io and its many clones resolve such
 * names to the address they spell, so no list of service names can be complete.
 */
function embeddedIPv4(host: string): string | null {
  const labels = host.split('.')
  for (let i = 0; i + 4 <= labels.length; i++) {
    const quad = labels.slice(i, i + 4)
    if (!quad.every(l => NUMERIC_LABEL.test(l))) continue
    const ip = parseIPv4(quad.join('.'))
    const why = ip === null ? null : classifyIPv4(ip)
    if (why) return why
  }
  for (const m of host.matchAll(DASHED_V4)) {
    const parts = m.slice(1, 5).map(Number)
    if (parts.some(n => n > 255)) continue
    const why = classifyIPv4(parts.reduce((acc, n) => acc * 256 + n, 0))
    if (why) return why
  }
  return null
}

/**
 * Why `hostname` (as `URL.hostname` reports it) may not be fetched, or null when it
 * may. IPv6 literals arrive bracketed; trailing dots are ignored.
 */
export function classifyHost(hostname: string): string | null {
  let host = hostname.toLowerCase()
  if (host.startsWith('[') && host.endsWith(']')) {
    const words = parseIPv6(host.slice(1, -1))
    return words ? classifyIPv6(words) : 'unparseable IPv6 address'
  }
  host = host.replace(/\.+$/, '')
  if (!host) return 'empty hostname'
  if (host.includes(':')) {
    const words = parseIPv6(host)
    return words ? classifyIPv6(words) : 'unparseable hostname'
  }
  const ip = parseIPv4(host)
  if (ip !== null) return classifyIPv4(ip)
  // WHATWG treats a host ending in a numeric label as IPv4; one that failed to parse as
  // such is not a name either (no TLD is numeric), and some resolvers would misread it
  if (/^(0x[0-9a-f]*|[0-9]+)$/i.test(host.slice(host.lastIndexOf('.') + 1))) return 'malformed IPv4 address'
  if (!host.includes('.')) return 'single-label hostname'
  if (BLOCKED_SUFFIXES.some(s => matchesSuffix(host, s))) return 'local or reserved hostname'
  if (BLOCKED_NAMES.some(n => matchesSuffix(host, n))) return 'hostname that resolves to a local or metadata address'
  const embedded = embeddedIPv4(host)
  if (embedded) return `hostname that spells out a ${embedded}`
  return null
}

export interface CheckOptions {
  /** This deployment's own host: fetching ourselves through ourselves is refused. */
  selfHost?: string
}

/** Parse and vet a URL the proxy was asked to fetch (or was redirected to). */
export function checkTarget(raw: string | URL, opts: CheckOptions = {}): TargetCheck {
  if (typeof raw === 'string' && (!raw.trim() || raw.length > MAX_URL_LENGTH)) {
    return { ok: false, status: 400, error: raw.trim() ? 'the URL is too long' : 'a url parameter is required' }
  }
  let url: URL
  try { url = new URL(String(raw)) } catch { return { ok: false, status: 400, error: 'that is not a valid URL' } }
  if (url.href.length > MAX_URL_LENGTH) return { ok: false, status: 400, error: 'the URL is too long' }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, status: 400, error: 'only http and https URLs can be fetched' }
  }
  if (url.username || url.password) {
    return { ok: false, status: 400, error: 'URLs with credentials cannot be fetched' }
  }
  const why = classifyHost(url.hostname)
  if (why) return { ok: false, status: 403, error: `blocked host: ${why}` }
  if (url.port && !WEB_PORTS.has(Number(url.port))) {
    return { ok: false, status: 403, error: `blocked port: ${url.port} is not a standard web port` }
  }
  if (opts.selfHost && url.hostname.replace(/\.+$/, '') === opts.selfHost.toLowerCase()) {
    return { ok: false, status: 403, error: 'blocked host: this site cannot fetch itself' }
  }
  return { ok: true, url }
}
