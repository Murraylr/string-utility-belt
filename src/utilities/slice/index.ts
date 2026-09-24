import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'slice',
  name: 'slice',
  category: 'String Ops',
  description: 'Return a substring by start/end indices (end non-inclusive).',
  accepts: 'string',
  produces: 'string',
  tags: ['substring', 'character slice', 'substr', 'slice text', 'start end index'],
  examples: [
    { title: 'slice a substring', input: 'Hello World', params: { start: 6, end: 11 }, output: 'World' }
  ],
  params: {
    start: { kind: 'number', label: 'start', default: 0, integer: true },
    end: { kind: 'number', label: 'end (optional)', default: 0, integer: true }
  },
  apply: (input: any, { start, end }: any) => {
    const s = String(input)
    const e = (end === 0 || end === '' || end == null) ? undefined : Number(end)
    return s.slice(Number(start)||0, e as any)
  }
}
export default util
