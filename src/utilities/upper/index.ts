import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'upper',
  name: 'uppercase',
  category: 'Formatting',
  description: 'Convert all letters to uppercase.',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => String(input).toUpperCase()
}
export default util
