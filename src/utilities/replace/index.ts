import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'replace',
  name: 'replace',
  category: 'String Ops',
  description: 'String or RegExp replace with flags.',
  accepts: 'string',
  produces: 'string',
  tags: ['find and replace', 'regexp replace', 'substitute', 'string replace', 'pattern replace'],
  examples: [
    { title: 'literal replace', input: 'foo bar foo', params: { pattern: 'foo', replacement: 'baz', regex: false, flags: 'g' }, output: 'baz bar baz' },
    { title: 'regex with a capture group', input: 'foo1 foo2', params: { pattern: 'foo(\\d)', replacement: 'F$1', regex: true, flags: 'g' }, output: 'F1 F2' }
  ],
  params: {
    pattern: { kind: 'string', label: 'pattern', default: '', placeholder: 'foo|bar' },
    replacement: { kind: 'string', label: 'replacement', default: '' },
    regex: { kind: 'boolean', label: 'use regex', default: true },
    flags: { kind: 'string', label: 'flags', default: 'g' }
  },
  apply: (input: any, { pattern, replacement, regex, flags }: any) => {
    const s = String(input)
    if (!pattern) return s
    if (regex) {
      // ?? not ||: an explicitly cleared flags field means a single, non-global replace
      const re = new RegExp(pattern, flags ?? 'g')
      return s.replace(re, replacement ?? '')
    }
    return s.split(pattern).join(replacement ?? '')
  }
}
export default util
