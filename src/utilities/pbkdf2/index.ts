import type { Utility } from '@/types/utility'
import { bytesToHex, isBytes, textToUint8Array } from '../helpers'

const ALGORITHMS = ['SHA-1', 'SHA-256', 'SHA-512'] as const
const OUTPUTS = ['hex', 'base64'] as const

type Algorithm = (typeof ALGORITHMS)[number]
type Output = (typeof OUTPUTS)[number]

const MAX_KEY_LENGTH = 1024

const pick = <T extends string>(value: unknown, options: readonly T[], fallback: T, label: string): T => {
  if (value === undefined || value === null || value === '') return fallback
  const wanted = String(value).trim()
  const found = options.find((o) => o.toLowerCase() === wanted.toLowerCase())
  if (!found) throw new Error(`unsupported pbkdf2 ${label}: ${wanted}`)
  return found
}

const toInteger = (value: unknown, fallback: number, label: string): number => {
  if (value === undefined || value === null || value === '') return fallback
  const n = Number(value)
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new Error(`pbkdf2 ${label} must be a whole number`)
  return n
}

const toBytes = (value: unknown): Uint8Array =>
  isBytes(value) ? value : textToUint8Array(value === null || value === undefined ? '' : String(value))

const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

const util: Utility = {
  id: 'pbkdf2',
  name: 'pbkdf2',
  category: 'Hashing',
  description:
    'Derive a key from the input password with PBKDF2 (HMAC SHA-1, SHA-256 or SHA-512) using a salt, iteration count and key length, printed as hex or base64.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  params: {
    algorithm: {
      kind: 'select',
      label: 'algorithm',
      options: [...ALGORITHMS],
      default: 'SHA-256'
    },
    salt: {
      kind: 'string',
      label: 'salt',
      default: '',
      placeholder: 'salt (utf-8 text)'
    },
    iterations: {
      kind: 'number',
      label: 'iterations',
      default: 100000,
      min: 1,
      integer: true, max: 10000000 },
    keyLength: {
      kind: 'number',
      label: 'key length (bytes)',
      default: 32,
      min: 1,
      max: MAX_KEY_LENGTH,
      integer: true
    },
    output: {
      kind: 'select',
      label: 'output',
      options: [...OUTPUTS],
      default: 'hex'
    }
  },
  tags: ['pbkdf2', 'kdf', 'key derivation', 'password hashing', 'salt', 'iterations', 'crypto.pbkdf2'],
  examples: [
    {
      title: 'hex output',
      input: 'password',
      params: { algorithm: 'SHA-256', salt: 'salt', iterations: 1000, keyLength: 16, output: 'hex' },
      output: '632c2812e46d4604102ba7618e9d6d7d'
    },
    {
      title: 'base64 output',
      input: 'password',
      params: { algorithm: 'SHA-256', salt: 'salt', iterations: 1000, keyLength: 16, output: 'base64' },
      output: 'YywoEuRtRgQQK6dhjp1tfQ=='
    }
  ],
  apply: async (input: any, params: any) => {
    const p = params || {}
    const algorithm = pick<Algorithm>(p.algorithm, ALGORITHMS, 'SHA-256', 'algorithm')
    const output = pick<Output>(p.output, OUTPUTS, 'hex', 'output')

    const iterations = toInteger(p.iterations, 100000, 'iterations')
    if (iterations < 1) throw new Error('pbkdf2 iterations must be at least 1')

    const keyLength = toInteger(p.keyLength, 32, 'key length')
    if (keyLength < 1) throw new Error('pbkdf2 key length must be at least 1 byte')
    if (keyLength > MAX_KEY_LENGTH) {
      throw new Error(`pbkdf2 key length must be at most ${MAX_KEY_LENGTH} bytes`)
    }

    const password = toBytes(input)
    const salt = textToUint8Array(p.salt === undefined || p.salt === null ? '' : String(p.salt))

    const baseKey = await crypto.subtle.importKey('raw', password as BufferSource, 'PBKDF2', false, [
      'deriveBits'
    ])
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: algorithm },
      baseKey,
      keyLength * 8
    )
    const derived = new Uint8Array(bits)
    return output === 'base64' ? bytesToBase64(derived) : bytesToHex(derived)
  }
}

export default util
