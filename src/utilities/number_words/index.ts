import type { Utility } from '@/types/utility'

/**
 * number ↔ words
 *
 * Spells numbers out in English (cardinal / ordinal / year / currency) and
 * parses number words back into digits. BigInt is used for the integer part so
 * very large values stay exact.
 */

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen'
]
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion', 'quadrillion', 'quintillion']

const ORDINAL_WORD: Record<string, string> = {
  zero: 'zeroth', one: 'first', two: 'second', three: 'third', four: 'fourth',
  five: 'fifth', six: 'sixth', seven: 'seventh', eight: 'eighth', nine: 'ninth',
  ten: 'tenth', eleven: 'eleventh', twelve: 'twelfth', thirteen: 'thirteenth',
  fourteen: 'fourteenth', fifteen: 'fifteenth', sixteen: 'sixteenth',
  seventeen: 'seventeenth', eighteen: 'eighteenth', nineteen: 'nineteenth',
  twenty: 'twentieth', thirty: 'thirtieth', forty: 'fortieth', fifty: 'fiftieth',
  sixty: 'sixtieth', seventy: 'seventieth', eighty: 'eightieth', ninety: 'ninetieth',
  hundred: 'hundredth', thousand: 'thousandth', million: 'millionth',
  billion: 'billionth', trillion: 'trillionth', quadrillion: 'quadrillionth',
  quintillion: 'quintillionth'
}
const ORDINAL_TO_CARDINAL: Record<string, string> = Object.fromEntries(
  Object.entries(ORDINAL_WORD).map(([card, ord]) => [ord, card])
)

const UNIT_VALUES: Record<string, number> = {}
ONES.forEach((w, i) => { UNIT_VALUES[w] = i })
const TENS_VALUES: Record<string, number> = {}
TENS.forEach((w, i) => { if (w) TENS_VALUES[w] = i * 10 })
const SCALE_VALUES: Record<string, bigint> = {}
SCALES.forEach((w, i) => { if (w) SCALE_VALUES[w] = 10n ** BigInt(i * 3) })

const MAJOR_UNIT_WORDS = new Set(['dollar', 'dollars', 'pound', 'pounds', 'euro', 'euros', 'buck', 'bucks'])
const MINOR_UNIT_WORDS = new Set(['cent', 'cents', 'penny', 'pennies', 'pence'])
const ZERO_WORDS = new Set(['oh', 'o', 'zero', 'nought', 'naught'])

/* ------------------------------------------------------------------ */
/* number -> words                                                     */
/* ------------------------------------------------------------------ */

const twoDigits = (n: number): string =>
  n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')

const threeDigits = (n: number, useAnd: boolean): string => {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`)
  if (rest) parts.push((hundreds && useAnd ? 'and ' : '') + twoDigits(rest))
  return parts.join(' ')
}

const intToWords = (value: bigint, useAnd: boolean): string => {
  if (value === 0n) return 'zero'
  const groups: number[] = []
  let rest = value
  while (rest > 0n) {
    groups.push(Number(rest % 1000n))
    rest /= 1000n
  }
  if (groups.length > SCALES.length) throw new Error('number is too large to spell out')

  const parts: string[] = []
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i]
    if (!group) continue
    let text = threeDigits(group, useAnd)
    if (useAnd && i === 0 && group < 100 && parts.length > 0) text = `and ${text}`
    if (SCALES[i]) text += ` ${SCALES[i]}`
    parts.push(text)
  }
  return parts.join(' ')
}

const toOrdinalWords = (cardinal: string): string =>
  cardinal.replace(/[a-z]+$/i, (word) => ORDINAL_WORD[word.toLowerCase()] ?? `${word}th`)

const yearToWords = (value: bigint, useAnd: boolean): string => {
  if (value < 1n || value > 9999n) return intToWords(value, useAnd)
  const year = Number(value)
  // 2000-2009 read as "two thousand (and) five", not "twenty oh five"
  if (year >= 2000 && year <= 2009) return intToWords(value, useAnd)
  if (year % 100 === 0) {
    if (year % 1000 === 0) return intToWords(value, useAnd)
    return `${twoDigits(year / 100)} hundred`
  }
  if (year < 1000) return intToWords(value, useAnd)
  const hi = Math.floor(year / 100)
  const lo = year % 100
  if (lo < 10) return `${twoDigits(hi)} oh ${ONES[lo]}`
  return `${twoDigits(hi)} ${twoDigits(lo)}`
}

type Money = { major: bigint; minor: number }

/** Round a parsed decimal down to major units + 0..99 minor units. */
const toMoney = (int: bigint, frac: string): Money => {
  let major = int
  let minor = frac ? Number(`${frac}00`.slice(0, 2)) : 0
  const next = frac.length > 2 ? Number(frac[2]) : 0
  if (next >= 5) {
    minor += 1
    if (minor === 100) { minor = 0; major += 1n }
  }
  return { major, minor }
}

const currencyUnits = (locale: string) =>
  locale === 'en-GB'
    ? { major1: 'pound', majorN: 'pounds', minor1: 'penny', minorN: 'pence' }
    : { major1: 'dollar', majorN: 'dollars', minor1: 'cent', minorN: 'cents' }

const moneyToWords = ({ major, minor }: Money, locale: string, useAnd: boolean): string => {
  const u = currencyUnits(locale)
  const parts: string[] = []
  if (major !== 0n || minor === 0) {
    parts.push(`${intToWords(major, useAnd)} ${major === 1n ? u.major1 : u.majorN}`)
  }
  if (minor > 0) {
    parts.push(`${intToWords(BigInt(minor), useAnd)} ${minor === 1 ? u.minor1 : u.minorN}`)
  }
  return parts.join(' and ')
}

type ParsedNumber = { negative: boolean; int: bigint; frac: string }

/**
 * A digit-group separator: comma, underscore, or horizontal whitespace (plain
 * space, NBSP, thin space, narrow NBSP). Newlines are deliberately excluded so
 * a two-line input is never welded into one number.
 */
const GROUP_SEP = /[,_]|[^\S\n\r]/g
/** Well-formed grouping only: 1-3 digits, then 3-digit groups. */
const GROUPED = /^\d{1,3}(?:(?:[,_]|[^\S\n\r])\d{3})+$/

/**
 * Strip digit-group separators, but only from a correctly grouped run. Leaving
 * them in place otherwise lets the digit check below reject "1 2", "1,2" and
 * "12,34,567" instead of silently reading them as 12, 12 and 1234567.
 */
const stripGroups = (digits: string): string =>
  GROUPED.test(digits) ? digits.replace(GROUP_SEP, '') : digits

const parseDigits = (raw: string): ParsedNumber => {
  let text = raw.trim().replace(/(?<!\s)\s*[$£€¥]\s*$/, '').replace(/^\s*[$£€¥]\s*/, '')
  let negative = false
  const sign = /^([+\-−–])\s*/.exec(text)
  if (sign) {
    negative = sign[1] !== '+'
    text = text.slice(sign[0].length)
  }
  // a symbol written after the sign, e.g. "-$5"
  text = text.replace(/^\s*[$£€¥]\s*/, '').trim()

  const dot = text.indexOf('.')
  const intText = stripGroups(dot < 0 ? text : text.slice(0, dot))
  const frac = dot < 0 ? '' : text.slice(dot + 1)
  if (!/^\d+$/.test(intText) || (dot >= 0 && !/^\d+$/.test(frac))) {
    throw new Error(`not a number: ${JSON.stringify(raw.trim())}`)
  }
  return { negative, int: BigInt(intText), frac }
}

const numberToWords = (raw: string, style: string, locale: string): string => {
  const { negative, int, frac } = parseDigits(raw)
  const useAnd = locale === 'en-GB'
  let words: string

  if (style === 'currency') {
    words = moneyToWords(toMoney(int, frac), locale, useAnd)
  } else if (style === 'ordinal') {
    if (frac && /[1-9]/.test(frac)) throw new Error('ordinal style needs a whole number')
    words = toOrdinalWords(intToWords(int, useAnd))
  } else if (style === 'year') {
    if (frac && /[1-9]/.test(frac)) throw new Error('year style needs a whole number')
    words = yearToWords(int, useAnd)
  } else {
    words = intToWords(int, useAnd)
    if (frac) words += ` point ${Array.from(frac).map((d) => ONES[Number(d)]).join(' ')}`
  }

  return negative ? `negative ${words}` : words
}

/* ------------------------------------------------------------------ */
/* words -> number                                                     */
/* ------------------------------------------------------------------ */

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[,]/g, ' ')
    .replace(/[-‐‑‒–—]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

/** Ordinal words ("forty-second") read the same as their cardinal form. */
const canonical = (token: string): string => ORDINAL_TO_CARDINAL[token] ?? token

const accumulate = (tokens: string[], source: string): bigint => {
  let total = 0n
  let current = 0n
  let saw = false
  for (const rawToken of tokens) {
    const t = canonical(rawToken)
    if (t === 'and' || t === 'a' || t === 'an') continue
    if (t in UNIT_VALUES) { current += BigInt(UNIT_VALUES[t]); saw = true; continue }
    if (t in TENS_VALUES) { current += BigInt(TENS_VALUES[t]); saw = true; continue }
    if (t === 'hundred') { current = (current === 0n ? 1n : current) * 100n; saw = true; continue }
    if (t in SCALE_VALUES) {
      total += (current === 0n ? 1n : current) * SCALE_VALUES[t]
      current = 0n
      saw = true
      continue
    }
    throw new Error(`unrecognized number word ${JSON.stringify(rawToken)} in ${JSON.stringify(source)}`)
  }
  if (!saw) throw new Error(`no number words found in ${JSON.stringify(source)}`)
  return total + current
}

const splitPoint = (tokens: string[], source: string): { intTokens: string[]; frac: string } => {
  const at = tokens.indexOf('point')
  if (at < 0) return { intTokens: tokens, frac: '' }
  const frac = tokens.slice(at + 1).map((t) => {
    if (ZERO_WORDS.has(t)) return '0'
    const v = UNIT_VALUES[canonical(t)]
    if (v === undefined || v > 9) {
      throw new Error(`invalid decimal digit word ${JSON.stringify(t)} in ${JSON.stringify(source)}`)
    }
    return String(v)
  }).join('')
  if (!frac) throw new Error(`missing digits after "point" in ${JSON.stringify(source)}`)
  return { intTokens: tokens.slice(0, at), frac }
}

const parseYearWords = (tokens: string[], source: string): bigint => {
  if (tokens.some((t) => canonical(t) === 'hundred' || canonical(t) in SCALE_VALUES)) {
    return accumulate(tokens, source)
  }
  let i = 0
  const takeGroup = (): number | null => {
    const t = tokens[i] === undefined ? undefined : canonical(tokens[i])
    if (t === undefined) return null
    if (t in TENS_VALUES) {
      let value = TENS_VALUES[t]
      i++
      const next = tokens[i] === undefined ? undefined : canonical(tokens[i])
      if (next !== undefined && next in UNIT_VALUES && UNIT_VALUES[next] >= 1 && UNIT_VALUES[next] <= 9) {
        value += UNIT_VALUES[next]
        i++
      }
      return value
    }
    if (t in UNIT_VALUES) { const value = UNIT_VALUES[t]; i++; return value }
    return null
  }

  const hi = takeGroup()
  if (hi === null) throw new Error(`not a year: ${JSON.stringify(source)}`)
  if (i >= tokens.length) return BigInt(hi)
  if (ZERO_WORDS.has(tokens[i])) i++
  const lo = takeGroup()
  if (lo === null || i < tokens.length) throw new Error(`not a year: ${JSON.stringify(source)}`)
  return BigInt(hi * 100 + lo)
}

/** Carry 100+ minor units into the major unit ("one hundred fifty cents" ⇒ 1.50). */
const normalizeMoney = ({ major, minor }: Money): Money => ({
  major: major + BigInt(Math.floor(minor / 100)),
  minor: minor % 100
})

const parseCurrencyWords = (tokens: string[], source: string): Money => {
  const majorAt = tokens.findIndex((t) => MAJOR_UNIT_WORDS.has(t))
  const minorAt = tokens.findIndex((t) => MINOR_UNIT_WORDS.has(t))

  if (majorAt < 0 && minorAt < 0) {
    const { intTokens, frac } = splitPoint(tokens, source)
    const int = intTokens.length ? accumulate(intTokens, source) : 0n
    return toMoney(int, frac)
  }

  // Nothing may follow the last unit word — otherwise "ninety-nine cents banana"
  // would quietly read as 0.99.
  const trailing = tokens.slice(Math.max(majorAt, minorAt) + 1).filter((t) => t !== 'and')
  if (trailing.length) {
    throw new Error(`unexpected words after the currency unit in ${JSON.stringify(source)}`)
  }

  if (majorAt < 0) {
    return normalizeMoney({ major: 0n, minor: Number(accumulate(tokens.slice(0, minorAt), source)) })
  }
  const major = accumulate(tokens.slice(0, majorAt), source)
  if (minorAt < 0) return { major, minor: 0 }
  const tail = tokens.slice(majorAt + 1, minorAt).filter((t) => t !== 'and')
  const minor = tail.length ? Number(accumulate(tail, source)) : 0
  return normalizeMoney({ major, minor })
}

const wordsToNumber = (raw: string, style: string): string => {
  const source = raw.trim()
  let text = source
  let negative = false
  const sign = /^[-−–]\s*/.exec(text)
  if (sign) { negative = true; text = text.slice(sign[0].length) }

  let tokens = tokenize(text)
  if (tokens[0] === 'negative' || tokens[0] === 'minus') { negative = true; tokens = tokens.slice(1) }
  if (tokens.length === 0) throw new Error(`no number words found in ${JSON.stringify(source)}`)

  const minus = negative ? '-' : ''

  if (style === 'currency') {
    const { major, minor } = parseCurrencyWords(tokens, source)
    return `${minus}${major}.${String(minor).padStart(2, '0')}`
  }
  if (style === 'year') {
    return `${minus}${parseYearWords(tokens, source)}`
  }
  const { intTokens, frac } = splitPoint(tokens, source)
  const int = intTokens.length ? accumulate(intTokens, source) : 0n
  return `${minus}${int}${frac ? `.${frac}` : ''}`
}

/* ------------------------------------------------------------------ */

const DIRECTIONS = ['to-words', 'to-number']
const STYLES = ['cardinal', 'ordinal', 'year', 'currency']
const LOCALES = ['en-US', 'en-GB']

const util: Utility = {
  id: 'number_words',
  name: 'number ↔ words',
  category: 'Numbers',
  description:
    'Spell numbers out in English as cardinal, ordinal, year, or currency words — or parse number words back into digits — using en-US or en-GB conventions.',
  accepts: 'string',
  produces: 'string',
  params: {
    direction: {
      kind: 'select',
      label: 'direction',
      options: ['to-words', 'to-number'],
      default: 'to-words'
    },
    style: {
      kind: 'select',
      label: 'style',
      options: ['cardinal', 'ordinal', 'year', 'currency'],
      default: 'cardinal'
    },
    locale: {
      kind: 'select',
      label: 'locale',
      options: ['en-US', 'en-GB'],
      default: 'en-US'
    },
    perLine: {
      kind: 'boolean',
      label: 'one value per line',
      default: true
    }
  },
  tags: ['number to words', 'spell out numbers', 'cardinal ordinal', 'words to number', 'currency words', 'checks'],
  examples: [
    { title: 'cardinal to words', input: '42', params: { direction: 'to-words', style: 'cardinal' }, output: 'forty-two' },
    { title: 'words to number', input: 'forty-two', params: { direction: 'to-number', style: 'cardinal' }, output: '42' }
  ],
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const direction = String(params?.direction ?? 'to-words')
    const style = String(params?.style ?? 'cardinal')
    const locale = String(params?.locale ?? 'en-US')
    const perLine = params?.perLine === undefined ? true : Boolean(params.perLine)

    if (!DIRECTIONS.includes(direction)) throw new Error(`unknown direction: ${JSON.stringify(direction)}`)
    if (!STYLES.includes(style)) throw new Error(`unknown style: ${JSON.stringify(style)}`)
    if (!LOCALES.includes(locale)) throw new Error(`unknown locale: ${JSON.stringify(locale)}`)
    if (!s.trim()) return s

    const convert = (value: string) =>
      direction === 'to-number' ? wordsToNumber(value, style) : numberToWords(value, style, locale)

    const applyKeepingPadding = (segment: string) => {
      // trimStart/trimEnd, not /^(\s*)([\s\S]*?)(\s*)$/: that regex is quadratic on a
      // long run of spaces inside the segment
      const body = segment.trimStart()
      const core = body.trimEnd()
      if (!core) return segment
      return segment.slice(0, segment.length - body.length) + convert(core) + body.slice(core.length)
    }

    if (!perLine) return applyKeepingPadding(s)
    return s.split('\n').map(applyKeepingPadding).join('\n')
  }
}

export default util
