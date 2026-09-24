import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'url_decode',
  name: 'url decode',
  category: 'URL & JSON',
  description: 'decodeURIComponent for URL strings.',
  accepts: 'string',
  produces: 'string',
  tags: ['url', 'decode', 'percent decoding', 'uri', 'unescape', 'percent-encoding'],
  aliases: ['decodeURIComponent', 'unescape'],
  streamable: true,
  examples: [
    {
      title: 'percent-decode',
      input: 'hello%20world%21',
      output: 'hello world!'
    },
    {
      title: 'unicode',
      input: 'caf%C3%A9',
      output: 'café'
    }
  ],
  params: {},
  apply: (input: any) => decodeURIComponent(String(input))
}
export default util
