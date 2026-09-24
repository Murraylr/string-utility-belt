import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'normalize',
  name: 'normalize',
  category: 'String Ops',
  description: 'Normalize Unicode (NFC/NFD/NFKC/NFKD).',
  accepts: 'string',
  produces: 'string',
  tags: ['unicode normalization', 'nfc', 'nfd', 'nfkc', 'nfkd', 'compose', 'decompose'],
  streamable: true,
  examples: [
    { title: 'compose a combining accent (NFC)', input: 'é', params: { form: 'NFC' }, output: 'é' },
    { title: 'decompose (NFD)', input: 'é', params: { form: 'NFD' }, output: 'é' }
  ],
  params: { form: { kind: 'select', label: 'form', options: ['NFC','NFD','NFKC','NFKD'], default: 'NFC' } },
  apply: (input: any, { form }: any) => String(input).normalize(form || 'NFC')
}
export default util
