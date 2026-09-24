import type { Utility } from '@/types/utility'

type IpVersion = 4 | 6
type Ip = { version: IpVersion; value: bigint }

const V4_MAX = 0xffffffffn
const V6_MAX = (1n << 128n) - 1n

/** Parse dotted-quad IPv4 into a 32-bit big integer. Returns null when it is not IPv4. */
export const parseIPv4 = (s: string): bigint | null => {
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

/** Parse any RFC 4291 IPv6 form (`::`, embedded IPv4, zone id) into a 128-bit big integer. */
export const parseIPv6 = (input: string): bigint | null => {
  let s = input
  const pct = s.indexOf('%')
  if (pct >= 0) s = s.slice(0, pct) // drop the zone id (fe80::1%eth0)
  if (!s.includes(':')) return null
  if (!/^[0-9A-Fa-f:.]+$/.test(s)) return null

  // Rewrite a trailing dotted quad as two hex groups.
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
    // `::` must stand in for at least one omitted group
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

export const parseAddress = (s: string): Ip => {
  const v4 = parseIPv4(s)
  if (v4 !== null) return { version: 4, value: v4 }
  const v6 = parseIPv6(s)
  if (v6 !== null) return { version: 6, value: v6 }
  throw new Error(`not a valid IP address: ${s}`)
}

/**
 * Decimal, 0x-hex or 0b-binary integer. `_` may separate digit runs (JS style) and `,`
 * may group decimal thousands — but only in those shapes, so `1,2,3,4` stays invalid
 * instead of silently reading as 1234.
 */
export const parseInteger = (s: string): bigint | null => {
  const t = s.trim()
  if (/^\d{1,3}(,\d{3})+$/.test(t)) return BigInt(t.replace(/,/g, ''))
  const ok =
    /^0[xX][0-9a-fA-F]+(_[0-9a-fA-F]+)*$/.test(t) ||
    /^0[bB][01]+(_[01]+)*$/.test(t) ||
    /^\d+(_\d+)*$/.test(t)
  if (!ok) return null
  try {
    return BigInt(t.replace(/_/g, ''))
  } catch {
    return null
  }
}

export const formatIPv4 = (v: bigint) =>
  [24n, 16n, 8n, 0n].map((sh) => ((v >> sh) & 0xffn).toString()).join('.')

const groupsOf = (v: bigint) => {
  const out: number[] = []
  for (let i = 7; i >= 0; i--) out.push(Number((v >> BigInt(i * 16)) & 0xffffn))
  return out
}

export const expandIPv6 = (v: bigint) =>
  groupsOf(v)
    .map((g) => g.toString(16).padStart(4, '0'))
    .join(':')

/** RFC 5952 canonical form: longest zero run collapsed, IPv4-mapped shown in mixed notation. */
export const compressIPv6 = (v: bigint) => {
  if (v >> 32n === 0xffffn) return `::ffff:${formatIPv4(v & V4_MAX)}`
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

const toAddress = (n: bigint): string => {
  if (n < 0n) throw new Error(`negative value is not an IP address: ${n}`)
  if (n <= V4_MAX) return formatIPv4(n)
  if (n <= V6_MAX) return compressIPv6(n)
  throw new Error('integer is too large for an IPv6 address (max 2^128 - 1)')
}

/** Accept either a textual address or a bare integer. */
const resolve = (s: string): Ip => {
  const n = parseInteger(s)
  if (n !== null) {
    if (n < 0n || n > V6_MAX) throw new Error(`integer out of range for an IP address: ${s}`)
    return n <= V4_MAX ? { version: 4, value: n } : { version: 6, value: n }
  }
  return parseAddress(s)
}

const requireV6 = (s: string, mode: string): bigint => {
  const ip = parseAddress(s)
  if (ip.version !== 6) throw new Error(`${mode} expects an IPv6 address: ${s}`)
  return ip.value
}

const toBinary = (ip: Ip) =>
  ip.version === 4
    ? [24n, 16n, 8n, 0n].map((sh) => ((ip.value >> sh) & 0xffn).toString(2).padStart(8, '0')).join('.')
    : groupsOf(ip.value)
        .map((g) => g.toString(2).padStart(16, '0'))
        .join(':')

const toHex = (ip: Ip) =>
  `0x${ip.value.toString(16).padStart(ip.version === 4 ? 8 : 32, '0')}`

const convertOne = (raw: string, mode: string): string => {
  const s = raw.trim()
  switch (mode) {
    case 'to-integer':
      return parseAddress(s).value.toString()
    case 'to-address': {
      const n = parseInteger(s)
      if (n === null) throw new Error(`not an integer: ${s}`)
      return toAddress(n)
    }
    case 'ipv6-expand':
      return expandIPv6(requireV6(s, 'ipv6-expand'))
    case 'ipv6-compress':
      return compressIPv6(requireV6(s, 'ipv6-compress'))
    case 'to-binary':
      return toBinary(resolve(s))
    case 'to-hex':
      return toHex(resolve(s))
    case 'ipv4-to-ipv6': {
      const ip = resolve(s)
      if (ip.version !== 4) throw new Error(`ipv4-to-ipv6 expects an IPv4 address: ${s}`)
      return `::ffff:${formatIPv4(ip.value)}`
    }
    case 'auto':
    default: {
      const n = parseInteger(s)
      if (n !== null) return toAddress(n)
      const ip = parseAddress(s)
      if (ip.version === 4) return ip.value.toString()
      const full = expandIPv6(ip.value)
      // already fully expanded -> compress it, otherwise expand it
      return full === s.toLowerCase() ? compressIPv6(ip.value) : full
    }
  }
}

const util: Utility = {
  id: 'ip_convert',
  name: 'ip convert',
  category: 'Web & Dev',
  description:
    'Convert IP addresses between dotted/hex/binary/integer forms, expand or compress IPv6, and map IPv4 into IPv6.',
  accepts: 'string',
  produces: 'string',
  tags: ['ip address', 'ipv4', 'ipv6', 'integer', 'hex', 'binary', 'convert', 'dword', 'dotted decimal'],
  examples: [
    {
      title: 'address to integer',
      input: '192.168.1.1',
      params: { mode: 'to-integer' },
      output: '3232235777'
    },
    {
      title: 'integer to address',
      input: '3232235777',
      params: { mode: 'to-address' },
      output: '192.168.1.1'
    },
    {
      title: 'compress IPv6',
      input: '2001:0db8:0000:0000:0000:0000:0000:0001',
      params: { mode: 'ipv6-compress' },
      output: '2001:db8::1'
    }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: [
        'auto',
        'to-integer',
        'to-address',
        'ipv6-expand',
        'ipv6-compress',
        'to-binary',
        'to-hex',
        'ipv4-to-ipv6'
      ],
      default: 'auto'
    },
    perLine: { kind: 'boolean', label: 'per line', default: true }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    if (!s.trim()) return ''
    const mode = params?.mode || 'auto'
    const perLine = params?.perLine !== false
    if (!perLine) return convertOne(s, mode)
    return s
      .split(/\r?\n/)
      .map((line) => (line.trim() ? convertOne(line, mode) : line))
      .join('\n')
  }
}

export default util
