import type { Utility } from '@/types/utility'
import { textToUint8Array, bytesToHex, hexToBytes, b64encode, b64decode, hashString, md5 } from '../helpers'
const util: Utility = {
  id: 'hex_encode',
  name: 'hex encode',
  category: 'Encoding',
  description: 'Encode UTF‑8 text or bytes to hexadecimal string.',
  accepts: ['string','bytes'],
  produces: 'string',
  params: {},
  apply: (input: any) => {
    const bytes = (input instanceof Uint8Array) ? input : textToUint8Array(String(input))
    return bytesToHex(bytes)
  }
}
export default util
