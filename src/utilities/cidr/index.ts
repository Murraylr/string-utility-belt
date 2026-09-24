import type { Utility } from '@/types/utility'

type IpVersion = 4 | 6
type Ip = { version: IpVersion; value: bigint }
type Block = { version: IpVersion; bits: number; prefix: number; value: bigint }

const V4_MAX = 0xffffffffn

const parseIPv4 = (s: string): bigint | null => {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s)
  if (!m) return null
  let v = 0n
  for (let i = 1; i <= 4; i++) {
    const part = m[i]
    // A leading zero means octal to inet_aton (010 = 8), so it is ambiguous, not decimal.
    if (part.length > 1 && part[0] === '0') return null
    const n = Number(part)
    if (n > 255) return null
    v = (v << 8n) | BigInt(n)
  }
  return v
}

const parseIPv6 = (input: string): bigint | null => {
  let s = input
  const pct = s.indexOf('%')
  if (pct >= 0) s = s.slice(0, pct)
  if (!s.includes(':')) return null
  if (!/^[0-9A-Fa-f:.]+$/.test(s)) return null

  if (s.includes('.')) {
    const cut = s.lastIndexOf(':')
    const v4 = parseIPv4(s.slice(cut + 1))
    if (v4 === null) return null
    s = `${s.slice(0, cut + 1)}${(v4 >> 16n).toString(16)}:${(v4 & 0xffffn).toString(16)}`
  }

  const halves = s.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []

  let groups: string[]
  if (halves.length === 1) {
    if (head.length !== 8) return null
    groups = head
  } else {
    if (head.length + tail.length > 7) return null
    groups = [...head, ...Array(8 - head.length - tail.length).fill('0'), ...tail]
  }

  let v = 0n
  for (const g of groups) {
    if (!/^[0-9A-Fa-f]{1,4}$/.test(g)) return null
    v = (v << 16n) | BigInt(parseInt(g, 16))
  }
  return v
}

const parseAddress = (s: string): Ip => {
  const v4 = parseIPv4(s)
  if (v4 !== null) return { version: 4, value: v4 }
  const v6 = parseIPv6(s)
  if (v6 !== null) return { version: 6, value: v6 }
  throw new Error(`not a valid IP address: ${s}`)
}

const formatIPv4 = (v: bigint) =>
  [24n, 16n, 8n, 0n].map((sh) => ((v >> sh) & 0xffn).toString()).join('.')

const groupsOf = (v: bigint) => {
  const out: number[] = []
  for (let i = 7; i >= 0; i--) out.push(Number((v >> BigInt(i * 16)) & 0xffffn))
  return out
}

/**
 * RFC 5952 canonical form: longest zero run collapsed, IPv4-mapped shown in mixed notation.
 * `mixed` is turned off for masks — a /80 wildcard is not the address ::ffff:255.255.255.255.
 */
const compressIPv6 = (v: bigint, mixed = true) => {
  if (mixed && v >> 32n === 0xffffn) return `::ffff:${formatIPv4(v & V4_MAX)}`
  const g = groupsOf(v)
  let bestStart = -1
  let bestLen = 0
  let curStart = -1
  let curLen = 0
  for (let i = 0; i < 8; i++) {
    if (g[i] === 0) {
      if (curStart < 0) {
        curStart = i
        curLen = 0
      }
      curLen++
      if (curLen > bestLen) {
        bestLen = curLen
        bestStart = curStart
      }
    } else {
      curStart = -1
      curLen = 0
    }
  }
  const parts = g.map((x) => x.toString(16))
  if (bestLen < 2) return parts.join(':')
  return `${parts.slice(0, bestStart).join(':')}::${parts.slice(bestStart + bestLen).join(':')}`
}

const fmt = (v: bigint, version: IpVersion) => (version === 4 ? formatIPv4(v) : compressIPv6(v))
/** Masks are bit patterns, not addresses, so they never take the IPv4-mapped mixed form. */
const fmtMask = (v: bigint, version: IpVersion) =>
  version === 4 ? formatIPv4(v) : compressIPv6(v, false)

const maskFor = (prefix: number, bits: number) =>
  prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(bits - prefix)

/** Parse `addr/prefix`; a bare address is treated as a single-host block. */
const parseBlock = (raw: string, what = 'CIDR'): Block => {
  const s = raw.trim()
  if (!s) throw new Error(`${what} is empty`)
  const slash = s.indexOf('/')
  const addrText = (slash < 0 ? s : s.slice(0, slash)).trim()
  const ip = parseAddress(addrText)
  const bits = ip.version === 4 ? 32 : 128
  let prefix = bits
  if (slash >= 0) {
    const rest = s.slice(slash + 1).trim()
    if (!/^\d{1,3}$/.test(rest)) throw new Error(`invalid prefix length: /${rest}`)
    prefix = Number(rest)
    if (prefix > bits) throw new Error(`prefix /${prefix} is out of range for IPv${ip.version} (0-${bits})`)
  }
  return { version: ip.version, bits, prefix, value: ip.value }
}

const networkOf = (b: Block) => b.value & maskFor(b.prefix, b.bits)
const broadcastOf = (b: Block) => networkOf(b) | (((1n << BigInt(b.bits)) - 1n) ^ maskFor(b.prefix, b.bits))

/**
 * IANA special-purpose ranges: everything that is not globally routable. Matches the
 * reference list Python's `ipaddress.is_private` uses, plus RFC 6598 shared (CGNAT)
 * space. Multicast is deliberately absent — it is routable, just not unicast.
 */
const PRIVATE_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // this network
  ['10.0.0.0', 8], // RFC 1918
  ['100.64.0.0', 10], // RFC 6598 shared address space (CGNAT)
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local
  ['172.16.0.0', 12], // RFC 1918
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.0.2.0', 24], // TEST-NET-1
  ['192.168.0.0', 16], // RFC 1918
  ['198.18.0.0', 15], // benchmarking
  ['198.51.100.0', 24], // TEST-NET-2
  ['203.0.113.0', 24], // TEST-NET-3
  ['240.0.0.0', 4] // reserved, incl. 255.255.255.255
]
const PRIVATE_V6: Array<[string, number]> = [
  ['::', 128], // unspecified
  ['::1', 128], // loopback
  ['::ffff:0:0', 96], // IPv4-mapped
  ['64:ff9b:1::', 48], // local-use NAT64
  ['100::', 64], // discard-only
  ['2001::', 23], // IETF protocol assignments
  ['2001:db8::', 32], // documentation
  ['fc00::', 7], // unique local
  ['fe80::', 10] // link-local
]

/** True when the whole block sits inside a special-use / non-globally-routable range. */
const isPrivateBlock = (network: bigint, broadcast: bigint, version: IpVersion) => {
  const bits = version === 4 ? 32 : 128
  const ranges = version === 4 ? PRIVATE_V4 : PRIVATE_V6
  return ranges.some(([addr, prefix]) => {
    const mask = maskFor(prefix, bits)
    const start = parseAddress(addr).value & mask
    const end = start | (((1n << BigInt(bits)) - 1n) ^ mask)
    return network >= start && broadcast <= end
  })
}

/** JSON-safe count: a number while exact, a decimal string once it exceeds 2^53 - 1 (IPv6). */
const count = (n: bigint): number | string =>
  n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n.toString()

/** Hard ceiling so a huge `limit` cannot lock the UI thread up enumerating a /8. */
const MAX_ROWS = 100000

const readLimit = (raw: unknown) => {
  const n = Number(raw)
  const limit = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1024
  return Math.min(limit, MAX_ROWS)
}

const info = (b: Block) => {
  const network = networkOf(b)
  const broadcast = broadcastOf(b)
  const total = 1n << BigInt(b.bits - b.prefix)
  let firstHost = network
  let lastHost = broadcast
  let usable = total
  if (b.version === 4) {
    if (b.prefix <= 30) {
      firstHost = network + 1n
      lastHost = broadcast - 1n
      usable = total - 2n
    } else {
      // /31 is a point-to-point link (RFC 3021), /32 a single host
      usable = total
    }
  }
  return {
    network: fmt(network, b.version),
    broadcast: fmt(broadcast, b.version),
    firstHost: fmt(firstHost, b.version),
    lastHost: fmt(lastHost, b.version),
    netmask: fmtMask(maskFor(b.prefix, b.bits), b.version),
    wildcard: fmtMask(((1n << BigInt(b.bits)) - 1n) ^ maskFor(b.prefix, b.bits), b.version),
    prefix: b.prefix,
    totalHosts: count(total),
    usableHosts: count(usable),
    isPrivate: isPrivateBlock(network, broadcast, b.version),
    version: b.version
  }
}

const expand = (b: Block, limit: number) => {
  const network = networkOf(b)
  const total = 1n << BigInt(b.bits - b.prefix)
  const shown = total > BigInt(limit) ? BigInt(limit) : total
  const lines: string[] = []
  for (let i = 0n; i < shown; i++) lines.push(fmt(network + i, b.version))
  if (shown < total) lines.push(`... ${total - shown} more (raise limit)`)
  return lines.join('\n')
}

const split = (b: Block, newPrefix: number, limit: number) => {
  if (!Number.isInteger(newPrefix) || newPrefix <= 0) {
    throw new Error('set newPrefix to the prefix length to split into')
  }
  if (newPrefix > b.bits) {
    throw new Error(`newPrefix /${newPrefix} is out of range for IPv${b.version} (0-${b.bits})`)
  }
  if (newPrefix <= b.prefix) {
    throw new Error(`newPrefix /${newPrefix} must be longer than the block prefix /${b.prefix}`)
  }
  const network = networkOf(b)
  const step = 1n << BigInt(b.bits - newPrefix)
  const total = 1n << BigInt(newPrefix - b.prefix)
  const shown = total > BigInt(limit) ? BigInt(limit) : total
  const lines: string[] = []
  for (let i = 0n; i < shown; i++) lines.push(`${fmt(network + i * step, b.version)}/${newPrefix}`)
  if (shown < total) lines.push(`... ${total - shown} more (raise limit)`)
  return lines.join('\n')
}

const contains = (b: Block, addressText: string) => {
  const target = String(addressText ?? '').trim()
  if (!target) throw new Error('set the address param to the address or block to test')
  const other = parseBlock(target, 'address')
  const network = networkOf(b)
  const broadcast = broadcastOf(b)
  const oStart = networkOf(other)
  const oEnd = broadcastOf(other)
  const inside = other.version === b.version && oStart >= network && oEnd <= broadcast
  return {
    cidr: `${fmt(network, b.version)}/${b.prefix}`,
    address: other.prefix === other.bits ? fmt(oStart, other.version) : `${fmt(oStart, other.version)}/${other.prefix}`,
    contains: inside,
    version: b.version
  }
}

const util: Utility = {
  id: 'cidr',
  name: 'cidr tools',
  category: 'Web & Dev',
  description:
    'Inspect an IPv4 or IPv6 CIDR block: network info, list every address, test whether an address is inside it, or split it into smaller subnets.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['ip', 'network', 'subnet', 'netmask', 'ipv4', 'ipv6', 'cidr block', 'vlsm', 'subnetting'],
  aliases: ['ipcalc'],
  examples: [
    {
      title: 'network info',
      input: '192.168.1.0/24',
      params: { mode: 'info' },
      output:
        '{\n  "network": "192.168.1.0",\n  "broadcast": "192.168.1.255",\n  "firstHost": "192.168.1.1",\n  "lastHost": "192.168.1.254",\n  "netmask": "255.255.255.0",\n  "wildcard": "0.0.0.255",\n  "prefix": 24,\n  "totalHosts": 256,\n  "usableHosts": 254,\n  "isPrivate": true,\n  "version": 4\n}'
    },
    {
      title: 'expand every address',
      input: '10.0.0.0/30',
      params: { mode: 'expand', limit: 8 },
      output: '10.0.0.0\n10.0.0.1\n10.0.0.2\n10.0.0.3'
    },
    {
      title: 'is an address inside the block?',
      input: '10.0.0.0/24',
      params: { mode: 'contains', address: '10.0.0.5' },
      output: '{\n  "cidr": "10.0.0.0/24",\n  "address": "10.0.0.5",\n  "contains": true,\n  "version": 4\n}'
    }
  ],
  params: {
    mode: { kind: 'select', label: 'mode', options: ['info', 'expand', 'contains', 'split'], default: 'info' },
    address: { kind: 'string', label: 'address (contains)', default: '', placeholder: '10.1.2.3' },
    newPrefix: { kind: 'number', label: 'new prefix (split)', default: 0, min: 0, integer: true, max: 128 },
    limit: { kind: 'number', label: 'max rows', default: 1024, min: 1, max: 100000, integer: true }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '').trim()
    const mode = params?.mode || 'info'
    const limit = readLimit(params?.limit ?? 1024)
    if (!s) return mode === 'expand' || mode === 'split' ? '' : {}
    const block = parseBlock(s)
    switch (mode) {
      case 'expand':
        return expand(block, limit)
      case 'contains':
        return contains(block, params?.address ?? '')
      case 'split':
        return split(block, Math.floor(Number(params?.newPrefix ?? 0)), limit)
      case 'info':
      default:
        return info(block)
    }
  }
}

export default util
