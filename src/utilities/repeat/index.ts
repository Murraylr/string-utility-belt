import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'repeat',
  name: 'repeat',
  category: 'String Ops',
  description: 'Repeat the string N times with an optional separator.',
  accepts: 'string',
  produces: 'string',
  tags: ['duplicate string', 'repeat text', 'multiply text', 'copies', 'repeat n times'],
  examples: [
    { title: 'repeat with a separator', input: 'ab', params: { count: 3, separator: '-' }, output: 'ab-ab-ab' }
  ],
  params: {
    count: { kind: 'number', label: 'count', default: 2, min: 0, integer: true, max: 10000 },
    separator: { kind: 'string', label: 'separator', default: '' }
  },
  apply: (input: any, { count, separator }: any) => {
    const s = String(input)
    const n = Math.max(0, Math.floor(Number(count) || 0))
    const sep = separator ?? ''
    return Array(n).fill(s).join(sep)
  }
}
export default util
