import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'uppercase',
  name: 'uppercase',
  category: 'Formatting',
  description: 'Convert to UPPERCASE (legacy id).',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => String(input).toUpperCase()
}
export default util
