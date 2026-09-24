import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'truncate',
  name: 'truncate',
  category: 'String Ops',
  description: 'Trim to a max visible length, counting the ellipsis (“…”) when truncating.',
  accepts: 'string',
  produces: 'string',
  params: {
    length: { kind: 'number', label: 'max length', default: 20 },
    ellipsis: { kind: 'string', label: 'ellipsis', default: '…' }
  },
  apply: (input: any, { length, ellipsis }: any) => {
    const s = String(input);
    const L = Number(length) || 0;
    if (L <= 0 || s.length <= L) return s;
    const e = ellipsis ?? '…';
    if (L <= e.length) return s.slice(0, L);
    return s.slice(0, L - e.length) + e;
  }
}
export default util
