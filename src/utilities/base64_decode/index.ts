import type { Utility } from '@/types/utility'
import { textToUint8Array, bytesToHex, hexToBytes, b64encode, b64decode, hashString, md5 } from '../helpers'
const util: Utility = {
  id: 'base64_decode',
  name: 'base64 decode',
  category: 'Decoding',
  description: 'Decode a Base64 string to UTF‑8 text.',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => b64decode(String(input))
}
export default util
