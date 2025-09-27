import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'url_decode',
  name: 'url decode',
  category: 'URL & JSON',
  description: 'decodeURIComponent for URL strings.',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => decodeURIComponent(String(input))
}
export default util
