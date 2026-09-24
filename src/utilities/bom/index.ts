import type { Utility, Value } from '@/types/utility'
import { isBytes } from '../helpers'

type Signature = { encoding: string; bytes: number[] }

/** Longest first: the utf-32le mark starts with the utf-16le mark. */
const SIGNATURES: Signature[] = [
  { encoding: 'utf-32le', bytes: [0xff, 0xfe, 0x00, 0x00] },
  { encoding: 'utf-32be', bytes: [0x00, 0x00, 0xfe, 0xff] },
  { encoding: 'utf-8', bytes: [0xef, 0xbb, 0xbf] },
  { encoding: 'utf-16le', bytes: [0xff, 0xfe] },
  { encoding: 'utf-16be', bytes: [0xfe, 0xff] }
]

const ADDABLE: Record<string, number[]> = {
  'utf-8': [0xef, 0xbb, 0xbf],
  'utf-16le': [0xff, 0xfe],
  'utf-16be': [0xfe, 0xff]
}

const MODES = ['detect', 'add', 'remove']
const ENCODINGS = Object.keys(ADDABLE)
const BOM_CHAR = '\uFEFF'

const toHex = (bytes: number[]) =>
  bytes.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')

function detectInBytes(bytes: Uint8Array): Signature | null {
  for (const sig of SIGNATURES) {
    if (bytes.length < sig.bytes.length) continue
    if (sig.bytes.every((b, i) => bytes[i] === b)) return sig
  }
  return null
}

/**
 * A JS string carries its BOM as the single character U+FEFF. A string that is
 * really a raw byte view (a file pasted as latin-1 text) still carries the mark
 * as its literal bytes — `ï»¿` — so check that view too.
 */
function detectInString(s: string): Signature | null {
  if (s.startsWith(BOM_CHAR)) return SIGNATURES.find(sig => sig.encoding === 'utf-8') as Signature
  const units: number[] = []
  for (let i = 0; i < Math.min(4, s.length); i++) {
    const unit = s.charCodeAt(i)
    // a unit above 0xFF cannot be part of a byte-view mark; stop collecting but
    // still test what we have — `ï»¿😀` is a utf-8 mark followed by real text
    if (unit > 0xff) break
    units.push(unit)
  }
  return detectInBytes(new Uint8Array(units))
}

function stripString(s: string): string {
  if (s.startsWith(BOM_CHAR)) return s.slice(1)
  const sig = detectInString(s)
  return sig ? s.slice(sig.bytes.length) : s
}

function stripBytes(bytes: Uint8Array): Uint8Array {
  const sig = detectInBytes(bytes)
  return sig ? bytes.slice(sig.bytes.length) : bytes
}

const util: Utility = {
  id: 'bom',
  name: 'byte order mark',
  category: 'Encoding',
  description:
    'Detect, add or remove a byte order mark; detect reports the encoding and its bytes, add prepends the mark for utf-8, utf-16le or utf-16be, and remove strips whichever mark is present.',
  accepts: ['string', 'bytes'],
  produces: ['string', 'bytes', 'json'],
  tags: ['bom', 'byte order mark', 'utf-8', 'utf-16', 'detect', 'encoding'],
  params: {
    mode: { kind: 'select', label: 'mode', options: MODES, default: 'detect' },
    encoding: { kind: 'select', label: 'encoding (add)', options: ENCODINGS, default: 'utf-8' }
  },
  examples: [
    {
      title: 'detect a UTF-8 mark',
      input: 'efbbbf68656c6c6f',
      inputEncoding: 'hex',
      params: { mode: 'detect' },
      output: '{\n  "found": true,\n  "encoding": "utf-8",\n  "bytes": "EF BB BF"\n}'
    },
    { title: 'add a UTF-8 mark', input: 'hello', params: { mode: 'add', encoding: 'utf-8' }, output: '﻿hello' },
    {
      title: 'remove a mark',
      input: 'efbbbf68656c6c6f',
      inputEncoding: 'hex',
      params: { mode: 'remove' },
      output: 'bytes[104, 101, 108, 108, 111]\nhex: [68, 65, 6c, 6c, 6f]\nutf8: hello'
    }
  ],
  apply: (input: any, params: any): Value => {
    const mode = String(params?.mode || 'detect')
    if (!MODES.includes(mode)) throw new Error(`unknown mode: ${mode}`)
    const encoding = String(params?.encoding || 'utf-8').toLowerCase()

    const bytesInput = isBytes(input)
    const text = bytesInput ? '' : String(input ?? '')

    if (mode === 'detect') {
      const sig = bytesInput ? detectInBytes(input as Uint8Array) : detectInString(text)
      return {
        found: sig !== null,
        encoding: sig ? sig.encoding : null,
        bytes: sig ? toHex(sig.bytes) : ''
      }
    }

    if (mode === 'remove') {
      return bytesInput ? stripBytes(input as Uint8Array) : stripString(text)
    }

    // add — replace any existing mark so the operation is idempotent
    if (!ENCODINGS.includes(encoding)) throw new Error(`unknown bom encoding: ${encoding}`)
    if (bytesInput) {
      const body = stripBytes(input as Uint8Array)
      const mark = ADDABLE[encoding]
      const out = new Uint8Array(mark.length + body.length)
      out.set(mark, 0)
      out.set(body, mark.length)
      return out
    }
    // at character level the mark is U+FEFF for every encoding; the chosen
    // encoding only decides the bytes, which is the `bytes` input path above
    return BOM_CHAR + stripString(text)
  }
}

export default util
