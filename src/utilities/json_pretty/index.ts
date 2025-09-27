import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'json_pretty',
  name: 'json pretty',
  category: 'URL & JSON',
  description: 'Parse input as JSON and pretty-print.',
  accepts: ['string','json'],
  produces: 'string',
  params: { indent: { kind: 'number', label: 'indent', default: 2 } },
  apply: (input: any, { indent }: any) => {
    const val = typeof input === 'string' ? JSON.parse(input) : input
    return JSON.stringify(val, null, Math.max(0, Number(indent)||0))
  }
}
export default util
