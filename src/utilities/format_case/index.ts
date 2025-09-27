import type { Utility } from '@/types/utility'
import { slugify, toCamel, toPascal, toSnake, toKebab } from '../helpers'
const util: Utility = {
  id: 'format_case',
  name: 'format case',
  category: 'Formatting',
  description: 'Convert to camelCase, PascalCase, snake_case, or kebab-case.',
  accepts: 'string',
  produces: 'string',
  params: { mode: { kind: 'select', label: 'mode', options: ['camel','pascal','snake','kebab'], default: 'camel' } },
  apply: (input: any, { mode }: any) => {
    const s = String(input)
    if (mode === 'camel') return toCamel(s)
    if (mode === 'pascal') return toPascal(s)
    if (mode === 'snake') return toSnake(s)
    return toKebab(s)
  }
}
export default util
