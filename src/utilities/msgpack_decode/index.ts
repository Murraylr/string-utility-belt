import type { Utility } from '@/types/utility'

// ignoreBOM: every str is its own UTF-8 payload, so a leading EF BB BF is content, not a signature to drop
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })

const toHex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('')

/**
 * 64-bit integers that fit in a JS number come back as numbers; anything larger
 * becomes an exact decimal string so no precision is silently lost (and so the
 * result stays JSON-serialisable).
 */
const fromBig = (n: bigint): number | string =>
  n >= BigInt(Number.MIN_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(n) : n.toString()

class Reader {
  pos = 0
  private data: Uint8Array
  private view: DataView

  constructor(data: Uint8Array) {
    this.data = data
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  }

  get done() {
    return this.pos >= this.data.length
  }

  private need(n: number) {
    if (this.pos + n > this.data.length) {
      throw new Error(`truncated msgpack data: needed ${n} more byte(s) at offset ${this.pos}`)
    }
  }

  u8() {
    this.need(1)
    return this.data[this.pos++]
  }

  u16() {
    this.need(2)
    const v = this.view.getUint16(this.pos, false)
    this.pos += 2
    return v
  }

  u32() {
    this.need(4)
    const v = this.view.getUint32(this.pos, false)
    this.pos += 4
    return v
  }

  i8() {
    this.need(1)
    const v = this.view.getInt8(this.pos)
    this.pos += 1
    return v
  }

  i16() {
    this.need(2)
    const v = this.view.getInt16(this.pos, false)
    this.pos += 2
    return v
  }

  i32() {
    this.need(4)
    const v = this.view.getInt32(this.pos, false)
    this.pos += 4
    return v
  }

  u64() {
    this.need(8)
    const v = this.view.getBigUint64(this.pos, false)
    this.pos += 8
    return v
  }

  i64() {
    this.need(8)
    const v = this.view.getBigInt64(this.pos, false)
    this.pos += 8
    return v
  }

  f32() {
    this.need(4)
    const v = this.view.getFloat32(this.pos, false)
    this.pos += 4
    return v
  }

  f64() {
    this.need(8)
    const v = this.view.getFloat64(this.pos, false)
    this.pos += 8
    return v
  }

  slice(n: number) {
    this.need(n)
    const out = this.data.slice(this.pos, this.pos + n)
    this.pos += n
    return out
  }

  str(n: number) {
    const bytes = this.slice(n)
    try {
      return UTF8.decode(bytes)
    } catch {
      throw new Error(`invalid UTF-8 in msgpack string at offset ${this.pos - n}`)
    }
  }
}

function readValue(r: Reader): unknown {
  const b = r.u8()

  if (b <= 0x7f) return b
  if (b >= 0xe0) return b - 256
  if (b >= 0x80 && b <= 0x8f) return readMap(r, b & 0x0f)
  if (b >= 0x90 && b <= 0x9f) return readArray(r, b & 0x0f)
  if (b >= 0xa0 && b <= 0xbf) return r.str(b & 0x1f)

  switch (b) {
    case 0xc0: return null
    case 0xc1: throw new Error('invalid msgpack: byte 0xc1 is reserved')
    case 0xc2: return false
    case 0xc3: return true
    case 0xc4: return r.slice(r.u8())
    case 0xc5: return r.slice(r.u16())
    case 0xc6: return r.slice(r.u32())
    case 0xc7: return readExt(r, r.u8())
    case 0xc8: return readExt(r, r.u16())
    case 0xc9: return readExt(r, r.u32())
    case 0xca: return r.f32()
    case 0xcb: return r.f64()
    case 0xcc: return r.u8()
    case 0xcd: return r.u16()
    case 0xce: return r.u32()
    case 0xcf: return fromBig(r.u64())
    case 0xd0: return r.i8()
    case 0xd1: return r.i16()
    case 0xd2: return r.i32()
    case 0xd3: return fromBig(r.i64())
    case 0xd4: return readExt(r, 1)
    case 0xd5: return readExt(r, 2)
    case 0xd6: return readExt(r, 4)
    case 0xd7: return readExt(r, 8)
    case 0xd8: return readExt(r, 16)
    case 0xd9: return r.str(r.u8())
    case 0xda: return r.str(r.u16())
    case 0xdb: return r.str(r.u32())
    case 0xdc: return readArray(r, r.u16())
    case 0xdd: return readArray(r, r.u32())
    case 0xde: return readMap(r, r.u16())
    case 0xdf: return readMap(r, r.u32())
    default: throw new Error(`unsupported msgpack byte 0x${b.toString(16)}`)
  }
}

function readArray(r: Reader, len: number): unknown[] {
  const out: unknown[] = []
  for (let i = 0; i < len; i++) out.push(readValue(r))
  return out
}

function readMap(r: Reader, len: number): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (let i = 0; i < len; i++) {
    const key = readValue(r)
    const value = readValue(r)
    // defineProperty, not `out[key] = value`: a map key of `__proto__` is an
    // ordinary key in MessagePack, and plain assignment would silently discard
    // it (or repoint the prototype) instead of storing it.
    Object.defineProperty(out, typeof key === 'string' ? key : keyToString(key), {
      value,
      enumerable: true,
      writable: true,
      configurable: true
    })
  }
  return out
}

function keyToString(key: unknown): string {
  if (key === null) return 'null'
  if (typeof key === 'number' || typeof key === 'boolean') return String(key)
  if (key instanceof Uint8Array) return toHex(key)
  return JSON.stringify(key) ?? String(key)
}

/** Extension types are surfaced as `{ type, data }` with the payload in hex. */
function readExt(r: Reader, len: number): { type: number; data: string } {
  const type = r.i8()
  return { type, data: toHex(r.slice(len)) }
}

const util: Utility = {
  id: 'msgpack_decode',
  name: 'msgpack decode',
  category: 'Data Formats',
  description: 'Decode MessagePack binary into JSON, surfacing extension types as { type, data } hex pairs.',
  accepts: 'bytes',
  produces: 'json',
  tags: ['msgpack', 'messagepack', 'binary', 'decode', 'deserialize'],
  examples: [
    {
      title: 'decode a two-field map',
      input: '82a2696401a46e616d65a3416461',
      inputEncoding: 'hex',
      output: '{\n  "id": 1,\n  "name": "Ada"\n}'
    }
  ],
  params: {},
  apply: (input: any): any => {
    const bytes: Uint8Array =
      input instanceof Uint8Array ? input : new TextEncoder().encode(String(input ?? ''))
    if (bytes.length === 0) return ''
    const r = new Reader(bytes)
    const value = readValue(r)
    if (!r.done) {
      throw new Error(`trailing data after the msgpack value (${bytes.length - r.pos} unread byte(s))`)
    }
    return value
  }
}

export default util
