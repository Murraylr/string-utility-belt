import type { Utility } from '@/types/utility'
import { slugify } from '@/utilities/helpers'
const util: Utility = {
  id: 'slug',
  name: 'slug',
  category: 'Formatting',
  description: 'Convert to a URL-friendly slug (ASCII kebab-case).',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (s: string) => slugify(s)
}
export default util
