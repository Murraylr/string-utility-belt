import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/** Convert whatever the pipeline handed us into raw bytes. */
function toBytes(input: any): Uint8Array {
  if (isBytes(input)) return input as Uint8Array
  const text = typeof input === 'string' ? input : String(input ?? '')
  return new TextEncoder().encode(text)
}

function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

function hexKeyToBytes(key: string): Uint8Array {
  const clean = key.replace(/[\s:_-]/g, '')
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('key is not valid hex')
  if (clean.length % 2 !== 0) throw new Error('hex key must have an even number of digits')
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

function base64KeyToBytes(key: string): Uint8Array {
  const clean = key.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4)
  let binary: string
  try {
    binary = atob(padded)
  } catch {
    throw new Error('key is not valid base64')
  }
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i) & 0xff
  return out
}

function decimalKeyToBytes(key: string): Uint8Array {
  const parts = key.split(/[\s,;]+/).filter(Boolean)
  const out = new Uint8Array(parts.length)
  for (let i = 0; i < parts.length; i++) {
    if (!/^\d+$/.test(parts[i])) throw new Error(`key is not a valid decimal byte list: "${parts[i]}"`)
    const n = Number(parts[i])
    if (n > 255) throw new Error(`decimal key byte out of range (0-255): ${parts[i]}`)
    out[i] = n
  }
  return out
}

export function keyToBytes(key: string, keyFormat: string): Uint8Array {
  switch (keyFormat) {
    case 'hex':
      return hexKeyToBytes(key)
    case 'base64':
      return base64KeyToBytes(key)
    case 'decimal':
      return decimalKeyToBytes(key)
    case 'text':
    default:
      return new TextEncoder().encode(key)
  }
}

const util: Utility = {
  id: 'xor_cipher',
  name: 'xor cipher',
  category: 'Ciphers',
  description:
    'Apply a repeating-key XOR cipher (it is its own inverse) using a text, hex, base64, or decimal key, emitting text, hex, base64, or raw bytes.',
  accepts: ['string', 'bytes'],
  produces: ['string', 'bytes'],
  tags: ['xor', 'cipher', 'encrypt', 'decrypt', 'stream cipher', 'key', 'hex', 'base64'],
  examples: [
    {
      title: 'encrypt to hex with a text key',
      input: 'Attack at dawn',
      params: { key: 'lemon', keyFormat: 'text', output: 'hex' },
      output: '2d11190e0d07450c1b4e08041a01'
    },
    {
      title: 'encrypt to base64 with a text key',
      input: 'Attack at dawn',
      params: { key: 'lemon', keyFormat: 'text', output: 'base64' },
      output: 'LREZDg0HRQwbTggEGgE='
    }
  ],
  params: {
    key: { kind: 'string', label: 'key', default: '', placeholder: 'secret' },
    keyFormat: {
      kind: 'select',
      label: 'key format',
      options: ['text', 'hex', 'base64', 'decimal'],
      default: 'text'
    },
    output: {
      kind: 'select',
      label: 'output',
      options: ['text', 'hex', 'base64', 'bytes'],
      default: 'hex'
    }
  },
  apply: (input: any, params: any) => {
    const p = params || {}
    const key = typeof p.key === 'string' ? p.key : ''
    const keyFormat = typeof p.keyFormat === 'string' && p.keyFormat ? p.keyFormat : 'text'
    const output = typeof p.output === 'string' && p.output ? p.output : 'hex'

    const data = toBytes(input)
    if (data.length === 0) return output === 'bytes' ? new Uint8Array(0) : ''

    const keyBytes = keyToBytes(key, keyFormat)
    if (keyBytes.length === 0) throw new Error('xor cipher requires a key')

    const out = new Uint8Array(data.length)
    for (let i = 0; i < data.length; i++) out[i] = data[i] ^ keyBytes[i % keyBytes.length]

    switch (output) {
      case 'bytes':
        return out
      case 'hex':
        return bytesToHex(out)
      case 'base64':
        return bytesToBase64(out)
      case 'text':
      default:
        // fatal: XOR output is usually binary. Surfacing that as a step error
        // beats silently replacing bytes with U+FFFD, which is irreversible and
        // would quietly break the cipher's involutive round-trip.
        try {
          return new TextDecoder('utf-8', { fatal: true }).decode(out)
        } catch {
          throw new Error(
            'xor result is not valid utf-8 text — use the hex, base64, or bytes output instead'
          )
        }
    }
  }
}

export default util
