import type { Utility } from '@/types/utility'
import { b64decode } from '../helpers'
const util: Utility = {
  id: 'base64_decode',
  name: 'base64 decode',
  category: 'Decoding',
  description: 'Decode a Base64 string to UTF‑8 text.',
  accepts: 'string',
  produces: 'string',
  params: {},
  tags: ['base64', 'decode', 'atob', 'mime', 'binary', 'text'],
  aliases: ['atob'],
  examples: [
    {
      title: 'decode to text',
      input: 'aGVsbG8gd29ybGQ=',
      output: 'hello world'
    }
  ],
  apply: (input: any) => b64decode(String(input))
}
export default util
