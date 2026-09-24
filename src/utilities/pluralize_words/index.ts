import type { Utility } from '@/types/utility'

/**
 * pluralize / singularize
 *
 * Uses the `pluralize` package, loaded lazily (see house rule 11) so it never
 * lands in the app's initial bundle.
 */

type PluralizeApi = typeof import('pluralize')

let _pluralize: PluralizeApi | null = null
const getPluralize = async (): Promise<PluralizeApi> => {
  if (!_pluralize) {
    const mod = await import('pluralize')
    const withDefault = mod as unknown as { default?: PluralizeApi }
    _pluralize = withDefault.default ?? (mod as unknown as PluralizeApi)
  }
  return _pluralize
}

/**
 * A "word" is a letter-initial run of letters/digits, optionally carrying
 * apostrophised suffixes ("cat's"). Anything else — punctuation, emoji, bare
 * numbers — is left untouched. Because we only ever *replace matched slices*,
 * astral characters in the surrounding text survive byte-for-byte.
 */
const WORD_RE = /\p{L}[\p{L}\p{N}]*(?:['’]\p{L}+)*/gu

const MODES = ['plural', 'singular'] as const
const SCOPES = ['whole', 'last-word', 'each-line'] as const

type Mode = (typeof MODES)[number]
type Scope = (typeof SCOPES)[number]

const transformWord = (p: PluralizeApi, word: string, mode: Mode, count: number): string => {
  if (count > 0) return p(word, count)
  return mode === 'singular' ? p.singular(word) : p.plural(word)
}

/** Prefix `count` to a segment while keeping the segment's leading whitespace. */
const prefixCount = (segment: string, count: number): string => {
  const lead = /^[^\S\n]*/.exec(segment)?.[0] ?? ''
  return `${lead}${count} ${segment.slice(lead.length)}`
}

const transformSegment = (
  p: PluralizeApi,
  segment: string,
  mode: Mode,
  everyWord: boolean,
  count: number
): string => {
  if (!segment.trim()) return segment

  let out = segment
  if (everyWord) {
    out = segment.replace(WORD_RE, (w) => transformWord(p, w, mode, count))
  } else {
    const matches = Array.from(segment.matchAll(WORD_RE))
    // No word to inflect (e.g. "123", "—"). The segment is still a value, so a
    // count prefix must be applied exactly as it is for the `whole` scope.
    if (matches.length > 0) {
      const last = matches[matches.length - 1]
      const at = last.index ?? 0
      out = segment.slice(0, at) + transformWord(p, last[0], mode, count) + segment.slice(at + last[0].length)
    }
  }

  return count > 0 ? prefixCount(out, count) : out
}

const util: Utility = {
  id: 'pluralize_words',
  name: 'pluralize / singularize',
  category: 'String Ops',
  description:
    'Pluralize or singularize English words across the whole text, only the last word, or the last word of each line, and optionally pick the form from a count and prefix it.',
  accepts: 'string',
  produces: 'string',
  tags: ['plural', 'singular', 'inflect', 'grammar', 'pluralization', 'english words'],
  examples: [
    {
      title: 'pluralize the last word',
      input: 'I have one cat and two dog',
      params: { mode: 'plural', scope: 'last-word', count: 0 },
      output: 'I have one cat and two dogs'
    },
    {
      title: 'count prefixes the whole phrase',
      input: 'apple',
      params: { mode: 'plural', scope: 'whole', count: 3 },
      output: '3 apples'
    }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['plural', 'singular'],
      default: 'plural'
    },
    scope: {
      kind: 'select',
      label: 'scope',
      options: ['whole', 'last-word', 'each-line'],
      default: 'whole'
    },
    count: {
      kind: 'number',
      label: 'count (0 = off)',
      default: 0,
      min: 0,
      integer: true
    }
  },
  apply: async (input: any, params: any) => {
    const s = String(input ?? '')
    const mode = (params?.mode ?? 'plural') as Mode
    const scope = (params?.scope ?? 'whole') as Scope
    const rawCount = params?.count === undefined || params?.count === null || params?.count === ''
      ? 0
      : Number(params.count)

    if (!MODES.includes(mode)) throw new Error(`unknown mode: ${JSON.stringify(String(mode))}`)
    if (!SCOPES.includes(scope)) throw new Error(`unknown scope: ${JSON.stringify(String(scope))}`)
    if (!Number.isFinite(rawCount) || !Number.isInteger(rawCount) || rawCount < 0) {
      throw new Error('count must be a non-negative whole number')
    }

    if (!s) return ''

    const p = await getPluralize()

    if (scope === 'each-line') {
      return s.split('\n').map((line) => transformSegment(p, line, mode, false, rawCount)).join('\n')
    }
    return transformSegment(p, s, mode, scope === 'whole', rawCount)
  }
}

export default util
