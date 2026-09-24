import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'trim',
  name: 'trim',
  category: 'String Ops',
  description: 'Remove leading and trailing whitespace.',
  accepts: 'string',
  produces: 'string',
  tags: ['trim whitespace', 'strip spaces', 'leading trailing whitespace', 'whitespace cleanup'],
  examples: [
    { title: 'trim surrounding spaces', input: '   padded text   ', output: 'padded text' }
  ],
  params: {},
  apply: (input: any) => String(input).trim()
}
export default util
