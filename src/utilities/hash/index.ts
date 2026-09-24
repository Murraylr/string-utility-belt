import type { Utility } from '@/types/utility'
import { hashString, isBytes } from '../helpers'
const util: Utility = {
  id: 'hash',
  name: 'hash',
  category: 'Hashing',
  description: 'Hash the input using WebCrypto (SHA‑1, SHA‑256, SHA‑384 or SHA‑512).',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['sha256', 'sha1', 'sha384', 'sha512', 'digest', 'checksum', 'webcrypto', 'fingerprint'],
  aliases: ['sha256sum', 'shasum'],
  examples: [
    { title: 'SHA-256', input: 'hello', params: { algo: 'SHA-256' }, output: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824' },
    { title: 'SHA-1', input: 'hello', params: { algo: 'SHA-1' }, output: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d' }
  ],
  params: {
    algo: {
      kind: 'select',
      label: 'algorithm',
      options: ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'],
      default: 'SHA-256'
    }
  },
  apply: async (input: any, { algo }: any) => {
    const data = isBytes(input) ? input : String(input)
    return await hashString(data, (algo || 'SHA-256') as AlgorithmIdentifier)
  }
}
export default util
