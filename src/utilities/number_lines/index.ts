import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'number_lines',
  name: 'number lines',
  category: 'Formatting',
  description: 'Prefix each line with its line number.',
  accepts: 'string',
  produces: 'string',
  tags: ['line numbers', 'cat -n', 'nl', 'enumerate lines'],
  aliases: ['cat -n', 'nl'],
  examples: [{ title: 'default', input: 'a\nb\nc', output: '1: a\n2: b\n3: c' }],
  params: {
    start: { kind: 'number', label: 'start number', default: 1 },
    separator: { kind: 'string', label: 'separator', default: ': ' }
  },
  apply: (input: any, { start, separator }: any) => {
    const n = start != null && start !== '' ? Number(start) : 1
    const sep = separator ?? ': '
    return String(input)
      .split('\n')
      .map((line, i) => `${n + i}${sep}${line}`)
      .join('\n')
  }
}
export default util
