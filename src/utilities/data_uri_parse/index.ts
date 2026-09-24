import type { Utility, Value } from '@/types/utility'

const OUTPUTS = ['json', 'text', 'bytes']

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

/** Tolerates whitespace, the url-safe alphabet and missing padding. */
function base64ToBytes(raw: string): Uint8Array {
  const clean = raw.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  if (!clean) return new Uint8Array(0)
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error('data uri payload is not valid base64')
  }
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

function percentDecodeToBytes(raw: string): Uint8Array {
  const out: number[] = []
  const enc = new TextEncoder()
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === '%') {
      const hex = raw.slice(i + 1, i + 3)
      if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
        throw new Error(`invalid percent-escape "%${hex}" in data uri payload`)
      }
      out.push(parseInt(hex, 16))
      i += 2
      continue
    }
    // literal characters are rare but legal here; keep astral ones whole
    const cp = raw.codePointAt(i) as number
    if (cp > 0xffff) i++
    if (cp < 0x80) out.push(cp)
    else for (const b of enc.encode(String.fromCodePoint(cp))) out.push(b)
  }
  return new Uint8Array(out)
}

function decodeText(bytes: Uint8Array, label: string, fatal: boolean): string | null {
  const tryWith = (l: string) => {
    try {
      return new TextDecoder(l, { fatal }).decode(bytes)
    } catch {
      return null
    }
  }
  if (label) {
    const viaLabel = tryWith(label)
    if (viaLabel !== null) return viaLabel
  }
  return tryWith('utf-8')
}

/** C0 controls other than tab/lf/cr/ff (and DEL) mean this is not really text. */
function looksBinary(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 0x7f) return true
    if (c < 0x20 && c !== 9 && c !== 10 && c !== 12 && c !== 13) return true
  }
  return false
}

const util: Utility = {
  id: 'data_uri_parse',
  name: 'data uri parse',
  category: 'Decoding',
  description:
    'Parse a data: URI into its mime type, charset, encoding flag, payload and byte size, or return the decoded payload directly as text or bytes.',
  accepts: 'string',
  produces: ['json', 'string', 'bytes'],
  params: {
    output: { kind: 'select', label: 'output', options: OUTPUTS, default: 'json' }
  },
  tags: ['data uri', 'data url', 'mime', 'base64', 'parse', 'decode', 'inline image'],
  examples: [
    {
      title: 'text data URI',
      input: 'data:text/plain;charset=utf-8,Hello%20World',
      output: '{\n  "mime": "text/plain",\n  "charset": "utf-8",\n  "base64": false,\n  "data": "Hello World",\n  "size": 11\n}'
    },
    {
      title: 'base64 payload as text',
      input: 'data:text/plain;base64,SGVsbG8=',
      params: { output: 'text' },
      output: 'Hello'
    }
  ],
  apply: (input: any, params: any): Value => {
    const output = String(params?.output || 'json')
    if (!OUTPUTS.includes(output)) throw new Error(`unknown output: ${output}`)

    const s = String(input ?? '').trim()
    if (!s) {
      if (output === 'bytes') return new Uint8Array(0)
      return output === 'text' ? '' : {}
    }

    const match = /^data:([^,]*),([\s\S]*)$/i.exec(s)
    if (!match) throw new Error('not a data uri: expected "data:[<mime>][;charset=...][;base64],<data>"')

    const [, header, payload] = match
    const tokens = header.split(';')
    const mime = tokens[0].trim().toLowerCase() || 'text/plain'
    let isBase64 = false
    let charset = ''
    for (const token of tokens.slice(1)) {
      const t = token.trim()
      if (!t) continue
      if (t.toLowerCase() === 'base64') {
        isBase64 = true
        continue
      }
      const eq = t.indexOf('=')
      if (eq < 0) continue
      const key = t.slice(0, eq).trim().toLowerCase()
      const value = t.slice(eq + 1).trim().replace(/^"|"$/g, '')
      if (key === 'charset') charset = value.toLowerCase()
    }

    const bytes = isBase64 ? base64ToBytes(payload) : percentDecodeToBytes(payload)

    if (output === 'bytes') return bytes
    if (output === 'text') return decodeText(bytes, charset, false) ?? ''

    const strict = decodeText(bytes, charset, true)
    return {
      mime,
      charset,
      base64: isBase64,
      // non-text payloads (images, fonts, …) are reported as base64
      data: strict !== null && !looksBinary(strict) ? strict : bytesToBase64(bytes),
      size: bytes.length
    }
  }
}

export default util
