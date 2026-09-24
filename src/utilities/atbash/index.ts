import type { Utility } from '@/types/utility'

const UPPER_A = 65
const UPPER_Z = 90
const LOWER_A = 97
const LOWER_Z = 122

const util: Utility = {
  id: 'atbash',
  name: 'atbash',
  category: 'Ciphers',
  description:
    'Mirror the latin alphabet so a becomes z and Z becomes A, leaving digits, punctuation and non-ascii characters untouched.',
  accepts: 'string',
  produces: 'string',
  tags: ['mirror cipher', 'substitution cipher', 'classic cipher', 'a=z cipher', 'hebrew cipher'],
  streamable: true,
  params: {},
  examples: [
    {
      title: 'a classic phrase',
      input: 'Attack at Dawn',
      output: 'Zggzxp zg Wzdm'
    }
  ],
  apply: (input: any) => {
    const s = String(input ?? '')
    if (s === '') return ''

    let out = ''
    // `for..of` iterates by code point, so astral characters stay intact.
    for (const ch of s) {
      const cp = ch.codePointAt(0) as number
      if (cp >= UPPER_A && cp <= UPPER_Z) out += String.fromCodePoint(UPPER_Z - (cp - UPPER_A))
      else if (cp >= LOWER_A && cp <= LOWER_Z) out += String.fromCodePoint(LOWER_Z - (cp - LOWER_A))
      else out += ch
    }
    return out
  }
}

export default util
