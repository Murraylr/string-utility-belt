import type { Utility } from '@/types/utility'
import { runUserCode } from '@/lib/sandbox'

const util: Utility = {
  id: 'custom_function',
  name: 'Custom Function',
  category: 'Advanced',
  description: 'Run your own JavaScript on the string. Safe sandbox with timeout.',
  accepts: ['string', 'bytes'],
  produces: ['string', 'bytes'],
  params: {
    code: { kind: 'string', label: 'Function Body', placeholder: 'return input.toUpperCase();' },
    async: { kind: 'boolean', label: 'Async?', default: false }
  },
  async apply(input: unknown, params: { code?: string, async?: boolean } = {}) {
    const code = params.code || 'return input';
    try {
      const wrapped = params.async
        ? `(async (input) => { ${code} })`
        : `(function(input) { ${code} })`;
      const result = await runUserCode(wrapped, input);
      if (result && typeof result === 'object' && 'error' in result) {
        console.warn('Custom fn error:', (result as any).error);
        return input; // graceful fallback
      }
      return result;
    } catch (err) {
      console.warn('Custom fn crash:', err);
      return input;
    }
  }
}

export default util
