import type { Utility } from '@/types/utility'
import { bytesToHex, isBytes, textToUint8Array } from '@/utilities/helpers'
const util: Utility = {
  id: 'hex_encode',
  name: 'hex encode',
  category: 'Encoding',
  description: 'Encode UTF‑8 text or bytes to hexadecimal string.',
  accepts: ['string','bytes'],
  produces: 'string',
  params: {},
  apply: (input: any): string => bytesToHex(isBytes(input) ? input : textToUint8Array(String(input)))
}
export default util
