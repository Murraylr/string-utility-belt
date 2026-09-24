import type { Utility } from '@/types/utility'

// Stroked letters have no NFD decomposition, so map them directly.
const STROKED: Record<string, string> = { Ø: 'O', ø: 'o', Ł: 'L', ł: 'l', Đ: 'D', đ: 'd' }

const util: Utility = {
  id: 'diacritics',
  name: 'remove diacritics',
  category: 'String Ops',
  description: 'Strip accents/diacritics via NFD.',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => String(input ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u00d8\u00f8\u0141\u0142\u0110\u0111]/g, c => STROKED[c])
}
export default util
