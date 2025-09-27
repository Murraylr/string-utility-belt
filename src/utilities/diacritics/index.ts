import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'diacritics',
  name: 'remove diacritics',
  category: 'String Ops',
  description: 'Strip accents/diacritics via NFD.',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => String(input).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}
export default util
