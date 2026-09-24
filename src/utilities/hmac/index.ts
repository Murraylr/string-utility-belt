import type { Utility } from '@/types/utility'
import { bytesToHex, isBytes, textToUint8Array } from '../helpers'

const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'] as const
const KEY_FORMATS = ['text', 'hex', 'base64'] as const
const OUTPUTS = ['hex', 'base64', 'base64url'] as const

type Algorithm = (typeof ALGORITHMS)[number]
type KeyFormat = (typeof KEY_FORMATS)[number]
type Output = (typeof OUTPUTS)[number]

/** Resolve a select param case-insensitively, falling back to the default when unset. */
const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T, label: string): T => {
  if (value === undefined || value === null || value === '') return fallback
  const wanted = String(value).trim()
  const found = options.find((o) => o.toLowerCase() === wanted.toLowerCase())
  if (!found) throw new Error(`unsupported hmac ${label}: ${wanted}`)
  return found
}

const toBytes = (value: unknown): Uint8Array =>
  isBytes(value) ? value : textToUint8Array(value === null || value === undefined ? '' : String(value))

const binaryString = (bytes: Uint8Array): string => {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return bin
}

const bytesToBase64 = (bytes: Uint8Array): string => btoa(binaryString(bytes))

const bytesToBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/(?<!=)=+$/, '')

const hexKeyToBytes = (raw: string): Uint8Array => {
  const clean = raw.trim().replace(/^0x/i, '').replace(/[\s:-]/g, '')
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('hmac key is not valid hex')
  if (clean.length % 2 !== 0) throw new Error('hmac hex key must have an even number of digits')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

const base64KeyToBytes = (raw: string): Uint8Array => {
  const clean = raw.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/(?<!=)=+$/, '')
  if (!/^[A-Za-z0-9+/]*$/.test(clean)) throw new Error('hmac key is not valid base64')
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  let bin: string
  try {
    bin = atob(padded)
  } catch {
    throw new Error('hmac key is not valid base64')
  }
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const parseKey = (raw: unknown, format: KeyFormat): Uint8Array => {
  const text = raw === null || raw === undefined ? '' : String(raw)
  if (format === 'hex') return hexKeyToBytes(text)
  if (format === 'base64') return base64KeyToBytes(text)
  return textToUint8Array(text)
}

const formatDigest = (bytes: Uint8Array, output: Output): string => {
  if (output === 'base64') return bytesToBase64(bytes)
  if (output === 'base64url') return bytesToBase64Url(bytes)
  return bytesToHex(bytes)
}

const util: Utility = {
  id: 'hmac',
  name: 'hmac',
  category: 'Hashing',
  description:
    'Sign the input with a keyed HMAC (SHA-1, SHA-256, SHA-384 or SHA-512), taking the key as text, hex or base64 and printing hex, base64 or base64url.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  params: {
    algorithm: {
      kind: 'select',
      label: 'algorithm',
      options: [...ALGORITHMS],
      default: 'SHA-256'
    },
    key: {
      kind: 'string',
      label: 'key',
      default: '',
      placeholder: 'secret key'
    },
    keyFormat: {
      kind: 'select',
      label: 'key format',
      options: [...KEY_FORMATS],
      default: 'text'
    },
    output: {
      kind: 'select',
      label: 'output',
      options: [...OUTPUTS],
      default: 'hex'
    }
  },
  tags: ['hmac', 'mac', 'signature', 'sha256', 'sign', 'authentication', 'webhook signature', 'api signing'],
  aliases: ['hmac-sha256'],
  examples: [
    {
      title: 'text key, hex output',
      input: 'hello',
      params: { algorithm: 'SHA-256', key: 'secret', keyFormat: 'text', output: 'hex' },
      output: '88aab3ede8d3adf94d26ab90d3bafd4a2083070c3bcce9c014ee04a443847c0b'
    },
    {
      title: 'hex key, base64 output',
      input: 'hello',
      params: { algorithm: 'SHA-256', key: 'deadbeef', keyFormat: 'hex', output: 'base64' },
      output: 'KXpxXaiiuT8of9Xm59R2S8Pomd91VtWIiaT5hmVsgAk='
    }
  ],
  apply: async (input: any, params: any) => {
    const p = params || {}
    const algorithm = pick<Algorithm>(p.algorithm, ALGORITHMS, 'SHA-256', 'algorithm')
    const keyFormat = pick<KeyFormat>(p.keyFormat, KEY_FORMATS, 'text', 'key format')
    const output = pick<Output>(p.output, OUTPUTS, 'hex', 'output')

    const keyBytes = parseKey(p.key, keyFormat)
    if (keyBytes.length === 0) throw new Error('hmac requires a key')

    const message = toBytes(input)
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes as BufferSource,
      { name: 'HMAC', hash: { name: algorithm } },
      false,
      ['sign']
    )
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, message as BufferSource))
    return formatDigest(signature, output)
  }
}

export default util
