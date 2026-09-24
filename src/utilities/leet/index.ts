import type { Utility } from '@/types/utility'

/**
 * Leet-speak substitution tables, one per level.
 *
 * Every table is built so that the *decode* direction is unambiguous for
 * ordinary letters: no token is produced by two different letters, and the
 * multi-character tokens used by `extreme` are uniquely decodable when they sit
 * next to each other (that is why w is `\^/` and not `\/\/` — the latter would
 * be indistinguishable from two v's).
 */
export const LEET_TABLES: Record<string, Record<string, string>> = {
  basic: {
    a: '4', e: '3', i: '1', o: '0', s: '5', t: '7'
  },
  medium: {
    a: '4', b: '8', c: '<', e: '3', g: '9', h: '#', i: '1',
    l: '|', n: '^', o: '0', s: '5', t: '7', z: '2'
  },
  extreme: {
    a: '4', b: '8', c: '<', d: '|)', e: '3', f: '|=', g: '9',
    h: '#', i: '!', j: '_|', k: '|<', l: '\u00A3', m: '/\\/\\',
    n: '^', o: '0', p: '?', q: '&', r: '2', s: '$', t: '7',
    u: '\u00B5', v: '\\/', w: '\\^/', x: '><', y: '\u00A5', z: '%'
  }
}

const LEVELS = ['basic', 'medium', 'extreme']
const DIRECTIONS = ['to-leet', 'from-leet']

type Tables = { encode: Map<string, string>; decode: Array<[string, string]> }

const compiled = new Map<string, Tables>()

const tablesFor = (level: string): Tables => {
  const cached = compiled.get(level)
  if (cached) return cached
  const table = LEET_TABLES[level]
  const encode = new Map<string, string>(Object.entries(table))
  // longest token first so multi-character art is matched before its prefixes
  const decode = Object.entries(table)
    .map(([letter, token]) => [token, letter] as [string, string])
    .sort((a, b) => b[0].length - a[0].length)
  const built = { encode, decode }
  compiled.set(level, built)
  return built
}

const toLeet = (s: string, encode: Map<string, string>): string => {
  let out = ''
  for (const ch of s) {
    const rep = encode.get(ch.toLowerCase())
    out += rep === undefined ? ch : rep
  }
  return out
}

const fromLeet = (s: string, decode: Array<[string, string]>): string => {
  let out = ''
  let i = 0
  while (i < s.length) {
    let matched = false
    for (const [token, letter] of decode) {
      if (s.startsWith(token, i)) {
        out += letter
        i += token.length
        matched = true
        break
      }
    }
    if (!matched) {
      // advance a whole code point so astral characters survive intact
      const ch = String.fromCodePoint(s.codePointAt(i) as number)
      out += ch
      i += ch.length
    }
  }
  return out
}

const util: Utility = {
  id: 'leet',
  name: 'leet speak',
  category: 'Formatting',
  description:
    'Rewrite text as leet speak at a basic, medium, or extreme substitution level, or decode leet back to letters.',
  accepts: 'string',
  produces: 'string',
  tags: ['1337', 'l33t', 'leetspeak', 'substitution cipher', 'hacker text'],
  aliases: ['1337', 'l33t'],
  streamable: true,
  examples: [
    { title: 'basic, to leet', input: 'leet speak', params: { level: 'basic', direction: 'to-leet' }, output: 'l337 5p34k' },
    { title: 'basic, decode', input: 'l33t sp34k', params: { level: 'basic', direction: 'from-leet' }, output: 'leet speak' }
  ],
  params: {
    level: {
      kind: 'select',
      label: 'level',
      options: LEVELS,
      default: 'basic'
    },
    direction: {
      kind: 'select',
      label: 'direction',
      options: DIRECTIONS,
      default: 'to-leet'
    }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const level = params?.level ?? 'basic'
    const direction = params?.direction ?? 'to-leet'
    if (!LEVELS.includes(level)) {
      throw new Error(`unknown leet level: ${level} (expected ${LEVELS.join(', ')})`)
    }
    if (!DIRECTIONS.includes(direction)) {
      throw new Error(`unknown direction: ${direction} (expected ${DIRECTIONS.join(', ')})`)
    }
    if (!s) return ''
    const { encode, decode } = tablesFor(level)
    return direction === 'from-leet' ? fromLeet(s, decode) : toLeet(s, encode)
  }
}

export default util
