import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'truncate',
  name: 'truncate',
  category: 'String Ops',
  description: 'Trim to a max visible length, reserving 3 for ellipsis (“…”) when truncating.',
  accepts: 'string',
  produces: 'string',
  tags: ['ellipsis', 'trim', 'clip', 'cut off', 'max length', 'abbreviate', 'shorten', 'substring'],
  params: {
    length: { kind: 'number', label: 'max length', default: 20, min: 0, integer: true },
    ellipsis: { kind: 'string', label: 'ellipsis', default: '…' }
  },
  examples: [
    {
      title: 'longer than the limit',
      input: 'Hello, World! This is a test.',
      params: { length: 15 },
      output: 'Hello, World! …'
    },
    {
      title: 'already short enough',
      input: 'Hi',
      params: { length: 15 },
      output: 'Hi'
    }
  ],
  apply: (input: any, { length, ellipsis }: any) => {
    const s = String(input);
    const L = Number(length) || 0;
    const e = ellipsis ?? '…';
    if (L <= 0 || s.length <= L) return s;
    const reserve = e.length;
    if (L <= reserve) return s.slice(0, L);
    return s.slice(0, L - reserve) + e;
  }
}
export default util
