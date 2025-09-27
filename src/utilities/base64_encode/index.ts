import type { Utility } from '@/types/utility'
import { isBytes, textToUint8Array } from '../helpers'

function encodeBytes(u8: Uint8Array): string {
  let bin = ''; for (const b of u8) bin += String.fromCharCode(b);
  return btoa(bin);
}

const util: Utility = {
  id: 'base64_encode',
  name: 'base64 encode',
  category: 'Encoding',
  description: 'Encode UTF‑8 text or bytes to Base64 string.',
  accepts: ['string','bytes'],
  produces: 'string',
  params: {},
  apply: (input: any) => {
    if (isBytes(input)) return encodeBytes(input as Uint8Array);
    return encodeBytes(textToUint8Array(String(input)));
  }
}
export default util
