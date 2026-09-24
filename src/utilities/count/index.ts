import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'count',
  name: 'count',
  category: 'Analysis',
  description: 'Character, word, and line count statistics.',
  accepts: 'string',
  produces: 'string',
  tags: ['word count', 'line count', 'character count', 'stats', 'wc'],
  aliases: ['wc'],
  params: {},
  examples: [
    {
      title: 'a couple of lines',
      input: 'Hello world\nfoo bar baz',
      output: 'characters: 23\nwords: 5\nlines: 2'
    }
  ],
  apply: (input: any) => {
    const s = String(input)
    const chars = s.length
    const words = s.trim() === '' ? 0 : s.trim().split(/\s+/).length
    const lines = s === '' ? 0 : s.split('\n').length
    return `characters: ${chars}\nwords: ${words}\nlines: ${lines}`
  }
}
export default util
