import type { Utility } from '@/types/utility'

const STYLES = ['decimal', 'thousands', 'scientific', 'engineering', 'percent', 'currency', 'compact', 'fixed']

/** Symbols that may sit around a number in the wild and carry no numeric meaning. */
const CURRENCY_SYMBOLS = /[$€£¥₹₽₩₪₴₺¢]/g

/**
 * Read a number written in a human way: grouped with `,` or `.` or spaces,
 * decorated with a currency symbol, or written as a percentage.
 * A trailing `%` is honoured — "12.5%" is the number 0.125.
 */
export function parseHumanNumber(raw: string): number {
  const original = raw.trim()
  // \s also covers NBSP and narrow NBSP, which locales use as group separators
  let s = original.replace(/[\s'_]/g, '').replace(CURRENCY_SYMBOLS, '')

  let percent = false
  if (s.slice(-1) === '%') {
    percent = true
    s = s.slice(0, -1)
  }
  if (!s) throw new Error(`"${original}" is not a number`)

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  if (lastDot >= 0 && lastComma >= 0) {
    // whichever comes last is the decimal mark, the other groups digits
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.')
    else s = s.replace(/,/g, '')
  } else if (lastComma >= 0) {
    if (/^[+-]?\d{1,3}(,\d{3})+$/.test(s)) s = s.replace(/,/g, '')
    else s = s.replace(',', '.')
  } else if (/^[+-]?\d{1,3}(\.\d{3}){2,}$/.test(s)) {
    // only an unambiguous multi-group form is treated as dot grouping
    s = s.replace(/\./g, '')
  }

  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(s)) {
    throw new Error(`"${original}" is not a number`)
  }
  const n = Number(s)
  if (!Number.isFinite(n)) throw new Error(`"${original}" is not a finite number`)
  return percent ? n / 100 : n
}

type NumberOptions = Intl.NumberFormatOptions & { notation?: string; compactDisplay?: string }

/**
 * Intl.NumberFormat construction is expensive and the pipeline re-runs on every keystroke,
 * once per line, so successfully built formatters are reused. Failures are never cached.
 */
const FORMATTERS = new Map<string, Intl.NumberFormat>()

const formatterFor = (locale: string, options: NumberOptions) => {
  const key = `${locale}\u0000${JSON.stringify(options)}`
  const cached = FORMATTERS.get(key)
  if (cached) return cached
  try {
    const made = new Intl.NumberFormat(locale, options as Intl.NumberFormatOptions)
    FORMATTERS.set(key, made)
    return made
  } catch (err) {
    const detail = (err as Error).message
    if (options.style === 'currency') {
      throw new Error(`cannot format as currency "${options.currency}" in locale "${locale}": ${detail}`)
    }
    throw new Error(`cannot format with locale "${locale}": ${detail}`)
  }
}

const localeParts = (locale: string, options: NumberOptions, value: number) =>
  formatterFor(locale, options).formatToParts(value)

const decimalSeparatorFor = (locale: string) => {
  const part = localeParts(locale, {}, 1.1).filter((p) => p.type === 'decimal')[0]
  return part ? part.value : '.'
}

const renderParts = (
  locale: string,
  options: NumberOptions,
  value: number,
  separator: string
) =>
  localeParts(locale, options, value)
    .map((p) => (p.type === 'group' && separator ? separator : p.value))
    .join('')

const exponentOf = (exponentialText: string) => parseInt(exponentialText.split('e')[1], 10)

/**
 * Slide the decimal point of `mantissa` right by `shift` places and render exactly
 * `places` decimals. Pure string surgery, so no binary-floating-point drift creeps in.
 * Padding is exact: the digits came from a value already rounded to this position.
 */
const renderMantissa = (mantissa: string, shift: number, places: number): string => {
  const negative = mantissa.charAt(0) === '-'
  const body = negative ? mantissa.slice(1) : mantissa
  const dot = body.indexOf('.')
  const digits = dot < 0 ? body : body.slice(0, dot) + body.slice(dot + 1)
  const wholeLength = (dot < 0 ? body.length : dot) + shift
  const padded = digits.padEnd(wholeLength + places, '0')
  const fraction = padded.slice(wholeLength, wholeLength + places)
  return `${negative ? '-' : ''}${padded.slice(0, wholeLength)}${fraction ? `.${fraction}` : ''}`
}

/**
 * Scientific notation with an exponent that is always a multiple of three.
 *
 * The mantissa comes from `toExponential`, which the engine rounds correctly, and the
 * point is then moved with string surgery. Deriving it as `Number(mantissa) * 10 ** shift`
 * instead rounds a value that has already drifted: 12345 becomes 12.344999999999999 and
 * prints "12.34e+3", where the exact quantity 12.345 must round to "12.35e+3".
 */
export function toEngineering(value: number, decimals: number): string {
  const places = Math.min(20, Math.max(0, Math.trunc(decimals) || 0))
  if (!Number.isFinite(value)) throw new Error(`cannot render ${value} in engineering notation`)
  if (value === 0) return `${(0).toFixed(places)}e+0`

  const exponent = exponentOf(value.toExponential())
  let engExponent = Math.floor(exponent / 3) * 3
  // rounding to `places` decimals of the shifted mantissa == rounding the normalised
  // mantissa to `places + shift` decimals, i.e. to the same absolute decimal position
  let text = value.toExponential(places + exponent - engExponent)
  let shift = exponentOf(text) - engExponent
  if (shift >= 3) {
    // rounding carried the mantissa up to 1000 (999.6 -> 1000), so start the next
    // engineering step; the coarser re-render is guaranteed to carry the same way
    engExponent += 3
    text = value.toExponential(places)
    shift = exponentOf(text) - engExponent
  }

  const sign = engExponent < 0 ? '-' : '+'
  return `${renderMantissa(text.split('e')[0], shift, places)}e${sign}${Math.abs(engExponent)}`
}

const util: Utility = {
  id: 'number_format',
  name: 'number format',
  category: 'Numbers',
  description:
    'Format numbers as grouped thousands, fixed decimals, scientific or engineering notation, percentages, currency or compact form, using any locale and an optional custom thousands separator.',
  accepts: 'string',
  produces: 'string',
  params: {
    style: { kind: 'select', label: 'style', options: STYLES, default: 'thousands' },
    decimals: { kind: 'number', label: 'decimal places', default: 2, min: 0, max: 20, integer: true },
    locale: { kind: 'string', label: 'locale', default: 'en-US' },
    currency: { kind: 'string', label: 'currency code', default: 'USD' },
    separator: { kind: 'string', label: 'custom thousands separator', default: '' },
    perLine: { kind: 'boolean', label: 'one number per line', default: true }
  },
  tags: ['number formatting', 'thousands separator', 'percent format', 'currency format', 'scientific notation', 'locale number'],
  aliases: ['intl.numberformat'],
  examples: [
    { title: 'thousands', input: '1234567.891', params: { style: 'thousands', decimals: 2 }, output: '1,234,567.89' },
    { title: 'percent', input: '0.4567', params: { style: 'percent', decimals: 1 }, output: '45.7%' }
  ],
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const {
      style: styleRaw,
      decimals: decimalsRaw,
      locale: localeRaw,
      currency: currencyRaw,
      separator: separatorRaw,
      perLine = true
    } = params || {}

    const style = STYLES.indexOf(styleRaw) >= 0 ? styleRaw : 'thousands'
    const decimalsNumber = decimalsRaw === '' || decimalsRaw == null ? 2 : Number(decimalsRaw)
    if (!Number.isFinite(decimalsNumber)) throw new Error('decimal places must be a number')
    const decimals = Math.min(20, Math.max(0, Math.trunc(decimalsNumber)))
    const locale = String(localeRaw || 'en-US')
    const currency = String(currencyRaw || 'USD').toUpperCase()
    const separator = separatorRaw == null ? '' : String(separatorRaw)

    const grouped = separator !== '' ? true : !(style === 'decimal' || style === 'fixed')

    const format = (token: string): string => {
      const value = parseHumanNumber(token)
      switch (style) {
        case 'scientific':
          return value.toExponential(decimals).replace('.', decimalSeparatorFor(locale))
        case 'engineering':
          return toEngineering(value, decimals).replace('.', decimalSeparatorFor(locale))
        case 'percent':
          return renderParts(
            locale,
            {
              style: 'percent',
              useGrouping: grouped,
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            },
            value,
            separator
          )
        case 'currency':
          return renderParts(
            locale,
            {
              style: 'currency',
              currency,
              useGrouping: grouped,
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            },
            value,
            separator
          )
        case 'compact':
          return renderParts(
            locale,
            {
              notation: 'compact',
              compactDisplay: 'short',
              useGrouping: grouped,
              minimumFractionDigits: 0,
              maximumFractionDigits: decimals
            },
            value,
            separator
          )
        case 'fixed':
          return renderParts(
            locale,
            {
              useGrouping: grouped,
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals
            },
            value,
            separator
          )
        case 'decimal':
        case 'thousands':
        default:
          return renderParts(
            locale,
            {
              useGrouping: grouped,
              minimumFractionDigits: 0,
              maximumFractionDigits: decimals
            },
            value,
            separator
          )
      }
    }

    if (!s.trim()) return ''
    if (perLine === false || perLine === 'false') return format(s)
    return s
      .split(/\r?\n/)
      .map((line) => (line.trim() ? format(line) : line))
      .join('\n')
  }
}

export default util
