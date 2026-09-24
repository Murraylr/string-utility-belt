import type { Utility, Value } from '@/types/utility'
import { isBytes } from '../helpers'

/** RFC 2045 token characters, which is what a mime type/subtype is made of. */
const MIME_RE = /^[A-Za-z0-9!#$%&'*+.^_`|~-]+\/[A-Za-z0-9!#$%&'*+.^_`|~-]+$/
const CHARSET_RE = /^[A-Za-z0-9._:+-]+$/
/** RFC 3986 unreserved set — everything else is percent-escaped. */
const UNRESERVED = /^[A-Za-z0-9\-._~]$/

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

function percentEncode(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) {
    const ch = String.fromCharCode(b)
    out += UNRESERVED.test(ch) ? ch : `%${b.toString(16).toUpperCase().padStart(2, '0')}`
  }
  return out
}

const util: Utility = {
  id: 'data_uri_build',
  name: 'data uri build',
  category: 'Encoding',
  description:
    'Wrap text or bytes in a data: URI with the given mime type, either base64-encoded or percent-encoded, and an optional charset parameter.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['data uri', 'data url', 'base64', 'mime', 'embed', 'image'],
  aliases: ['data url'],
  params: {
    mime: { kind: 'string', label: 'mime type', default: 'text/plain', placeholder: 'image/png' },
    base64: { kind: 'boolean', label: 'base64 encode', default: true },
    charset: { kind: 'string', label: 'charset', default: 'utf-8', placeholder: 'utf-8' }
  },
  examples: [
    { title: 'base64', input: 'hello', params: { mime: 'text/plain', base64: true }, output: 'data:text/plain;charset=utf-8;base64,aGVsbG8=' },
    { title: 'percent-encoded', input: 'a b', params: { mime: 'text/plain', base64: false }, output: 'data:text/plain;charset=utf-8,a%20b' }
  ],
  apply: (input: any, params: any) => {
    // mime types and charset labels are case-insensitive; emit the canonical
    // lower-case form so a build -> parse round trip is stable
    const mime = String(params?.mime ?? 'text/plain').trim().toLowerCase()
    // `?? default` (not `||`) so an explicitly cleared charset stays cleared
    const charset = String(params?.charset ?? 'utf-8').trim().toLowerCase()
    const useBase64 = params?.base64 !== false

    if (mime && !MIME_RE.test(mime)) throw new Error(`invalid mime type: ${mime}`)
    if (charset && !CHARSET_RE.test(charset)) throw new Error(`invalid charset: ${charset}`)

    // text is always serialised as UTF-8; the charset parameter is a label.
    // Chain `charset encode` first for a non-UTF-8 payload.
    const value = input as Value
    const bytes = isBytes(value) ? value : new TextEncoder().encode(String(value ?? ''))

    let header = mime
    if (charset) header += `;charset=${charset}`
    if (useBase64) header += ';base64'

    return `data:${header},${useBase64 ? bytesToBase64(bytes) : percentEncode(bytes)}`
  }
}

export default util
