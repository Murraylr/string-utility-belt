import type { Utility } from '@/types/utility'

const toBool = (v: unknown, fallback: boolean) => {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

const isLetter = (ch: string) => /\p{L}/u.test(ch)

const util: Utility = {
  id: 'alternating_case',
  name: 'alternating case',
  category: 'Formatting',
  description:
    'Alternate between lowercase and uppercase letter by letter, optionally starting uppercase and optionally letting spaces and punctuation take a turn.',
  accepts: 'string',
  produces: 'string',
  tags: ['spongebob case', 'mocking case', 'alternate case', 'sarcasm', 'meme'],
  aliases: ['spongebob case'],
  examples: [{ title: 'default', input: 'hello world', output: 'hElLo WoRlD' }],
  params: {
    startUpper: { kind: 'boolean', label: 'start uppercase', default: false },
    skipNonLetters: { kind: 'boolean', label: 'skip non-letters', default: true }
  },
  apply: (input: any, { startUpper, skipNonLetters }: any) => {
    const s = String(input)
    const upperFirst = toBool(startUpper, false)
    const skip = toBool(skipNonLetters, true)
    let i = 0
    // Code-point iteration keeps emoji and other astral characters intact.
    return Array.from(s)
      .map(ch => {
        if (!isLetter(ch)) {
          if (!skip) i++
          return ch
        }
        const even = i % 2 === 0
        i++
        return (upperFirst ? even : !even) ? ch.toUpperCase() : ch.toLowerCase()
      })
      .join('')
  }
}

export default util
