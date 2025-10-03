import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'hex_decode',
  name: 'hex decode',
  category: 'Decoding',
  description: 'Decode hexadecimal string to bytes.',
  accepts: 'string',
  produces: 'bytes',
  params: {},
  apply: (input: string) => {
    return input.split(/(\w\w)/g)
      .filter((p) => !!p)
      .map(c => String.fromCharCode(parseInt(c, 16)))
      .join("")
  }
}
export default util
