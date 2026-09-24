import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/**
 * BLAKE2b / BLAKE2s / BLAKE3 digests via hash-wasm.
 *
 * All three families support keyed hashing (a built-in MAC). The key is read as
 * UTF-8 text; BLAKE2b allows up to 64 bytes, BLAKE2s up to 32, and BLAKE3
 * requires exactly 32.
 */

type HashWasm = typeof import('hash-wasm')
let _hashWasm: HashWasm | null = null
const getHashWasm = async (): Promise<HashWasm> => (_hashWasm ??= await import('hash-wasm'))

const ALGORITHMS = ['BLAKE2b-256', 'BLAKE2b-512', 'BLAKE2s-128', 'BLAKE2s-256', 'BLAKE3-256'] as const
const OUTPUTS = ['hex', 'base64'] as const

/** family, digest bits, maximum key length in bytes, exact key length if required */
const SPECS: Record<string, { family: 'blake2b' | 'blake2s' | 'blake3'; bits: number; maxKey: number; exactKey?: number }> = {
  'BLAKE2b-256': { family: 'blake2b', bits: 256, maxKey: 64 },
  'BLAKE2b-512': { family: 'blake2b', bits: 512, maxKey: 64 },
  'BLAKE2s-128': { family: 'blake2s', bits: 128, maxKey: 32 },
  'BLAKE2s-256': { family: 'blake2s', bits: 256, maxKey: 32 },
  'BLAKE3-256': { family: 'blake3', bits: 256, maxKey: 32, exactKey: 32 }
}

const toBytes = (input: unknown): Uint8Array =>
  isBytes(input) ? (input as Uint8Array) : new TextEncoder().encode(String(input ?? ''))

const hexToBase64 = (hex: string): string => {
  let bin = ''
  for (let i = 0; i < hex.length; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  return btoa(bin)
}

const util: Utility = {
  id: 'blake',
  name: 'blake hash',
  category: 'Hashing',
  description:
    'Compute a BLAKE2b, BLAKE2s, or BLAKE3 digest, optionally keyed with a secret, output as hex or base64.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['hash', 'digest', 'blake2', 'blake3', 'mac', 'keyed hash'],
  aliases: ['b2sum', 'b3sum'],
  examples: [
    {
      title: 'BLAKE2b-256 of "hello"',
      input: 'hello',
      output: '324dcf027dd4a30a932c441f365a25e86b173defa4b8e58948253471b81b72cf'
    },
    {
      title: 'BLAKE3-256, keyed',
      input: 'hello',
      params: { algorithm: 'BLAKE3-256', key: 'abcdefghijklmnopqrstuvwxyz012345' },
      output: 'ebfd8681bea377568769ba0620b040a6809a6c4cc18bb64116498fb1b392ea75'
    }
  ],
  params: {
    algorithm: {
      kind: 'select',
      label: 'algorithm',
      options: [...ALGORITHMS],
      default: 'BLAKE2b-256'
    },
    key: {
      kind: 'string',
      label: 'key (optional)',
      default: '',
      placeholder: 'leave empty for an unkeyed hash'
    },
    output: {
      kind: 'select',
      label: 'output',
      options: [...OUTPUTS],
      default: 'hex'
    }
  },
  apply: async (input: any, params: any) => {
    const algorithm = String(params?.algorithm ?? 'BLAKE2b-256')
    const output = String(params?.output ?? 'hex')
    const keyText = String(params?.key ?? '')

    const spec = SPECS[algorithm]
    if (!spec) {
      throw new Error(`unknown algorithm: ${algorithm} (expected ${ALGORITHMS.join(', ')})`)
    }
    if (!(OUTPUTS as readonly string[]).includes(output)) {
      throw new Error(`unknown output format: ${output} (expected ${OUTPUTS.join(', ')})`)
    }

    let key: Uint8Array | undefined
    if (keyText !== '') {
      key = new TextEncoder().encode(keyText)
      if (spec.exactKey !== undefined && key.length !== spec.exactKey) {
        throw new Error(
          `${algorithm} requires a key of exactly ${spec.exactKey} bytes (got ${key.length})`
        )
      }
      if (key.length > spec.maxKey) {
        throw new Error(`${algorithm} keys may be at most ${spec.maxKey} bytes (got ${key.length})`)
      }
    }

    const data = toBytes(input)
    if (data.length === 0) return ''

    const hw = await getHashWasm()
    let hex: string
    if (spec.family === 'blake2b') hex = await hw.blake2b(data, spec.bits, key)
    else if (spec.family === 'blake2s') hex = await hw.blake2s(data, spec.bits, key)
    else hex = await hw.blake3(data, spec.bits, key)

    return output === 'base64' ? hexToBase64(hex) : hex
  }
}

export default util
