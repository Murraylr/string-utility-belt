import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'url_encode',
  name: 'url encode',
  category: 'URL & JSON',
  description: 'encodeURIComponent for safe URL inclusion.',
  accepts: 'string',
  produces: 'string',
  tags: ['url', 'encode', 'percent encoding', 'uri', 'escape', 'percent-encoding'],
  aliases: ['encodeURIComponent', 'escape'],
  examples: [
    {
      title: 'reserved characters',
      input: 'hello world!',
      output: 'hello%20world!'
    },
    {
      title: 'unicode',
      input: 'café',
      output: 'caf%C3%A9'
    }
  ],
  params: {},
  apply: (input: any) => encodeURIComponent(String(input))
}
export default util
