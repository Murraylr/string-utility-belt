import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'json_escape',
  name: 'JSON escape',
  category: 'Encoding',
  description: 'Escape a string for safe inclusion in JSON.',
  accepts: 'string',
  produces: 'string',
  params: {},
  tags: ['json', 'escape', 'string', 'encode', 'stringify'],
  examples: [
    { title: 'newlines, tabs and quotes', input: 'Line1\nLine2\t"quoted"', output: 'Line1\\nLine2\\t\\"quoted\\"' }
  ],
  apply: (input: any) => {
    // JSON.stringify wraps in quotes; strip them to get just the escaped content
    const s = String(input)
    return JSON.stringify(s).slice(1, -1)
  }
}
export default util
