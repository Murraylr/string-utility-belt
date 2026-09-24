import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/**
 * SHA-3 / Keccak digests via hash-wasm.
 *
 * SHA-3 (FIPS 202) and the original Keccak submission differ only in the
 * domain-separation padding byte, so the same widths are offered for both —
 * Keccak-256 is the variant used by Ethereum.
 */

type HashWasm = typeof import('hash-wasm')
let _hashWasm: HashWasm | null = null
const getHashWasm = async (): Promise<HashWasm> => (_hashWasm ??= await import('hash-wasm'))

type Bits = 224 | 256 | 384 | 512

const ALGORITHMS = [
  'SHA3-224',
  'SHA3-256',
  'SHA3-384',
  'SHA3-512',
  'Keccak-224',
  'Keccak-256',
  'Keccak-384',
  'Keccak-512'
] as const

const OUTPUTS = ['hex', 'base64', 'base64url'] as const

const toBytes = (input: unknown): Uint8Array =>
  isBytes(input) ? (input as Uint8Array) : new TextEncoder().encode(String(input ?? ''))

const hexToBase64 = (hex: string, urlSafe: boolean): string => {
  let bin = ''
  for (let i = 0; i < hex.length; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
  const b64 = btoa(bin)
  return urlSafe ? b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : b64
}

const formatDigest = (hex: string, output: string): string => {
  switch (output) {
    case 'hex':
      return hex
    case 'base64':
      return hexToBase64(hex, false)
    case 'base64url':
      return hexToBase64(hex, true)
    default:
      throw new Error(`unknown output format: ${output} (expected ${OUTPUTS.join(', ')})`)
  }
}

const util: Utility = {
  id: 'sha3',
  name: 'sha3 / keccak',
  category: 'Hashing',
  description:
    'Compute a SHA-3 or Keccak digest at 224, 256, 384, or 512 bits, output as hex, base64, or base64url.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  params: {
    algorithm: {
      kind: 'select',
      label: 'algorithm',
      options: [...ALGORITHMS],
      default: 'SHA3-256'
    },
    output: {
      kind: 'select',
      label: 'output',
      options: [...OUTPUTS],
      default: 'hex'
    }
  },
  tags: ['sha3', 'keccak', 'fips202', 'ethereum hash', 'digest', 'sha-3'],
  aliases: ['keccak256'],
  examples: [
    { title: 'SHA3-256', input: 'hello', params: { algorithm: 'SHA3-256', output: 'hex' }, output: '3338be694f50c5f338814986cdf0686453a888b84f424d792af4b9202398f392' },
    { title: 'Keccak-256', input: 'hello', params: { algorithm: 'Keccak-256', output: 'hex' }, output: '1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8' }
  ],
  apply: async (input: any, params: any) => {
    const algorithm = String(params?.algorithm ?? 'SHA3-256')
    const output = String(params?.output ?? 'hex')

    if (!(ALGORITHMS as readonly string[]).includes(algorithm)) {
      throw new Error(`unknown algorithm: ${algorithm} (expected ${ALGORITHMS.join(', ')})`)
    }
    if (!(OUTPUTS as readonly string[]).includes(output)) {
      throw new Error(`unknown output format: ${output} (expected ${OUTPUTS.join(', ')})`)
    }

    const data = toBytes(input)
    if (data.length === 0) return ''

    const bits = Number(algorithm.slice(algorithm.indexOf('-') + 1)) as Bits
    const hw = await getHashWasm()
    const hex = algorithm.startsWith('Keccak')
      ? await hw.keccak(data, bits)
      : await hw.sha3(data, bits)

    return formatDigest(hex, output)
  }
}

export default util
