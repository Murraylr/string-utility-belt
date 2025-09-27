import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'url_encode',
  name: 'url encode',
  category: 'URL & JSON',
  description: 'encodeURIComponent for safe URL inclusion.',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => encodeURIComponent(String(input))
}
export default util
