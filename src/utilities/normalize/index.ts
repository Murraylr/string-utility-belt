import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'normalize',
  name: 'normalize',
  category: 'String Ops',
  description: 'Normalize Unicode (NFC/NFD/NFKC/NFKD).',
  accepts: 'string',
  produces: 'string',
  params: { form: { kind: 'select', label: 'form', options: ['NFC','NFD','NFKC','NFKD'], default: 'NFC' } },
  apply: (input: any, { form }: any) => String(input).normalize(form || 'NFC')
}
export default util
