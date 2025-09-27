import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'trim',
  name: 'trim',
  category: 'String Ops',
  description: 'Remove leading and trailing whitespace.',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => String(input).trim()
}
export default util
