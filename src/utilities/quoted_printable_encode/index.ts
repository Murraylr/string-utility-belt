import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

const HEX = '0123456789ABCDEF'
const SP = 0x20
const TAB = 0x09
const MIN_LINE = 4
const MAX_LINE = 998

/**
 * The params editor sends `''` for a number field the user has cleared, so an
 * empty value has to mean "use the default" rather than `Number('') === 0`.
 */
const numParam = (v: unknown, fallback: number) =>
  v === undefined || v === null || v === '' ? fallback : Number(v)

/** RFC 2045 §6.7 `=XX`, always upper-case hex. */
const escapeByte = (b: number) => `=${HEX[b >> 4]}${HEX[b & 0x0f]}`

/** Printable ASCII except `=` (0x3D) may be represented literally. */
const isLiteral = (b: number) => (b >= 33 && b <= 60) || (b >= 62 && b <= 126)

function toBytes(input: unknown): Uint8Array {
  if (isBytes(input)) return input as Uint8Array
  if (input === null || input === undefined) return new Uint8Array(0)
  if (typeof input === 'object') return new TextEncoder().encode(JSON.stringify(input))
  return new TextEncoder().encode(String(input))
}

type Line = { bytes: number[]; eol: string }

/**
 * Split on hard line breaks, preserving the exact terminator so that CRLF,
 * LF and CR survive a round trip instead of being silently normalised.
 */
export function splitHardLines(bytes: Uint8Array): Line[] {
  const lines: Line[] = []
  let cur: number[] = []
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if (b === 0x0d) {
      const crlf = bytes[i + 1] === 0x0a
      if (crlf) i++
      lines.push({ bytes: cur, eol: crlf ? '\r\n' : '\r' })
      cur = []
    } else if (b === 0x0a) {
      lines.push({ bytes: cur, eol: '\n' })
      cur = []
    } else {
      cur.push(b)
    }
  }
  lines.push({ bytes: cur, eol: '' })
  return lines
}

/**
 * One token per source byte, each 1 char (literal) or 3 chars (`=XX`).
 * Whitespace at the very end of a line is escaped, since transports are
 * allowed to strip trailing spaces and tabs.
 */
export function tokenize(lineBytes: number[]): string[] {
  const out: string[] = []
  for (let i = 0; i < lineBytes.length; i++) {
    const b = lineBytes[i]
    const last = i === lineBytes.length - 1
    if (b === SP || b === TAB) out.push(last ? escapeByte(b) : String.fromCharCode(b))
    else if (isLiteral(b)) out.push(String.fromCharCode(b))
    else out.push(escapeByte(b))
  }
  return out
}

/**
 * Greedily pack tokens into lines of at most `maxContent` characters, joined
 * by soft breaks (`=` + CRLF). No `=XX` group is ever split, and no wrapped
 * line is allowed to end in literal whitespace.
 */
export function wrapTokens(tokens: string[], maxContent: number): string {
  const out: string[] = []
  let line = ''
  let i = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (line.length + t.length <= maxContent) {
      line += t
      i++
      continue
    }
    if (line.length === 0) {
      // Unreachable while lineLength >= 4 (a token is at most 3 chars), but it
      // guarantees this loop always terminates.
      out.push(`${t}=`)
      i++
      continue
    }
    const tail = line.slice(-1)
    if (tail === ' ' || tail === '\t') {
      if (line.length > 1) {
        // Carry the whitespace onto the next line, where it will not be last.
        out.push(`${line.slice(0, -1)}=`)
        line = tail
        continue
      }
      // Nothing to carry it to — escape it in place.
      line = escapeByte(tail.charCodeAt(0))
    }
    out.push(`${line}=`)
    line = ''
  }
  out.push(line)
  return out.join('\r\n')
}

const util: Utility = {
  id: 'quoted_printable_encode',
  name: 'quoted-printable encode',
  category: 'Encoding',
  description:
    'Encode text or bytes as RFC 2045 quoted-printable, with =XX escapes, trailing-space protection and soft line breaks at the given line length.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['qp', 'mime', 'email', 'rfc2045', 'encode', 'ascii armor'],
  aliases: ['qp'],
  streamable: true,
  examples: [
    { title: 'non-ASCII and =', input: 'café = caffeine?', output: 'caf=C3=A9 =3D caffeine?' },
    {
      title: 'wrapped at a short line length',
      input: 'abcdefghijklmnopqrstuvwxyz',
      params: { lineLength: 10 },
      output: 'abcdefghi=\r\njklmnopqr=\r\nstuvwxyz'
    }
  ],
  params: {
    lineLength: { kind: 'number', label: 'line length', default: 76, min: MIN_LINE, max: MAX_LINE }
  },
  apply: (input: any, params: any) => {
    const lineLength = numParam(params?.lineLength, 76)
    if (!Number.isFinite(lineLength) || lineLength < MIN_LINE || lineLength > MAX_LINE) {
      throw new Error(`lineLength must be a number between ${MIN_LINE} and ${MAX_LINE}`)
    }
    // One character of every line is reserved for the trailing soft-break `=`.
    const maxContent = Math.floor(lineLength) - 1

    const bytes = toBytes(input)
    if (bytes.length === 0) return ''

    return splitHardLines(bytes)
      .map((line) => wrapTokens(tokenize(line.bytes), maxContent) + line.eol)
      .join('')
  }
}

export default util
