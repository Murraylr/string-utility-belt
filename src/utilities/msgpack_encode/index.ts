import type { StepContext, Utility } from '@/types/utility'

const TEXT = new TextEncoder()

class Writer {
  private buf: number[] = []

  byte(b: number) {
    this.buf.push(b & 0xff)
  }

  bytes(arr: ArrayLike<number>) {
    for (let i = 0; i < arr.length; i++) this.buf.push(arr[i] & 0xff)
  }

  u16(n: number) {
    this.byte(n >>> 8)
    this.byte(n)
  }

  u32(n: number) {
    this.byte(n >>> 24)
    this.byte(n >>> 16)
    this.byte(n >>> 8)
    this.byte(n)
  }

  u64(n: bigint) {
    const v = BigInt.asUintN(64, n)
    for (let shift = 56n; shift >= 0n; shift -= 8n) this.byte(Number((v >> shift) & 0xffn))
  }

  f64(n: number) {
    const dv = new DataView(new ArrayBuffer(8))
    dv.setFloat64(0, n, false)
    for (let i = 0; i < 8; i++) this.byte(dv.getUint8(i))
  }

  result(): Uint8Array {
    return new Uint8Array(this.buf)
  }
}

function writeLength(w: Writer, len: number, fixMask: number, fixMax: number, c8: number | null, c16: number, c32: number) {
  if (len < fixMax) {
    w.byte(fixMask | len)
  } else if (c8 !== null && len < 0x100) {
    w.byte(c8)
    w.byte(len)
  } else if (len < 0x10000) {
    w.byte(c16)
    w.u16(len)
  } else {
    w.byte(c32)
    w.u32(len)
  }
}

function writeInt(w: Writer, n: number) {
  if (n >= 0) {
    if (n < 0x80) w.byte(n)
    else if (n < 0x100) { w.byte(0xcc); w.byte(n) }
    else if (n < 0x10000) { w.byte(0xcd); w.u16(n) }
    else if (n < 0x100000000) { w.byte(0xce); w.u32(n) }
    else { w.byte(0xcf); w.u64(BigInt(n)) }
  } else {
    if (n >= -32) w.byte(0xe0 | (n + 32))
    else if (n >= -0x80) { w.byte(0xd0); w.byte(n & 0xff) }
    else if (n >= -0x8000) { w.byte(0xd1); w.u16(n & 0xffff) }
    else if (n >= -0x80000000) { w.byte(0xd2); w.u32(n >>> 0) }
    else { w.byte(0xd3); w.u64(BigInt(n)) }
  }
}

function writeBigInt(w: Writer, n: bigint) {
  if (n >= 0n) {
    if (n > 0xffffffffffffffffn) throw new Error('integer too large for msgpack (max 64-bit)')
    if (n < 0x80n) w.byte(Number(n))
    else if (n <= 0xffffffffn) writeInt(w, Number(n))
    else { w.byte(0xcf); w.u64(n) }
  } else {
    if (n < -0x8000000000000000n) throw new Error('integer too small for msgpack (min 64-bit)')
    if (n >= -0x80000000n) writeInt(w, Number(n))
    else { w.byte(0xd3); w.u64(n) }
  }
}

function encodeValue(w: Writer, value: unknown, seen: Set<object>) {
  if (value === null || value === undefined) {
    w.byte(0xc0)
    return
  }
  if (typeof value === 'boolean') {
    w.byte(value ? 0xc3 : 0xc2)
    return
  }
  if (typeof value === 'number') {
    if (Number.isInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) writeInt(w, value)
    else { w.byte(0xcb); w.f64(value) }
    return
  }
  if (typeof value === 'bigint') {
    writeBigInt(w, value)
    return
  }
  if (typeof value === 'string') {
    const bytes = TEXT.encode(value)
    writeLength(w, bytes.length, 0xa0, 32, 0xd9, 0xda, 0xdb)
    w.bytes(bytes)
    return
  }
  if (value instanceof Uint8Array) {
    const len = value.length
    if (len < 0x100) { w.byte(0xc4); w.byte(len) }
    else if (len < 0x10000) { w.byte(0xc5); w.u16(len) }
    else { w.byte(0xc6); w.u32(len) }
    w.bytes(value)
    return
  }
  if (typeof value === 'object') {
    if (seen.has(value as object)) throw new Error('cannot encode circular structure')
    seen.add(value as object)
    try {
      if (Array.isArray(value)) {
        writeLength(w, value.length, 0x90, 16, null, 0xdc, 0xdd)
        for (const item of value) encodeValue(w, item, seen)
      } else {
        const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined)
        writeLength(w, entries.length, 0x80, 16, null, 0xde, 0xdf)
        for (const [k, v] of entries) {
          encodeValue(w, k, seen)
          encodeValue(w, v, seen)
        }
      }
    } finally {
      seen.delete(value as object)
    }
    return
  }
  throw new Error(`cannot encode value of type ${typeof value} as msgpack`)
}

const util: Utility = {
  id: 'msgpack_encode',
  name: 'msgpack encode',
  category: 'Data Formats',
  description: 'Encode JSON into MessagePack binary (nil, bool, int, float64, str, bin, array and map).',
  accepts: 'json',
  produces: 'bytes',
  tags: ['msgpack', 'messagepack', 'binary', 'encode', 'serialize'],
  examples: [
    {
      title: 'encode a two-field map',
      input: '{"id":1,"name":"Ada"}',
      inputEncoding: 'json',
      output:
        'bytes[130, 162, 105, 100, 01, 164, 110, 97, 109, 101, 163, 65, 100, 97]\nhex: [82, a2, 69, 64, 01, a4, 6e, 61, 6d, 65, a3, 41, 64, 61]\nutf8: ��id\u0001�name�Ada'
    }
  ],
  params: {},
  apply: (input: any, _params: any, ctx?: StepContext): any => {
    let value: unknown = input
    if (typeof value === 'string') {
      // an empty box is not an error the user needs to see yet
      if (value.trim() === '') return new Uint8Array(0)
      // The runner (which always passes a ctx) has already parsed JSON text, so a string
      // here is a JSON string value: `"42"` must stay the string "42", not become 42.
      // Only a direct call still needs the parse.
      if (!ctx) {
        try {
          value = JSON.parse(value)
        } catch {
          // not JSON — encode the raw text as a msgpack string
        }
      }
    }
    const w = new Writer()
    encodeValue(w, value, new Set<object>())
    return w.result()
  }
}

export default util
