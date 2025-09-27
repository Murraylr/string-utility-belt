import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'custom_function',
  name: 'custom function',
  category: 'Custom',
  description: 'Run your own JavaScript over the value. Provide a function body or an expression. Async supported.',
  accepts: ['string','bytes','json'],
  produces: 'string',
  params: {
    code: { kind: 'string', label: 'function body or expression', placeholder: 'return input.toUpperCase();' },
    async: { kind: 'boolean', label: 'async', default: false }
  },
  apply: async (input: any, { code, async: isAsync }: any) => {
    const hasReturn = /\breturn\b/.test(code || '')
    const body = (code && String(code).trim().length)
      ? (hasReturn ? String(code) : `return (${String(code)});`)
      : 'return input;'
    const wrapper = isAsync
      ? `return (async (input, params) => { ${body} });`
      : `return ((input, params) => { ${body} });`
    /* eslint-disable no-new-func */
    const fn = new Function(wrapper)()
    const val = isAsync ? await fn(input, {}) : fn(input, {})
    return val
  }
}
export default util
