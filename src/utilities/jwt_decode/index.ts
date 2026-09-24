import type { Utility } from '@/types/utility'

/**
 * Decode a JWS compact-serialization JWT without verifying the signature.
 * Use `jwt_verify` when the signature matters.
 */

/**
 * RFC 7515 §2 base64url: the url-safe alphabet only, padding optional.
 * `+` and `/` are rejected so a mangled token is reported rather than silently
 * half-decoded.
 */
const base64urlToBytes = (part: string, label: string): Uint8Array => {
  const body = part.replace(/(?<!=)=+$/, '')
  if (!/^[A-Za-z0-9_-]*$/.test(body)) {
    throw new Error(`jwt ${label} is not valid base64url — only A-Z a-z 0-9 - _ are allowed`)
  }
  if (body.length % 4 === 1) {
    throw new Error(`jwt ${label} is not valid base64url — the segment is truncated`)
  }
  let t = body.replace(/-/g, '+').replace(/_/g, '/')
  const remainder = t.length % 4
  if (remainder !== 0) t += '='.repeat(4 - remainder)
  let bin: string
  try {
    bin = atob(t)
  } catch {
    throw new Error(`jwt ${label} is not valid base64url`)
  }
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) & 0xff
  return out
}

const decodeSegment = (part: string, label: string): Record<string, unknown> => {
  const bytes = base64urlToBytes(part, label)
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error(`jwt ${label} is not valid UTF-8`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(`jwt ${label} is not valid JSON`)
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`jwt ${label} is not a JSON object`)
  }
  return parsed as Record<string, unknown>
}

/**
 * RFC 7519 NumericDate: seconds since the epoch. Numeric strings are tolerated
 * because sloppy issuers emit them, but anything that is not a plain number
 * (blank, whitespace, `true`, `"soon"`) is `null` rather than silently 1970.
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

/** Numeric-date claim → ISO 8601, or null when absent/unusable. */
const claimToIso = (claim: unknown): string | null => {
  const seconds = claimSeconds(claim)
  if (seconds === null) return null
  const date = new Date(seconds * 1000)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

const util: Utility = {
  id: 'jwt_decode',
  name: 'jwt decode',
  category: 'Decoding',
  description:
    'Decode a JWT into its header, payload and signature with readable ISO dates for exp/iat/nbf — no signature check; the part option can narrow the result to just the header or payload.',
  accepts: 'string',
  produces: 'json',
  params: {
    part: { kind: 'select', label: 'part', options: ['all', 'header', 'payload'], default: 'all' }
  },
  tags: ['jwt', 'json web token', 'decode', 'bearer', 'oauth', 'auth', 'claims'],
  examples: [
    {
      title: 'full decode',
      input:
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      output:
        '{\n  "header": {\n    "alg": "HS256",\n    "typ": "JWT"\n  },\n  "payload": {\n    "sub": "1234567890",\n    "name": "John Doe",\n    "iat": 1516239022\n  },\n  "signature": "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",\n  "expiresAt": null,\n  "issuedAt": "2018-01-18T01:30:22.000Z",\n  "notBefore": null,\n  "isExpired": false\n}'
    }
  ],
  apply: (input: any, params: any) => {
    const token = String(input ?? '')
      .trim()
      .replace(/^Bearer\s+/i, '')
      .trim()
    if (token === '') return {}

    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error(
        `not a jwt — expected 3 dot-separated parts, got ${parts.length}`
      )
    }
    const [headerPart, payloadPart, signaturePart] = parts
    if (headerPart === '' || payloadPart === '') {
      throw new Error('not a jwt — the header and payload segments must not be empty')
    }

    const part = String(params?.part ?? 'all').trim().toLowerCase() || 'all'
    if (part !== 'all' && part !== 'header' && part !== 'payload') {
      throw new Error(`unsupported part "${String(params?.part)}" — use all, header or payload`)
    }

    const header = decodeSegment(headerPart, 'header')
    if (part === 'header') return header

    const payload = decodeSegment(payloadPart, 'payload')
    if (part === 'payload') return payload

    const exp = claimSeconds(payload.exp)
    return {
      header,
      payload,
      signature: signaturePart,
      expiresAt: claimToIso(payload.exp),
      issuedAt: claimToIso(payload.iat),
      notBefore: claimToIso(payload.nbf),
      // RFC 7519 §4.1.4: the current time must be *before* exp, so now === exp is expired.
      isExpired: exp !== null && Date.now() / 1000 >= exp
    }
  }
}

export default util
