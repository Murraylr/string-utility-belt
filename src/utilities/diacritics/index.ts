import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'diacritics',
  name: 'remove diacritics',
  category: 'String Ops',
  description: 'Strip accents/diacritics via NFD.',
  accepts: 'string',
  produces: 'string',
  tags: ['accents', 'diacritics', 'unicode', 'nfd', 'strip accents', 'ascii fold'],
  streamable: true,
  examples: [
    { title: 'accented characters', input: 'caf\u00e9 d\u00e9j\u00e0 vu', output: 'cafe deja vu' },
    { title: 'mixed diacritics', input: 'na\u00efve Z\u00fcrich', output: 'naive Zurich' }
  ],
  params: {},
  apply: (input: any) => String(input).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
export default util
