import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'line_dedupe',
  name: 'deduplicate lines',
  category: 'Formatting',
  description: 'Remove duplicate lines, preserving first occurrence.',
  accepts: 'string',
  produces: 'string',
  tags: ['unique lines', 'dedupe', 'distinct', 'duplicate removal', 'uniq'],
  aliases: ['uniq'],
  examples: [{ title: 'default', input: 'a\nb\na\nc', output: 'a\nb\nc' }],
  params: {
    caseSensitive: { kind: 'boolean', label: 'case sensitive', default: true }
  },
  apply: (input: any, { caseSensitive }: any) => {
    const lines = String(input).split('\n')
    const seen = new Set<string>()
    return lines.filter(line => {
      const key = caseSensitive !== false ? line : line.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).join('\n')
  }
}
export default util
