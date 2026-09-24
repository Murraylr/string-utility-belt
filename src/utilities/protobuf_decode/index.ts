import type { Utility } from '@/types/utility'

type Field = { field: number; wireType: number; value: unknown }

const MAX_DEPTH = 16
const MAX_FIELD_NUMBER = 536870911n // 2^29 - 1
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER)

/** Keep 64-bit values exact: numbers when they fit, decimal strings otherwise. */
const numOrString = (v: bigint): number | string =>
  v >= MIN_SAFE && v <= MAX_SAFE ? Number(v) : v.toString()

const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')

class Reader {
  pos = 0
  data: Uint8Array

  constructor(data: Uint8Array) {
    this.data = data
  }

  varint(end: number): bigint {
    let result = 0n
    let shift = 0n
    for (let i = 0; i < 10; i++) {
      if (this.pos >= end) throw new Error(`truncated varint at offset ${this.pos}`)
      const b = this.data[this.pos++]
      // The 10th byte only carries bit 63; anything above that is not a
      // representable protobuf varint and must not be reported as a number.
      if (i === 9 && (b & 0x7f) > 1) throw new Error(`varint overflows 64 bits at offset ${this.pos - 1}`)
      result |= BigInt(b & 0x7f) << shift
      if ((b & 0x80) === 0) return result
      shift += 7n
    }
    throw new Error('varint is longer than 10 bytes')
  }

  take(n: number, end: number): Uint8Array {
    if (n < 0 || this.pos + n > end) throw new Error(`truncated field at offset ${this.pos}`)
    const out = this.data.subarray(this.pos, this.pos + n)
    this.pos += n
    return out
  }

  view(n: number, end: number): DataView {
    const bytes = this.take(n, end)
    return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
}

/** True when every code point is safe to show as text (tabs/newlines allowed). */
function isPrintable(s: string): boolean {
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number
    if (cp === 9 || cp === 10 || cp === 13) continue
    if (cp < 0x20 || cp === 0x7f) return false
    if (cp >= 0x80 && cp <= 0x9f) return false
  }
  return true
}

function tryUtf8(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

/**
 * Decode the fields between `r.pos` and `end`. When `groupField` is set we are
 * inside a (deprecated) group and stop at the matching end-group tag.
 */
function parseFields(r: Reader, end: number, depth: number, groupField: number | null): Field[] {
  const out: Field[] = []
  while (r.pos < end) {
    const tagBig = r.varint(end)
    const fieldBig = tagBig >> 3n
    if (fieldBig === 0n || fieldBig > MAX_FIELD_NUMBER) {
      throw new Error(`invalid field number ${fieldBig}`)
    }
    const field = Number(fieldBig)
    const wireType = Number(tagBig & 7n)

    switch (wireType) {
      case 0:
        out.push({ field, wireType, value: numOrString(r.varint(end)) })
        break
      case 1: {
        const dv = r.view(8, end)
        out.push({
          field,
          wireType,
          value: {
            uint64: numOrString(dv.getBigUint64(0, true)),
            int64: numOrString(dv.getBigInt64(0, true)),
            double: dv.getFloat64(0, true)
          }
        })
        break
      }
      case 2: {
        const lenBig = r.varint(end)
        if (lenBig > BigInt(end - r.pos)) throw new Error(`length-delimited field ${field} runs past the end of the buffer`)
        const bytes = r.take(Number(lenBig), end)
        out.push({ field, wireType, value: interpret(bytes, depth) })
        break
      }
      case 3:
        if (depth > MAX_DEPTH) throw new Error('group nesting is too deep')
        out.push({ field, wireType, value: parseFields(r, end, depth + 1, field) })
        break
      case 4:
        if (groupField !== null && field === groupField) return out
        throw new Error(`unexpected end-group tag for field ${field}`)
      case 5: {
        const dv = r.view(4, end)
        out.push({
          field,
          wireType,
          value: {
            uint32: dv.getUint32(0, true),
            int32: dv.getInt32(0, true),
            float: dv.getFloat32(0, true)
          }
        })
        break
      }
      default:
        throw new Error(`invalid wire type ${wireType} for field ${field}`)
    }
  }
  if (groupField !== null) throw new Error(`unterminated group for field ${groupField}`)
  return out
}

function tryMessage(bytes: Uint8Array, depth: number): Field[] | null {
  if (bytes.length === 0 || depth > MAX_DEPTH) return null
  try {
    const r = new Reader(bytes)
    const fields = parseFields(r, bytes.length, depth, null)
    return fields.length && r.pos === bytes.length ? fields : null
  } catch {
    return null
  }
}

/**
 * Length-delimited payloads are ambiguous. A payload that is entirely printable
 * UTF-8 is reported as a string, because short strings such as "hi" also parse
 * as (nonsense) messages — real nested messages practically always contain the
 * control bytes of their own tags. Otherwise we try a nested message, then hex.
 */
function interpret(bytes: Uint8Array, depth: number): unknown {
  if (bytes.length === 0) return ''
  const text = tryUtf8(bytes)
  if (text !== null && isPrintable(text)) return text
  const nested = tryMessage(bytes, depth + 1)
  if (nested) return nested
  return toHex(bytes)
}

/** Accept raw bytes, or a hex / base64 / base64url string (auto-detected). */
export function toBytes(input: unknown): Uint8Array {
  if (input instanceof Uint8Array) return input
  const raw = String(input ?? '')
  const s = raw.replace(/\s+/g, '')
  if (s === '') return new Uint8Array(0)
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    const out = new Uint8Array(s.length / 2)
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16)
    return out
  }
  if (/^[A-Za-z0-9+/\-_]+={0,2}$/.test(s)) {
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    try {
      const bin = atob(padded)
      const out = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
      return out
    } catch {
      throw new Error('input is not valid base64')
    }
  }
  throw new Error('expected protobuf bytes, or a hex / base64 encoded string')
}

const util: Utility = {
  id: 'protobuf_decode',
  name: 'protobuf wire decode',
  category: 'Data Formats',
  description:
    'Walk protobuf wire format without a schema, reporting each field number, wire type and value (nested messages, strings or hex).',
  accepts: ['string', 'bytes'],
  produces: 'json',
  params: {},
  tags: ['protobuf', 'proto', 'wire format', 'grpc', 'varint', 'binary', 'schemaless'],
  aliases: ['protoc --decode_raw'],
  examples: [
    {
      title: 'varint + string fields',
      input: '089601120568656c6c6f',
      inputEncoding: 'hex',
      output:
        '[\n  {\n    "field": 1,\n    "wireType": 0,\n    "value": 150\n  },\n  {\n    "field": 2,\n    "wireType": 2,\n    "value": "hello"\n  }\n]'
    },
    {
      title: 'single length-delimited field',
      input: '0a03666f6f',
      inputEncoding: 'hex',
      output: '[\n  {\n    "field": 1,\n    "wireType": 2,\n    "value": "foo"\n  }\n]'
    }
  ],
  apply: (input: any): any => {
    const bytes = toBytes(input)
    if (bytes.length === 0) return []
    const r = new Reader(bytes)
    return parseFields(r, bytes.length, 0, null)
  }
}

export default util
