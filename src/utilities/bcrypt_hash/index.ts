import type { Utility } from '@/types/utility'
import { hexToBytes } from '../helpers'

// hash-wasm is loaded lazily so it never lands in the app's initial bundle
// (src/utilities/index.ts eagerly globs every utility module), and cached so the
// pipeline — which re-runs on every keystroke — only imports it once.
let _hashWasm: typeof import('hash-wasm') | null = null
const getHashWasm = async () => (_hashWasm ??= await import('hash-wasm'))

/** bcrypt's own radix-64 alphabet — note it is NOT standard base64. */
const BCRYPT_B64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

/** Decode a bcrypt radix-64 string (e.g. the 22-char salt inside a `$2a$…` hash). */
const decodeBcryptBase64 = (s: string, byteLength: number): Uint8Array => {
  const out = new Uint8Array(byteLength)
  let acc = 0
  let bits = 0
  let n = 0
  for (const ch of s) {
    const v = BCRYPT_B64.indexOf(ch)
    if (v < 0) throw new Error(`invalid bcrypt salt character ${JSON.stringify(ch)}`)
    acc = (acc << 6) | v
    bits += 6
    if (bits >= 8) {
      bits -= 8
      if (n < byteLength) out[n++] = (acc >> bits) & 0xff
    }
  }
  return out
}

/**
 * A whole `$2b$12$<22-char salt><31-char digest>` hash, or the bare
 * `$2b$12$<22-char salt>` settings string — pasting either into the salt box is
 * the natural way to re-derive a hash, so pull the salt back out of it.
 */
const FULL_HASH_RE = /^\$2[abxy]\$\d{2}\$([./A-Za-z0-9]{22})(?:[./A-Za-z0-9]{31})?$/

/**
 * bcrypt needs exactly 16 bytes of salt. Accepted forms:
 *   ''                       -> 16 cryptographically random bytes
 *   32 hex characters        -> those 16 bytes (`0x` prefix optional)
 *   22 bcrypt-base64 chars   -> the salt copied out of an existing `$2a$…` hash
 *   a whole `$2a$…` hash     -> the 22-char salt embedded in it
 *   16 bytes of UTF-8 text   -> those bytes
 */
const parseBcryptSalt = (raw: string): Uint8Array => {
  const s = raw.trim()
  if (s === '') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return bytes
  }
  const compact = s.replace(/\s+/g, '')
  const pasted = FULL_HASH_RE.exec(compact)
  if (pasted) {
    return decodeBcryptBase64(pasted[1], 16)
  }
  if (/^(0[xX])?[0-9a-fA-F]{32}$/.test(compact)) {
    return hexToBytes(compact.replace(/^0[xX]/, ''))
  }
  if (/^[./A-Za-z0-9]{22}$/.test(compact)) {
    return decodeBcryptBase64(compact, 16)
  }
  const bytes = new TextEncoder().encode(s)
  if (bytes.length !== 16) {
    throw new Error(
      `bcrypt salt must be 16 bytes: use 32 hex characters, a 22-character bcrypt salt, a whole $2a$… hash, or 16 bytes of text (got ${bytes.length} bytes)`
    )
  }
  return bytes
}

const parseCost = (raw: unknown): number => {
  if (raw === undefined || raw === null || raw === '') return 10
  const n = Number(raw)
  if (!Number.isInteger(n)) throw new Error('bcrypt cost must be a whole number between 4 and 31')
  if (n < 4 || n > 31) throw new Error(`bcrypt cost must be between 4 and 31 (got ${n})`)
  return n
}

const util: Utility = {
  id: 'bcrypt_hash',
  name: 'bcrypt hash',
  category: 'Hashing',
  description:
    'Hash a password with bcrypt at a chosen cost factor, using a random salt or a supplied 16-byte salt (hex, bcrypt-base64, or text).',
  accepts: 'string',
  produces: 'string',
  tags: ['password hashing', 'crypt', 'htpasswd', 'blowfish'],
  aliases: ['htpasswd'],
  examples: [
    {
      title: 'bcrypt with a fixed salt (reproducible for the example)',
      input: 'hunter2',
      params: { cost: 4, salt: '000102030405060708090a0b0c0d0e0f' },
      output: '$2a$04$..CA.uOD/eaGAOmJB.yMBurkTM.teJW4P/NXJXOT49X8IHvXALk4i'
    }
  ],
  params: {
    cost: { kind: 'number', label: 'cost factor (4-31)', default: 10, min: 4, max: 31, integer: true },
    salt: {
      kind: 'string',
      label: 'salt (blank = random)',
      default: '',
      placeholder: '32 hex chars, a 22-char bcrypt salt, a whole $2a$… hash, or 16 bytes of text'
    }
  },
  apply: async (input: any, params: any) => {
    const password = String(input ?? '')
    if (password === '') return ''

    // bcrypt is C-string based: it stops at the first NUL byte, so "abc\0secret"
    // and "abc" produce the identical hash. Silently hashing a prefix of the
    // password is far worse than refusing to hash it at all.
    if (password.includes('\0')) {
      throw new Error(
        'bcrypt stops at the first NUL (U+0000) character, so hashing this password would silently discard everything after it — remove the NUL first'
      )
    }

    const cost = parseCost(params?.cost)
    const salt = parseBcryptSalt(params?.salt == null ? '' : String(params.salt))

    const passwordBytes = new TextEncoder().encode(password)
    if (passwordBytes.length > 72) {
      throw new Error(
        `bcrypt hashes at most 72 bytes of password; this input is ${passwordBytes.length} bytes — shorten it or pre-hash it`
      )
    }

    const { bcrypt } = await getHashWasm()
    return await bcrypt({
      password: passwordBytes,
      salt,
      costFactor: cost,
      outputType: 'encoded'
    })
  }
}

export default util
