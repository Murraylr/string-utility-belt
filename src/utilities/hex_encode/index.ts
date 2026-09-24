import type { Utility } from '@/types/utility'
import { bytesToHex, textToUint8Array, isBytes } from '../helpers'

const util: Utility = {
  id: 'hex_encode',
  name: 'hex encode',
  category: 'Encoding',
  description: 'Encode UTF‑8 text or bytes to hexadecimal string.',
  accepts: ['string','bytes'],
  produces: 'string',
  tags: ['hex', 'hexadecimal', 'encode', 'bytes', 'binary'],
  aliases: ['xxd', 'bin2hex'],
  params: {},
  examples: [
    { title: 'text to hex', input: 'Hi', output: '4869' }
  ],
  apply: (input: any): string => {
    if (isBytes(input)) return bytesToHex(input);
    return bytesToHex(textToUint8Array(String(input)));
  }
}
export default util
