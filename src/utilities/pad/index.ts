import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'pad',
  name: 'pad',
  category: 'String Ops',
  description: 'Pad the string to a target length.',
  accepts: 'string',
  produces: 'string',
  tags: ['padstart', 'padend', 'fixed width', 'zero pad', 'leftpad', 'align text'],
  examples: [
    { title: 'zero-pad a number', input: '42', params: { length: 6, char: '0', side: 'start' }, output: '000042' },
    { title: 'center with dashes', input: 'hi', params: { length: 6, char: '-', side: 'both' }, output: '--hi--' }
  ],
  params: {
    length: { kind: 'number', label: 'target length', default: 10, min: 0, integer: true, max: 1000000 },
    char: { kind: 'string', label: 'pad character', default: ' ' },
    side: { kind: 'select', label: 'side', options: ['end', 'start', 'both'], default: 'end' }
  },
  apply: (input: any, { length: len, char, side }: any) => {
    const s = String(input)
    const L = Math.max(0, Number(len) || 0)
    const c = char || ' '
    if (side === 'start') return s.padStart(L, c)
    if (side === 'both') {
      const total = Math.max(0, L - s.length)
      const left = Math.floor(total / 2)
      const right = total - left
      return s.padStart(s.length + left, c).padEnd(s.length + left + right, c)
    }
    return s.padEnd(L, c)
  }
}
export default util
