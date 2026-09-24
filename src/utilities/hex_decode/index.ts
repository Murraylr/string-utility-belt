import type { Utility } from '@/types/utility'
import { hexToBytes } from '@/utilities/helpers'
const util: Utility = {
  id: 'hex_decode',
  name: 'hex decode',
  category: 'Decoding',
  description: 'Decode hexadecimal string to bytes.',
  accepts: 'string',
  produces: 'bytes',
  params: {},
  apply: (input: string) => hexToBytes(String(input))
}
export default util
