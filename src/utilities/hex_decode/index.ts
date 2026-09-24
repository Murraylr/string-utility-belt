import type { Utility } from '@/types/utility'
import { hexToBytes } from '../helpers'

const util: Utility = {
  id: 'hex_decode',
  name: 'hex decode',
  category: 'Decoding',
  description: 'Decode hexadecimal string to bytes.',
  accepts: 'string',
  produces: 'bytes',
  params: {},
  tags: ['hex', 'hexadecimal', 'decode', 'bytes', 'xxd', 'binary'],
  aliases: ['xxd -r'],
  examples: [
    {
      title: 'decode to bytes',
      input: '68656c6c6f',
      output: 'bytes[104, 101, 108, 108, 111]\nhex: [68, 65, 6c, 6c, 6f]\nutf8: hello'
    }
  ],
  apply: (input: any) => hexToBytes(String(input))
}
export default util
