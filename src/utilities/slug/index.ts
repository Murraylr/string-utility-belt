import type { Utility } from '@/types/utility'
import { slugify, toCamel, toPascal, toSnake, toKebab } from '../helpers'
const util: Utility = {
  id: 'slug',
  name: 'slug',
  category: 'Formatting',
  description: 'Convert to a URL-friendly slug (ASCII kebab-case).',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => slugify(String(input))
}
export default util
