import type { Utility } from '@/types/utility'
import { textToUint8Array, bytesToHex, hexToBytes, b64encode, b64decode, hashString, md5 } from '../helpers'
const util: Utility = {
  id: 'hash',
  name: 'hash',
  category: 'Hashing',
  description: 'Hash the input using WebCrypto (SHA‑256 or SHA‑384).',
  accepts: 'string',
  produces: 'string',
  params: {
    algo: { kind: 'select', label: 'algorithm', options: ['SHA-256','SHA-384'], default: 'SHA-256' }
  },
  apply: async (input: any, { algo }: any) => {
    return await hashString(String(input), (algo || 'SHA-256') as AlgorithmIdentifier)
  }
}
export default util
