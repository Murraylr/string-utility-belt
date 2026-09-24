import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'regex_extract',
  name: 'regex extract',
  category: 'String Ops',
  description: 'Extract all regex matches from the input.',
  accepts: 'string',
  produces: 'string',
  tags: ['regex', 'extract matches', 'pattern matching', 'findall', 'regexp', 'grep'],
  aliases: ['grep -o'],
  examples: [
    { title: 'extract all numbers', input: 'abc 123 def 456', params: { pattern: '\\d+', flags: 'g' }, output: '123\n456' },
    { title: 'case-insensitive match', input: 'Hello WORLD hello', params: { pattern: 'hello', flags: 'gi' }, output: 'Hello\nhello' }
  ],
  params: {
    pattern: { kind: 'regex', label: 'pattern', default: '', placeholder: '\\d+', flagsParam: 'flags' },
    flags: { kind: 'string', label: 'flags', default: 'g' }
  },
  apply: (input: any, { pattern, flags }: any) => {
    const s = String(input)
    if (!pattern) return s
    // always match globally: without 'g', String.match returns [match, ...capture groups]
    // and only the first match, contradicting "extract all matches"
    const f = String(flags ?? 'g')
    const re = new RegExp(pattern, f.includes('g') ? f : f + 'g')
    const matches = s.match(re)
    return matches ? matches.join('\n') : ''
  }
}
export default util
