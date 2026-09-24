import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'reverse',
  name: 'reverse',
  category: 'String Ops',
  description: 'Reverse characters in the string.',
  accepts: 'string',
  produces: 'string',
  tags: ['reverse string', 'flip text', 'mirror text', 'backwards text'],
  examples: [
    { title: 'reverse a word', input: 'hello', output: 'olleh' }
  ],
  params: {},
  apply: (input: any) => [...String(input)].reverse().join('')
}
export default util
