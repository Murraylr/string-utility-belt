import type { Utility } from '@/types/utility'

/**
 * Verify the HMAC signature of a JWT (HS256 / HS384 / HS512) with `crypto.subtle`,
 * optionally rejecting tokens that are expired or not yet valid.
 *
 * Token problems are reported through the `reason` field rather than thrown, so the
 * step keeps rendering a result; only a missing/undecodable secret throws.
 */

const HMAC_HASHES: Record<string, string> = {
  HS256: 'SHA-256',
  HS384: 'SHA-384',
  HS512: 'SHA-512'
}

/**
 * RFC 7515 §2 base64url. Token segments must use the url-safe alphabet; the
 * secret decoder is deliberately looser (`standardToo`) because shared secrets
 * are just as often pasted in the standard alphabet.
 */
const base64urlToBytes = (part: string, standardToo = false): Uint8Array | null => {
  const body = part.replace(/(?<!=)=+$/, '')
  const alphabet = standardToo ? /^[A-Za-z0-9_\-+/]*$/ : /^[A-Za-z0-9_-]*$/
  if (!alphabet.test(body)) return null
  if (body.length % 4 === 1) return null
  let t = body.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = t.length % 4
  if (remainder !== 0) t += '='.repeat(4 - remainder)
  let bin: string
  try {
    bin = atob(t)
  } catch {
    return null
  }
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff
  return out
}

const jsonSegment = (part: string): Record<string, unknown> | null => {
  const bytes = base64urlToBytes(part)
  if (!bytes) return null
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(text)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

const secretToBytes = (secret: string, format: string): Uint8Array => {
  if (format === 'text') return new TextEncoder().encode(secret)
  if (format === 'hex') {
    const clean = secret.replace(/\s+/g, '')
    if (clean.length % 2 !== 0) throw new Error('secret is not valid hex — odd number of digits')
    if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('secret is not valid hex')
    const out = new Uint8Array(clean.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
    return out
  }
  if (format === 'base64url') {
    const bytes = base64urlToBytes(secret.replace(/\s+/g, ''), true)
    if (!bytes) throw new Error('secret is not valid base64url')
    return bytes
  }
  throw new Error(`unsupported secret format "${format}" — use text, base64url or hex`)
}

/**
 * RFC 7519 NumericDate: seconds since the epoch. Numeric strings are tolerated,
 * anything else (blank, whitespace, booleans, words) is `null` so a junk claim
 * is not silently read as 1970.
 */
const claimSeconds = (claim: unknown): number | null => {
  if (typeof claim === 'number') return Number.isFinite(claim) ? claim : null
  if (typeof claim === 'string') {
    const trimmed = claim.trim()
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(trimmed)) return null
    const n = Number(trimmed)
    return Number.isFinite(n) ? n : null
  }
  return null
}

const toIso = (seconds: number) => {
  const date = new Date(seconds * 1000)
  return Number.isNaN(date.getTime()) ? String(seconds) : date.toISOString()
}

const util: Utility = {
  id: 'jwt_verify',
  name: 'jwt verify',
  category: 'Ciphers',
  description:
    'Check a JWT signature against an HS256/HS384/HS512 secret (given as text, base64url or hex) and report whether it is valid, why not, and whether it has expired.',
  accepts: 'string',
  produces: 'json',
  tags: ['jwt', 'json web token', 'hmac', 'hs256', 'signature', 'auth', 'bearer', 'verify'],
  aliases: ['jwt.io'],
  examples: [
    {
      title: 'valid, unexpired token',
      input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjo0MTAyNDQ0ODAwfQ.aJxvu2C4BASwRVqfRlA1g4Pn0ll8kiRebvH4wo396aQ',
      params: { secret: 'my-secret', secretFormat: 'text', checkExpiry: true },
      output: '{\n  "valid": true,\n  "algorithm": "HS256",\n  "reason": "signature is valid",\n  "expired": false\n}'
    },
    {
      title: 'expired token',
      input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxMDAwMDAwMDAwfQ.08xF_XOKxxvPpUuk4mhVMMMUQ8n2oQxN5OevXj7lgVY',
      params: { secret: 'my-secret', secretFormat: 'text', checkExpiry: true },
      output: '{\n  "valid": false,\n  "algorithm": "HS256",\n  "reason": "token expired at 2001-09-09T01:46:40.000Z",\n  "expired": true\n}'
    },
    {
      title: 'wrong secret',
      input: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjo0MTAyNDQ0ODAwfQ.aJxvu2C4BASwRVqfRlA1g4Pn0ll8kiRebvH4wo396aQ',
      params: { secret: 'wrong-secret', secretFormat: 'text', checkExpiry: true },
      output: '{\n  "valid": false,\n  "algorithm": "HS256",\n  "reason": "signature does not match the secret",\n  "expired": false\n}'
    }
  ],
  params: {
    secret: { kind: 'string', label: 'secret', default: '', placeholder: 'shared secret' },
    secretFormat: {
      kind: 'select',
      label: 'secret format',
      options: ['text', 'base64url', 'hex'],
      default: 'text'
    },
    checkExpiry: { kind: 'boolean', label: 'check exp / nbf', default: true }
  },
  apply: async (input: any, params: any) => {
    const token = String(input ?? '')
      .trim()
      .replace(/^Bearer\s+/i, '')
      .trim()
    if (token === '') return {}

    const secret = String(params?.secret ?? '')
    if (secret === '') throw new Error('secret is required')
    const secretFormat = String(params?.secretFormat ?? 'text').trim().toLowerCase() || 'text'
    const keyBytes = secretToBytes(secret, secretFormat)
    if (keyBytes.length === 0) {
      throw new Error(`secret decodes to zero bytes — check the "${secretFormat}" secret format`)
    }
    const checkExpiry = params?.checkExpiry !== false

    const fail = (algorithm: string | null, reason: string, expired = false) => ({
      valid: false,
      algorithm,
      reason,
      expired
    })

    const parts = token.split('.')
    if (parts.length !== 3) {
      return fail(null, `not a jwt — expected 3 dot-separated parts, got ${parts.length}`)
    }
    const [headerPart, payloadPart, signaturePart] = parts

    const header = jsonSegment(headerPart)
    if (!header) return fail(null, 'jwt header is not decodable json')

    const algorithm = typeof header.alg === 'string' ? header.alg : null
    if (!algorithm) return fail(null, 'jwt header has no "alg" field')
    const hash = HMAC_HASHES[algorithm.toUpperCase()]
    if (!hash) {
      return fail(
        algorithm,
        algorithm.toLowerCase() === 'none'
          ? 'algorithm "none" — this token is unsigned and cannot be verified'
          : `unsupported algorithm "${algorithm}" — only HS256, HS384 and HS512 can be verified here`
      )
    }

    const signature = base64urlToBytes(signaturePart)
    if (!signature || signature.length === 0) {
      return fail(algorithm, 'signature is missing or not valid base64url')
    }

    const key = await crypto.subtle.importKey(
      'raw',
      keyBytes as BufferSource,
      { name: 'HMAC', hash },
      false,
      ['verify']
    )
    const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`)
    const signatureOk = await crypto.subtle.verify(
      'HMAC',
      key,
      signature as BufferSource,
      signed as BufferSource
    )

    const payload = jsonSegment(payloadPart)
    const exp = payload ? claimSeconds(payload.exp) : null
    const nbf = payload ? claimSeconds(payload.nbf) : null
    const now = Date.now() / 1000
    // RFC 7519 §4.1.4/§4.1.5: valid while nbf <= now < exp.
    const expired = exp !== null && now >= exp
    const notYetValid = nbf !== null && now < nbf

    if (!signatureOk) return fail(algorithm, 'signature does not match the secret', expired)
    if (!payload) {
      return {
        valid: true,
        algorithm,
        reason: 'signature is valid, but the payload is not decodable json so exp/nbf were not checked',
        expired: false
      }
    }
    if (checkExpiry && expired) {
      return fail(algorithm, `token expired at ${toIso(exp as number)}`, true)
    }
    if (checkExpiry && notYetValid) {
      return fail(algorithm, `token is not valid before ${toIso(nbf as number)}`, expired)
    }
    return {
      valid: true,
      algorithm,
      reason: expired
        ? 'signature is valid (token is expired, but expiry checking is off)'
        : 'signature is valid',
      expired
    }
  }
}

export default util
