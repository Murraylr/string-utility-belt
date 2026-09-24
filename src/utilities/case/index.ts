import type { Utility } from '@/types/utility'
import { normalizeCase } from '../helpers'

const util: Utility = {
  id: 'case',
  name: 'change case',
  category: 'Formatting',
  description: 'Change letter casing to upper, lower, or title case.',
  accepts: 'string',
  produces: 'string',
  tags: ['uppercase', 'lowercase', 'titlecase', 'sentence case', 'caps', 'capitalize'],
  aliases: ['toUpperCase', 'toLowerCase'],
  examples: [
    { title: 'upper', input: 'hello world', params: { mode: 'upper' }, output: 'HELLO WORLD' },
    { title: 'title', input: 'hello world', params: { mode: 'title' }, output: 'Hello World' }
  ],
  params: {
    mode: { kind: 'select', label: 'Mode', options: ['upper','lower','title', 'sentence'], default: 'upper' }
  },
  apply: (input: unknown, params: { mode?: 'upper'|'lower'|'title' } = {}) => {
    const mode = params.mode ?? 'upper'
    return normalizeCase(String(input ?? ''), mode)
  }
}
export default util
