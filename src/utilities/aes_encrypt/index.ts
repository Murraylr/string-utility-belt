import type { Utility } from '@/types/utility'
import { bytesToHex, isBytes } from '../helpers'

/**
 * AES encryption with a password-derived key.
 *
 * Wire format (before base64/hex encoding):
 *   salt(16) || iv(12 for GCM, 16 for CBC) || ciphertext
 *
 * The key is derived with PBKDF2-SHA256 over the password using the random salt,
 * so the same password produces a different blob every time.
 *
 * `aes_decrypt` carries its own copy of this format and of the key derivation so
 * the two utilities stay independent modules.
 */

const SALT_BYTES = 16
const GCM_IV_BYTES = 12
const CBC_IV_BYTES = 16
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

const readOutput = (raw: unknown): 'base64' | 'hex' => {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === '' || s === 'base64') return 'base64'
  if (s === 'hex') return 'hex'
  throw new Error(`unsupported output "${String(raw)}" — use base64 or hex`)
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

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
    ['encrypt']
  )
}

const util: Utility = {
  id: 'aes_encrypt',
  name: 'aes encrypt',
  category: 'Ciphers',
  description:
    'Encrypt text or bytes with AES-GCM or AES-CBC using a PBKDF2-SHA256 key derived from a password, emitting salt + iv + ciphertext as base64 or hex.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['encrypt', 'aes-gcm', 'aes-cbc', 'pbkdf2', 'symmetric encryption', 'password based encryption'],
  examples: [
    {
      title: 'encrypt with a password (output is random each run)',
      input: 'secret message',
      params: { password: 'hunter2', iterations: 1000 },
      outputMatches: '^[A-Za-z0-9+/]+=*$'
    }
  ],
  params: {
    password: { kind: 'string', label: 'password', default: '', placeholder: 'passphrase' },
    mode: { kind: 'select', label: 'mode', options: ['GCM', 'CBC'], default: 'GCM' },
    keyBits: { kind: 'select', label: 'key size (bits)', options: ['128', '256'], default: '256' },
    iterations: { kind: 'number', label: 'pbkdf2 iterations', default: DEFAULT_ITERATIONS, min: 1, max: 10000000, integer: true },
    output: { kind: 'select', label: 'output', options: ['base64', 'hex'], default: 'base64' }
  },
  apply: async (input: any, params: any) => {
    const data = isBytes(input)
      ? (input as Uint8Array)
      : new TextEncoder().encode(String(input ?? ''))
    if (data.length === 0) return ''

    const password = String(params?.password ?? '')
    if (password === '') throw new Error('password is required')

    const mode = readMode(params?.mode)
    const keyBits = readKeyBits(params?.keyBits)
    const iterations = readIterations(params?.iterations)
    const outputFormat = readOutput(params?.output)

    const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
    const ivLength = mode === 'CBC' ? CBC_IV_BYTES : GCM_IV_BYTES
    const iv = crypto.getRandomValues(new Uint8Array(ivLength))

    const key = await deriveAesKey(password, salt, iterations, keyBits, mode)
    const algorithm =
      mode === 'CBC'
        ? { name: 'AES-CBC', iv: iv as BufferSource }
        : { name: 'AES-GCM', iv: iv as BufferSource, tagLength: 128 }

    const cipher = new Uint8Array(
      await crypto.subtle.encrypt(algorithm, key, data as BufferSource)
    )

    const out = new Uint8Array(salt.length + iv.length + cipher.length)
    out.set(salt, 0)
    out.set(iv, salt.length)
    out.set(cipher, salt.length + iv.length)

    return outputFormat === 'hex' ? bytesToHex(out) : bytesToBase64(out)
  }
}

export default util
