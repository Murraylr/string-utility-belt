import type { Utility } from '@/types/utility'

type MacInfo = {
  address: string
  bare: string
  oui: string
  nic: string
  bits: number
  isMulticast: boolean
  isLocallyAdministered: boolean
  isBroadcast: boolean
  valid: boolean
}

/** Strip every accepted separator and return the bare hex digits, or null when it is not a MAC. */
const toHexDigits = (raw: string): string | null => {
  let s = raw.trim()
  if (/^0x/i.test(s)) s = s.slice(2)
  const hex = s.replace(/[\s:.\-_]/g, '')
  if (!/^[0-9a-fA-F]+$/.test(hex)) return null
  // EUI-48 (12 digits) and EUI-64 (16 digits)
  if (hex.length !== 12 && hex.length !== 16) return null
  return hex.toLowerCase()
}

const chunk = (s: string, size: number) => {
  const out: string[] = []
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size))
  return out
}

const byteSeparator = (style: string) =>
  style === 'dash' ? '-' : style === 'dot' ? '.' : style === 'colon' ? ':' : ''

const applyCase = (s: string, caseMode: string) => (caseMode === 'upper' ? s.toUpperCase() : s.toLowerCase())

const formatHex = (hex: string, style: string, caseMode: string) => {
  // cisco groups four hex digits at a time (001a.2b3c.4d5e)
  const parts = style === 'cisco' ? chunk(hex, 4) : chunk(hex, 2)
  const sep = style === 'cisco' ? '.' : byteSeparator(style)
  return applyCase(parts.join(sep), caseMode)
}

const describeMac = (hex: string, style: string, caseMode: string): MacInfo => {
  const first = parseInt(hex.slice(0, 2), 16)
  return {
    address: formatHex(hex, style, caseMode),
    bare: applyCase(hex, caseMode),
    oui: formatHex(hex.slice(0, 6), style === 'cisco' ? 'bare' : style, caseMode),
    nic: formatHex(hex.slice(6), style === 'cisco' ? 'bare' : style, caseMode),
    bits: hex.length * 4,
    // least significant bit of the first octet: individual (0) vs group (1) address
    isMulticast: (first & 0x01) === 1,
    // second least significant bit: universally (0) vs locally (1) administered
    isLocallyAdministered: (first & 0x02) === 2,
    isBroadcast: /^f+$/.test(hex),
    valid: true
  }
}

const util: Utility = {
  id: 'mac_format',
  name: 'mac address format',
  category: 'Web & Dev',
  description:
    'Reformat MAC addresses as colon, dash, dot, bare or Cisco style in upper or lower case, with optional validation and an OUI / multicast / locally-administered breakdown.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['mac address', 'ethernet', 'oui', 'network interface', 'hardware address', 'eui-48', 'nic'],
  examples: [
    {
      title: 'reformat as dash-separated, upper case',
      input: '00:1a:2b:3c:4d:5e',
      params: { style: 'dash', case: 'upper' },
      output: '00-1A-2B-3C-4D-5E'
    },
    {
      title: 'address breakdown',
      input: '00:1a:2b:3c:4d:5e',
      params: { info: true },
      output:
        '{\n  "address": "00:1a:2b:3c:4d:5e",\n  "bare": "001a2b3c4d5e",\n  "oui": "00:1a:2b",\n  "nic": "3c:4d:5e",\n  "bits": 48,\n  "isMulticast": false,\n  "isLocallyAdministered": false,\n  "isBroadcast": false,\n  "valid": true\n}'
    }
  ],
  params: {
    style: {
      kind: 'select',
      label: 'style',
      options: ['colon', 'dash', 'dot', 'bare', 'cisco'],
      default: 'colon'
    },
    case: { kind: 'select', label: 'case', options: ['lower', 'upper'], default: 'lower' },
    perLine: { kind: 'boolean', label: 'per line', default: true },
    validate: { kind: 'boolean', label: 'validate', default: true },
    info: { kind: 'boolean', label: 'show details', default: false }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const style = params?.style || 'colon'
    const caseMode = params?.case || 'lower'
    const perLine = params?.perLine !== false
    const validate = params?.validate !== false
    const wantInfo = params?.info === true

    if (!s.trim()) return wantInfo ? {} : ''

    const lines = perLine ? s.split(/\r?\n/) : [s]

    if (wantInfo) {
      const rows: Array<MacInfo | { address: string; valid: false; reason: string }> = []
      for (const line of lines) {
        if (!line.trim()) continue
        const hex = toHexDigits(line)
        if (hex === null) {
          if (validate) throw new Error(`not a valid MAC address: ${line.trim()}`)
          rows.push({ address: line.trim(), valid: false, reason: 'not a valid MAC address' })
          continue
        }
        rows.push(describeMac(hex, style, caseMode))
      }
      if (rows.length === 0) return {}
      if (rows.length === 1) return rows[0] as unknown as Record<string, unknown>
      return rows as unknown as Record<string, unknown>
    }

    const out = lines.map((line) => {
      if (!line.trim()) return line
      const hex = toHexDigits(line)
      if (hex === null) {
        if (validate) throw new Error(`not a valid MAC address: ${line.trim()}`)
        return line
      }
      return formatHex(hex, style, caseMode)
    })
    return out.join('\n')
  }
}

export default util
