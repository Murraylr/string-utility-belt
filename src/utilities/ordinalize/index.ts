import type { Utility } from '@/types/utility'

/**
 * ordinalize
 *
 * suffix : 1 → 1st, 2 → 2nd, 11 → 11th, 111 → 111th (original digit grouping kept)
 * words  : 1 → first, 42 → forty-second
 *
 * Already-ordinal input ("3rd") is accepted and re-normalised, so the step is
 * idempotent inside a pipeline.
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

const twoDigits = (n: number): string =>
  n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '')

const threeDigits = (n: number): string => {
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  const parts: string[] = []
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`)
  if (rest) parts.push(twoDigits(rest))
  return parts.join(' ')
}

const intToWords = (value: bigint): string => {
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
    parts.push(threeDigits(group) + (SCALES[i] ? ` ${SCALES[i]}` : ''))
  }
  return parts.join(' ')
}

const toOrdinalWords = (value: bigint): string =>
  intToWords(value).replace(/[a-z]+$/i, (word) => ORDINAL_WORD[word.toLowerCase()] ?? `${word}th`)

const ordinalSuffix = (value: bigint): string => {
  const abs = value < 0n ? -value : value
  const lastTwo = Number(abs % 100n)
  const lastOne = Number(abs % 10n)
  if (lastTwo >= 11 && lastTwo <= 13) return 'th'
  if (lastOne === 1) return 'st'
  if (lastOne === 2) return 'nd'
  if (lastOne === 3) return 'rd'
  return 'th'
}

type Target = { negative: boolean; display: string; value: bigint }

/**
 * A digit-group separator: comma, underscore, or horizontal whitespace (plain
 * space, NBSP, thin space, narrow NBSP). Newlines are excluded so a two-line
 * input is never welded into one number.
 */
const GROUP_SEP = /[,_]|[^\S\n\r]/g
/** Well-formed grouping only: 1-3 digits, then 3-digit groups. */
const GROUPED = /^\d{1,3}(?:(?:[,_]|[^\S\n\r])\d{3})+$/

/**
 * Strip digit-group separators, but only from a correctly grouped run, so that
 * "1 2" is rejected rather than silently read (and suffixed) as 12.
 */
const stripGroups = (digits: string): string =>
  GROUPED.test(digits) ? digits.replace(GROUP_SEP, '') : digits

const parseTarget = (raw: string): Target => {
  let text = raw.trim()
  let negative = false
  const sign = /^([+\-−–])\s*/.exec(text)
  if (sign) {
    negative = sign[1] !== '+'
    text = text.slice(sign[0].length).trim()
  }
  // accept input that is already ordinal ("3rd", "21ST"). The suffix has to sit
  // directly on the digits, so "12 st" is not quietly accepted as 12.
  text = text.replace(/(\d)(?:st|nd|rd|th)$/i, '$1')
  const digits = stripGroups(text)
  if (!/^\d+$/.test(digits)) {
    throw new Error(`not a whole number: ${JSON.stringify(raw.trim())}`)
  }
  return { negative, display: text, value: BigInt(digits) }
}

const STYLES = ['suffix', 'words']

const util: Utility = {
  id: 'ordinalize',
  name: 'ordinalize',
  category: 'Numbers',
  description:
    'Turn whole numbers into ordinals — either the short suffix form (1 → 1st) or spelled-out words (1 → first) — one value per line.',
  accepts: 'string',
  produces: 'string',
  params: {
    style: {
      kind: 'select',
      label: 'style',
      options: ['suffix', 'words'],
      default: 'suffix'
    },
    perLine: {
      kind: 'boolean',
      label: 'one value per line',
      default: true
    }
  },
  tags: ['ordinal numbers', '1st 2nd 3rd', 'ordinal suffix', 'number to ordinal', 'rank suffix'],
  examples: [
    { title: 'suffix', input: '21', params: { style: 'suffix' }, output: '21st' },
    { title: 'words', input: '3', params: { style: 'words' }, output: 'third' }
  ],
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const style = String(params?.style ?? 'suffix')
    const perLine = params?.perLine === undefined ? true : Boolean(params.perLine)

    if (!STYLES.includes(style)) throw new Error(`unknown style: ${JSON.stringify(style)}`)
    if (!s.trim()) return s

    const convert = (value: string) => {
      const { negative, display, value: n } = parseTarget(value)
      if (style === 'words') {
        const words = toOrdinalWords(n)
        return negative ? `negative ${words}` : words
      }
      return `${negative ? '-' : ''}${display}${ordinalSuffix(n)}`
    }

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
