import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'json_unescape',
  name: 'JSON unescape',
  category: 'Decoding',
  description: 'Unescape a JSON-encoded string.',
  accepts: 'string',
  produces: 'string',
  params: {},
  tags: ['json', 'unescape', 'decode', 'string literal', 'escape sequences'],
  examples: [
    {
      title: 'newline and tab escapes',
      input: 'line1\\nline2\\ttabbed',
      output: 'line1\nline2\ttabbed'
    }
  ],
  apply: (input: any) => {
    const s = String(input)
    // Wrap in quotes so JSON.parse can decode escape sequences
    return JSON.parse(`"${s}"`)
  }
}
export default util
