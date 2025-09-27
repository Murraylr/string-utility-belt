import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'replace',
  name: 'replace',
  category: 'String Ops',
  description: 'String or RegExp replace with flags.',
  accepts: 'string',
  produces: 'string',
  params: {
    pattern: { kind: 'string', label: 'pattern', placeholder: 'foo|bar' },
    replacement: { kind: 'string', label: 'replacement', default: '' },
    regex: { kind: 'boolean', label: 'use regex', default: true },
    flags: { kind: 'string', label: 'flags', default: 'g' }
  },
  apply: (input: any, { pattern, replacement, regex, flags }: any) => {
    const s = String(input)
    if (!pattern) return s
    if (regex) {
      const re = new RegExp(pattern, flags || 'g')
      return s.replace(re, replacement ?? '')
    }
    return s.split(pattern).join(replacement ?? '')
  }
}
export default util
