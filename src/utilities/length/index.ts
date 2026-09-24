import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'length',
  name: 'length',
  category: 'Analysis',
  description: 'Return the length of the string.',
  accepts: 'string',
  produces: 'string',
  tags: ['string length', 'char count', 'size', 'strlen'],
  aliases: ['strlen', 'wc -c'],
  params: {},
  examples: [
    {
      title: 'a short word',
      input: 'hello',
      output: '5'
    }
  ],
  apply: (input: any) => String(String(input).length)
}
export default util
