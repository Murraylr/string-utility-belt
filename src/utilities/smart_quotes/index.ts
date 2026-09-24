import type { Utility } from '@/types/utility'

const DIRECTIONS = ['to-smart', 'to-straight']
const LOCALES = ['en', 'de', 'fr', 'pl']

const NNBSP = '\u202F' // narrow no-break space, the French spacing inside guillemets
const APOS = '’'

type QuoteSet = { dOpen: string; dClose: string; sOpen: string; sClose: string }

const QUOTE_SETS: Record<string, QuoteSet> = {
  en: { dOpen: '“', dClose: '”', sOpen: '‘', sClose: '’' },
  de: { dOpen: '„', dClose: '“', sOpen: '‚', sClose: '‘' },
  fr: {
    dOpen: `«${NNBSP}`,
    dClose: `${NNBSP}»`,
    sOpen: `‹${NNBSP}`,
    sClose: `${NNBSP}›`
  },
  pl: { dOpen: '„', dClose: '”', sOpen: '‚', sClose: '’' }
}

const RE_WORD = /[\p{L}\p{N}]/u
const RE_DIGIT = /\d/
// a quote that follows one of these opens a quotation; anything else closes one
const RE_OPEN_BEFORE = /[\s([{<«–—‘‚“„‹/-]/u

function toStraight(s: string, quotes: boolean, dashes: boolean, ellipsis: boolean): string {
  let out = s
  if (quotes) {
    out = out
      // guillemets first so their inner spacing disappears with them
      .replace(/«[\u202F\u00A0 ]?/g, '"')
      .replace(/[\u202F\u00A0 ]?»/g, '"')
      .replace(/‹[\u202F\u00A0 ]?/g, "'")
      .replace(/[\u202F\u00A0 ]?›/g, "'")
      .replace(/[“”„‟″〝〞＂]/g, '"')
      .replace(/[‘’‚‛′ʹʼ＇]/g, "'")
  }
  if (dashes) {
    // exact inverse of to-smart (--- ⇒ em, -- ⇒ en) so a round trip is lossless
    out = out.replace(/[—―]/g, '---').replace(/–/g, '--').replace(/[‒−]/g, '-')
  }
  if (ellipsis) {
    out = out.replace(/[…⋯]/g, '...')
  }
  return out
}

function toSmart(s: string, quotes: boolean, dashes: boolean, ellipsis: boolean, locale: string): string {
  let out = s
  if (ellipsis) out = out.replace(/\.\.\./g, '…')
  if (dashes) out = out.replace(/---/g, '—').replace(/--/g, '–')
  if (!quotes) return out

  const q = QUOTE_SETS[locale]
  const chars = Array.from(out)
  const res: string[] = []
  // `prev` is the character already emitted, not the raw input one, so a quote that
  // follows a quote we just opened ('"x"') is itself treated as an opening quote
  let prev = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const next = i + 1 < chars.length ? chars[i + 1] : ''
    let emitted: string
    if (ch === '"') {
      emitted = prev === '' || RE_OPEN_BEFORE.test(prev) ? q.dOpen : q.dClose
    } else if (ch === "'") {
      if (RE_WORD.test(prev) && RE_WORD.test(next)) emitted = APOS // it's, don't
      else if (RE_WORD.test(prev)) emitted = q.sClose // dogs'
      else if (RE_DIGIT.test(next)) emitted = APOS // '90s
      else if (prev === '' || RE_OPEN_BEFORE.test(prev)) emitted = q.sOpen
      else emitted = q.sClose
    } else {
      emitted = ch
    }
    res.push(emitted)
    // pop by code point so an astral character is never left as half a surrogate pair
    prev = Array.from(emitted).pop() ?? prev
  }
  return res.join('')
}

const util: Utility = {
  id: 'smart_quotes',
  name: 'smart quotes',
  category: 'Formatting',
  description:
    'Convert curly quotes, em/en dashes and ellipses to plain ascii, or turn straight quotes into typographic ones using English, German, French or Polish conventions.',
  accepts: 'string',
  produces: 'string',
  tags: ['typographic quotes', 'curly quotes', 'smart punctuation', 'em dash', 'en dash', 'ellipsis'],
  aliases: ['smartypants'],
  examples: [
    {
      title: 'to smart',
      input: 'He said "it\'s here" -- really...',
      params: { direction: 'to-smart' },
      output: 'He said “it’s here” – really…'
    },
    {
      title: 'to straight',
      input: '“He said” ‘it’s here’ — really…',
      params: { direction: 'to-straight' },
      output: '"He said" \'it\'s here\' --- really...'
    }
  ],
  params: {
    direction: { kind: 'select', label: 'direction', options: DIRECTIONS, default: 'to-straight' },
    quotes: { kind: 'boolean', label: 'quotes', default: true },
    dashes: { kind: 'boolean', label: 'dashes', default: true },
    ellipsis: { kind: 'boolean', label: 'ellipsis', default: true },
    locale: { kind: 'select', label: 'locale (to-smart)', options: LOCALES, default: 'en' }
  },
  apply: (input: any, params: any = {}) => {
    const s = String(input ?? '')
    const direction = params.direction ?? 'to-straight'
    const locale = params.locale ?? 'en'
    const quotes = params.quotes === undefined ? true : Boolean(params.quotes)
    const dashes = params.dashes === undefined ? true : Boolean(params.dashes)
    const ellipsis = params.ellipsis === undefined ? true : Boolean(params.ellipsis)

    if (typeof direction !== 'string' || !DIRECTIONS.includes(direction)) {
      throw new Error(`unknown direction: ${String(direction)} (expected to-smart or to-straight)`)
    }
    if (direction === 'to-smart' && (typeof locale !== 'string' || !LOCALES.includes(locale))) {
      throw new Error(`unknown locale: ${String(locale)} (expected en, de, fr or pl)`)
    }
    if (!s) return ''

    return direction === 'to-smart'
      ? toSmart(s, quotes, dashes, ellipsis, locale)
      : toStraight(s, quotes, dashes, ellipsis)
  }
}

export default util
