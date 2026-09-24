import type { Utility } from '@/types/utility'
import { bytesToHex } from '../helpers'

/** crypto.getRandomValues rejects requests larger than 65536 bytes, so fill in chunks. */
const CRYPTO_CHUNK = 65536
const MAX_COUNT = 1048576

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeBytes(count: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(count)
  if (seed === 0) {
    for (let off = 0; off < count; off += CRYPTO_CHUNK) {
      crypto.getRandomValues(bytes.subarray(off, Math.min(off + CRYPTO_CHUNK, count)))
    }
  } else {
    const rng = mulberry32(seed)
    for (let i = 0; i < count; i++) bytes[i] = Math.floor(rng() * 256)
  }
  return bytes
}

const toBase64 = (bytes: Uint8Array): string => {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

const toBase64Url = (bytes: Uint8Array): string =>
  toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const toCArray = (bytes: Uint8Array): string => {
  const items = Array.from(bytes).map((b) => `0x${b.toString(16).padStart(2, '0')}`)
  return `uint8_t data[${bytes.length}] = { ${items.join(', ')} };`
}

const util: Utility = {
  id: 'random_bytes',
  name: 'random bytes',
  category: 'Generators',
  description:
    'Generate random bytes and render them as hex, base64, base64url, decimal, a C array, or raw bytes, optionally from a fixed seed.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  tags: ['random', 'entropy', 'crypto', 'key', 'nonce', 'salt', 'csprng'],
  aliases: ['urandom', 'openssl rand'],
  examples: [
    {
      title: 'seeded bytes as hex',
      input: '',
      params: { count: 8, output: 'hex', seed: 42 },
      output: '9972daab2c86459f'
    },
    {
      title: 'same bytes as a C array',
      input: '',
      params: { count: 4, output: 'c-array', seed: 42 },
      output: 'uint8_t data[4] = { 0x99, 0x72, 0xda, 0xab };'
    }
  ],
  params: {
    count: { kind: 'number', label: 'count', default: 16, min: 0, max: MAX_COUNT, integer: true },
    output: {
      kind: 'select',
      label: 'output',
      options: ['hex', 'base64', 'base64url', 'decimal', 'c-array', 'bytes'],
      default: 'hex'
    },
    seed: { kind: 'number', label: 'seed (0 = crypto random)', default: 0 }
  },
  apply: (_input: any, p: any) => {
    const params = p ?? {}
    const count = Math.floor(Number(params.count ?? 16))
    const output = String(params.output ?? 'hex')
    const seedRaw = Number(params.seed ?? 0)
    const seed = Number.isFinite(seedRaw) ? Math.floor(seedRaw) : 0

    if (!Number.isFinite(count) || count < 0) throw new Error('count must be zero or more')
    if (count > MAX_COUNT) throw new Error(`count must be ${MAX_COUNT} or less`)

    const bytes = makeBytes(count, seed)

    switch (output) {
      case 'hex':
        return bytesToHex(bytes)
      case 'base64':
        return toBase64(bytes)
      case 'base64url':
        return toBase64Url(bytes)
      case 'decimal':
        return Array.from(bytes).join(' ')
      case 'c-array':
        return count === 0 ? '' : toCArray(bytes)
      case 'bytes':
        return bytes
      default:
        throw new Error(`unknown output "${output}"`)
    }
  }
}

export default util
