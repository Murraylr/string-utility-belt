import type { Utility } from '@/types/utility'
import { normalizeCase } from '@/utilities/helpers'

const util: Utility = {
  id: 'case',
  name: 'change case',
  category: 'Formatting',
  description: 'Change letter casing to upper, lower, or title case.',
  accepts: 'string',
  produces: 'string',
  params: {
    mode: { kind: 'select', label: 'Mode', options: ['upper','lower','title'], default: 'upper' }
  },
  apply: (input: unknown, params: { mode?: 'upper'|'lower'|'title' } = {}) => {
    const mode = params.mode ?? 'upper'
    return normalizeCase(String(input ?? ''), mode)
  }
}
export default util
