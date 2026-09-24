import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'remove_blank_lines',
  name: 'remove blank lines',
  category: 'String Ops',
  description: 'Remove empty or whitespace-only lines.',
  accepts: 'string',
  produces: 'string',
  tags: ['blank lines', 'empty lines', 'whitespace lines', 'clean up text', 'remove empty lines'],
  examples: [
    { title: 'blank and whitespace-only lines', input: 'a\n\nb\n   \nc', output: 'a\nb\nc' }
  ],
  params: {},
  apply: (input: any) => {
    return String(input)
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n')
  }
}
export default util
