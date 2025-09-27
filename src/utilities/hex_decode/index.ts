import type { Utility } from '@/types/utility'
import { textToUint8Array, bytesToHex, hexToBytes, b64encode, b64decode, hashString, md5 } from '../helpers'
const util: Utility = {
  id: 'hex_decode',
  name: 'hex decode',
  category: 'Decoding',
  description: 'Decode hexadecimal string to bytes.',
  accepts: 'string',
  produces: 'bytes',
  params: {},
  apply: (input: any) => {
    return hexToBytes(String(input))
  }
}
export default util
