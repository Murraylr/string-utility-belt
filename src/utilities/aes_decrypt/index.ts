import type { Utility } from '@/types/utility'

/**
 * Inverse of `aes_encrypt`. Expects base64 or hex of:
 *   salt(16) || iv(12 for GCM, 16 for CBC) || ciphertext
 * and re-derives the key with PBKDF2-SHA256 from the password.
 *
 * The format constants and key derivation are duplicated here on purpose so the
 * utility is a self-contained module (no imports from a sibling utility).
 */

const SALT_BYTES = 16
const GCM_IV_BYTES = 12
const CBC_IV_BYTES = 16
const GCM_TAG_BYTES = 16
const AES_BLOCK_BYTES = 16
const DEFAULT_ITERATIONS = 100000
const MAX_ITERATIONS = 10000000

type AesMode = 'GCM' | 'CBC'

const readMode = (raw: unknown): AesMode => {
  const m = String(raw ?? '').trim().toUpperCase()
  if (m === '' || m === 'GCM' || m === 'AES-GCM') return 'GCM'
  if (m === 'CBC' || m === 'AES-CBC') return 'CBC'
  throw new Error(`unsupported mode "${String(raw)}" — use GCM or CBC`)
}

const readKeyBits = (raw: unknown): 128 | 256 => {
  const s = String(raw ?? '').trim()
  if (s === '') return 256
  const n = Number(s)
  if (n === 128) return 128
  if (n === 256) return 256
  throw new Error(`unsupported key size "${String(raw)}" — use 128 or 256`)
}

const readIterations = (raw: unknown): number => {
  const s = String(raw ?? '').trim()
  if (s === '') return DEFAULT_ITERATIONS
  const n = Number(s)
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new Error('iterations must be a whole number of at least 1')
  }
  if (n > MAX_ITERATIONS) {
    throw new Error(`iterations must be ${MAX_ITERATIONS} or fewer`)
  }
  return n
}

const readFormat = (raw: unknown): 'auto' | 'base64' | 'hex' => {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === '' || s === 'auto') return 'auto'
  if (s === 'base64') return 'base64'
  if (s === 'hex') return 'hex'
  throw new Error(`unsupported input format "${String(raw)}" — use auto, base64 or hex`)
}

const readOutput = (raw: unknown): 'text' | 'bytes' => {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === '' || s === 'text') return 'text'
  if (s === 'bytes') return 'bytes'
  throw new Error(`unsupported output "${String(raw)}" — use text or bytes`)
}

const hexToBytes = (hex: string): Uint8Array => {
  if (hex.length % 2 !== 0) throw new Error('input is not valid hex — odd number of digits')
  if (!/^[0-9a-fA-F]*$/.test(hex)) throw new Error('input is not valid hex')
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** Tolerates the url-safe alphabet and missing padding. */
const base64ToBytes = (b64: string): Uint8Array => {
  const body = b64.replace(/(?<!=)=+$/, '')
  if (!/^[A-Za-z0-9+/\-_]*$/.test(body)) throw new Error('input is not valid base64')
  if (body.length % 4 === 1) throw new Error('input is not valid base64')
  let t = body.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = t.length % 4
  if (remainder !== 0) t += '='.repeat(4 - remainder)
  let bin: string
  try {
    bin = atob(t)
  } catch {
    throw new Error('input is not valid base64')
  }
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff
  return out
}

const looksLikeHex = (s: string) => s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s)

const deriveAesKey = async (
  password: string,
  salt: Uint8Array,
  iterations: number,
  keyBits: 128 | 256,
  mode: AesMode
): Promise<CryptoKey> => {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    baseKey,
    { name: mode === 'CBC' ? 'AES-CBC' : 'AES-GCM', length: keyBits },
    false,
    ['decrypt']
  )
}

const util: Utility = {
  id: 'aes_decrypt',
  name: 'aes decrypt',
  category: 'Ciphers',
  description:
    'Decrypt a salt + iv + ciphertext blob produced by aes encrypt (AES-GCM or AES-CBC, PBKDF2-SHA256 password key) from base64 or hex back to text or bytes.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  tags: ['decrypt', 'aes-gcm', 'aes-cbc', 'pbkdf2', 'symmetric decryption', 'password based encryption'],
  examples: [
    {
      title: 'decrypt a blob produced by aes encrypt',
      input: '+h7y7ZkH9CwYGGTiSlszGIehaPd912N5pRplQG5pSKozRrx5KFbu1piNEwBE1+7kl1RGdN3itmVFLQ==',
      params: { password: 'hunter2', iterations: 1000 },
      output: 'secret message'
    }
  ],
  params: {
    password: { kind: 'string', label: 'password', default: '', placeholder: 'passphrase' },
    mode: { kind: 'select', label: 'mode', options: ['GCM', 'CBC'], default: 'GCM' },
    keyBits: { kind: 'select', label: 'key size (bits)', options: ['128', '256'], default: '256' },
    iterations: { kind: 'number', label: 'pbkdf2 iterations', default: DEFAULT_ITERATIONS, min: 1, max: 10000000, integer: true },
    format: {
      kind: 'select',
      label: 'input format',
      options: ['auto', 'base64', 'hex'],
      default: 'auto'
    },
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  apply: async (input: any, params: any) => {
    const cleaned = String(input ?? '').replace(/\s+/g, '')
    if (cleaned === '') {
      // Empty input never throws, not even for an unusable param value.
      return String(params?.output ?? '').trim().toLowerCase() === 'bytes' ? new Uint8Array(0) : ''
    }

    const password = String(params?.password ?? '')
    if (password === '') throw new Error('password is required')

    const mode = readMode(params?.mode)
    const keyBits = readKeyBits(params?.keyBits)
    const iterations = readIterations(params?.iterations)
    const format = readFormat(params?.format)
    const asBytes = readOutput(params?.output) === 'bytes'

    let raw: Uint8Array
    if (format === 'hex') raw = hexToBytes(cleaned)
    else if (format === 'base64') raw = base64ToBytes(cleaned)
    else raw = looksLikeHex(cleaned) ? hexToBytes(cleaned) : base64ToBytes(cleaned)

    const ivLength = mode === 'CBC' ? CBC_IV_BYTES : GCM_IV_BYTES
    const headerLength = SALT_BYTES + ivLength
    const minimum = headerLength + (mode === 'CBC' ? AES_BLOCK_BYTES : GCM_TAG_BYTES)
    if (raw.length < minimum) {
      throw new Error(
        `ciphertext is too short — AES-${mode} needs at least ${minimum} bytes (salt ${SALT_BYTES} + iv ${ivLength} + ${mode === 'CBC' ? 'one block' : 'auth tag'} 16), got ${raw.length}`
      )
    }
    if (mode === 'CBC' && (raw.length - headerLength) % AES_BLOCK_BYTES !== 0) {
      throw new Error('ciphertext length is not a multiple of the AES block size — wrong mode or corrupted data')
    }

    const salt = raw.subarray(0, SALT_BYTES)
    const iv = raw.subarray(SALT_BYTES, headerLength)
    const body = raw.subarray(headerLength)

    const key = await deriveAesKey(password, salt, iterations, keyBits, mode)
    const algorithm =
      mode === 'CBC'
        ? { name: 'AES-CBC', iv: iv as BufferSource }
        : { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 }

    let plain: Uint8Array
    try {
      plain = new Uint8Array(await crypto.subtle.decrypt(algorithm, key, body as BufferSource))
    } catch {
      throw new Error(
        'decryption failed — wrong password, mode or key size, or the data has been modified'
      )
    }

    if (asBytes) return plain
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(plain)
    } catch {
      throw new Error(
        'decrypted data is not valid UTF-8 — set output to bytes, or check the password and mode'
      )
    }
  }
}

export default util
