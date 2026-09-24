import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'swap_case',
  name: 'swap case',
  category: 'Formatting',
  description: 'Invert the case of every letter — uppercase becomes lowercase and lowercase becomes uppercase.',
  accepts: 'string',
  produces: 'string',
  tags: ['invert case', 'case swap', 'toggle case', 'flip case'],
  streamable: true,
  examples: [{ title: 'default', input: 'Hello World', output: 'hELLO wORLD' }],
  params: {},
  apply: (input: any) => {
    // Iterate code points so astral characters are never split into surrogate halves.
    return Array.from(String(input))
      .map(ch => {
        const lower = ch.toLowerCase()
        if (ch !== lower) return lower
        const upper = ch.toUpperCase()
        // Some lowercase letters expand when upcased (ß → SS); that is the correct swap.
        if (ch !== upper) return upper
        return ch
      })
      .join('')
  }
}

export default util
