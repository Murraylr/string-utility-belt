import type { Utility } from '@/types/utility'
import { md5, isBytes, textToUint8Array } from '../helpers'

const util: Utility = {
  id: 'md5',
  name: 'md5',
  category: 'Hashing',
  description: 'Compute the MD5 digest (not secure).',
  accepts: ['string','bytes'],
  produces: 'string',
  params: {},
  apply: (input: any) => {
    const s = isBytes(input) ? new TextDecoder().decode(input as Uint8Array) : String(input);
    return md5(s);
  }
}
export default util
