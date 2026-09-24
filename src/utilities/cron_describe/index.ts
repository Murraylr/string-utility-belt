import type { Utility } from '@/types/utility'

// cronstrue is loaded lazily so it never lands in the app's initial bundle.
// The plain build only speaks English; the i18n build carries every locale.
let _cronstrue: any = null
let _cronstrueI18n: any = null
const getCronstrue = async (locale: string): Promise<any> => {
  if (locale === 'en') return (_cronstrue ??= (await import('cronstrue')).default)
  return (_cronstrueI18n ??= (await import('cronstrue/i18n')).default)
}

type FieldKind = 'second' | 'minute' | 'hour' | 'dayOfMonth' | 'month' | 'dayOfWeek' | 'year'

const FIELD_LABEL: Record<FieldKind, string> = {
  second: 'second',
  minute: 'minute',
  hour: 'hour',
  dayOfMonth: 'day of month',
  month: 'month',
  dayOfWeek: 'day of week',
  year: 'year'
}

const EVERY: Record<FieldKind, string> = {
  second: 'every second',
  minute: 'every minute',
  hour: 'every hour',
  dayOfMonth: 'every day of the month',
  month: 'every month',
  dayOfWeek: 'every day of the week',
  year: 'every year'
}

const UNIT_SINGULAR: Record<FieldKind, string> = {
  second: 'second',
  minute: 'minute',
  hour: 'hour',
  dayOfMonth: 'day',
  month: 'month',
  dayOfWeek: 'day of the week',
  year: 'year'
}

const UNIT_PLURAL: Record<FieldKind, string> = {
  second: 'seconds',
  minute: 'minutes',
  hour: 'hours',
  dayOfMonth: 'days',
  month: 'months',
  dayOfWeek: 'days of the week',
  year: 'years'
}

// Month / weekday names get spelled out; numeric fields keep a short noun prefix.
const PREFIX_SINGULAR: Record<FieldKind, string> = {
  second: 'second ',
  minute: 'minute ',
  hour: 'hour ',
  dayOfMonth: 'day ',
  month: '',
  dayOfWeek: '',
  year: 'year '
}
const PREFIX_PLURAL: Record<FieldKind, string> = {
  second: 'seconds ',
  minute: 'minutes ',
  hour: 'hours ',
  dayOfMonth: 'days ',
  month: '',
  dayOfWeek: '',
  year: 'years '
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]
const MONTH_ABBR = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_ABBR = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth']

const ALIASES: Record<string, string[]> = {
  '@yearly': ['0', '0', '1', '1', '*'],
  '@annually': ['0', '0', '1', '1', '*'],
  '@monthly': ['0', '0', '1', '*', '*'],
  '@weekly': ['0', '0', '*', '*', 'SUN'],
  '@daily': ['0', '0', '*', '*', '*'],
  '@midnight': ['0', '0', '*', '*', '*'],
  '@hourly': ['0', '*', '*', '*', '*']
}

const joinList = (items: string[]): string => {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const dayName = (n: number, zeroBased: boolean): string =>
  zeroBased ? DAYS[((n % 7) + 7) % 7] : DAYS[(((n - 1) % 7) + 7) % 7]

/** Human label for one bare value inside a field ("3" -> "March" for months). */
const itemLabel = (kind: FieldKind, token: string, zeroBased: boolean): string => {
  const t = token.trim()
  if (kind === 'month') {
    if (/^\d+$/.test(t)) {
      const n = Number(t)
      return n >= 1 && n <= 12 ? MONTHS[n - 1] : t
    }
    const idx = MONTH_ABBR.indexOf(t.slice(0, 3).toUpperCase())
    return idx >= 0 ? MONTHS[idx] : t
  }
  if (kind === 'dayOfWeek') {
    if (/^\d+$/.test(t)) return dayName(Number(t), zeroBased)
    const idx = DAY_ABBR.indexOf(t.slice(0, 3).toUpperCase())
    return idx >= 0 ? DAYS[idx] : t
  }
  return t
}

const isPlainValue = (kind: FieldKind, token: string): boolean => {
  const t = token.trim()
  if (/^\d+$/.test(t)) return true
  if (kind === 'month') return MONTH_ABBR.includes(t.slice(0, 3).toUpperCase())
  if (kind === 'dayOfWeek') return DAY_ABBR.includes(t.slice(0, 3).toUpperCase())
  return false
}

const ordinal = (n: number) => ORDINALS[n - 1] ?? `${n}th`

/** Describe one comma-separated item of a cron field. */
function describeItem(kind: FieldKind, token: string, zeroBased: boolean, standalone: boolean): string {
  const t = token.trim()
  const prefix = standalone ? '' : PREFIX_SINGULAR[kind]

  if (t === '*') return EVERY[kind]

  // step: */n, a/n, a-b/n
  const step = /^(.+)\/(\d+)$/.exec(t)
  if (step) {
    const base = step[1]
    const n = Number(step[2])
    const unit = n === 1 ? UNIT_SINGULAR[kind] : UNIT_PLURAL[kind]
    if (base === '*') return n === 1 ? EVERY[kind] : `every ${n} ${unit}`
    const range = /^(.+)-(.+)$/.exec(base)
    if (range) {
      return `every ${n} ${unit} from ${itemLabel(kind, range[1], zeroBased)} through ${itemLabel(
        kind,
        range[2],
        zeroBased
      )}`
    }
    return `every ${n} ${unit} starting at ${PREFIX_SINGULAR[kind]}${itemLabel(kind, base, zeroBased)}`.trim()
  }

  // day-of-month specials
  if (kind === 'dayOfMonth') {
    if (t.toUpperCase() === 'L') return 'the last day of the month'
    if (t.toUpperCase() === 'LW') return 'the last weekday of the month'
    const before = /^L-(\d+)$/i.exec(t)
    if (before) {
      const n = Number(before[1])
      return `${n} ${n === 1 ? 'day' : 'days'} before the last day of the month`
    }
    const nearest = /^(\d+)W$/i.exec(t)
    if (nearest) return `the weekday nearest day ${nearest[1]}`
  }

  // day-of-week specials
  if (kind === 'dayOfWeek') {
    const nth = /^(\w+)#(\d+)$/.exec(t)
    if (nth) return `the ${ordinal(Number(nth[2]))} ${itemLabel(kind, nth[1], zeroBased)} of the month`
    const last = /^(\w+)L$/i.exec(t)
    if (last && t.toUpperCase() !== 'L') {
      return `the last ${itemLabel(kind, last[1], zeroBased)} of the month`
    }
    if (t.toUpperCase() === 'L') return `${dayName(zeroBased ? 6 : 7, zeroBased)} (the last day of the week)`
  }

  if (t === '?') return `any ${FIELD_LABEL[kind]} (no specific value)`

  // range a-b
  const range = /^(.+)-(.+)$/.exec(t)
  if (range) {
    const lo = itemLabel(kind, range[1], zeroBased)
    const hi = itemLabel(kind, range[2], zeroBased)
    return `${standalone ? '' : PREFIX_PLURAL[kind]}${lo} through ${hi}`
  }

  if (isPlainValue(kind, t)) return `${prefix}${itemLabel(kind, t, zeroBased)}`
  return t
}

/** Plain-English description of a whole cron field. */
export function describeCronField(kind: FieldKind, value: string, zeroBased: boolean): string {
  const v = String(value ?? '').trim()
  if (v === '') return ''
  if (v === '*') return EVERY[kind]
  if (v === '?') return `any ${FIELD_LABEL[kind]} (no specific value)`
  const parts = v.split(',')
  if (parts.length === 1) return describeItem(kind, parts[0], zeroBased, false)
  if (parts.every((p) => isPlainValue(kind, p))) {
    const labels = parts.map((p) => itemLabel(kind, p, zeroBased))
    return `${PREFIX_PLURAL[kind]}${joinList(labels)}`
  }
  return joinList(parts.map((p) => describeItem(kind, p, zeroBased, true)))
}

/**
 * Which field is which depends on the part count. A 6-part expression is ambiguous:
 * mirror cronstrue's rule — a trailing 4-digit year (or a `?` where a seconds-first
 * reading would not put one) means there is no seconds field.
 */
export const kindsFor = (parts: string[]): FieldKind[] => {
  if (parts.length >= 7) return ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek', 'year']
  if (parts.length === 6) {
    const yearWithNoSeconds = /\d{4}$/.test(parts[5]) || parts[4] === '?' || parts[2] === '?'
    return yearWithNoSeconds
      ? ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek', 'year']
      : ['second', 'minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']
  }
  return ['minute', 'hour', 'dayOfMonth', 'month', 'dayOfWeek']
}

const util: Utility = {
  id: 'cron_describe',
  name: 'cron describe',
  category: 'Date & Time',
  description:
    'Turn a cron expression into a plain-English schedule plus a field-by-field breakdown, with locale, verbose, 24-hour, zero-indexed weekday and seconds-field options.',
  accepts: 'string',
  produces: ['string', 'json'],
  params: {
    format: { kind: 'select', label: 'output', options: ['text', 'json'], default: 'text' },
    locale: {
      kind: 'select',
      label: 'locale',
      options: ['en', 'es', 'fr', 'de', 'it', 'nl', 'pt_BR'],
      default: 'en'
    },
    verbose: { kind: 'boolean', label: 'verbose wording', default: false },
    use24Hour: { kind: 'boolean', label: '24-hour clock', default: true },
    dayOfWeekStartIndexZero: { kind: 'boolean', label: 'weekday index starts at 0 (Sunday)', default: true },
    seconds: { kind: 'boolean', label: 'seconds field (prepend "0" to a 5-field expression)', default: false }
  },
  tags: ['cron', 'crontab', 'schedule', 'describe', 'cronstrue', 'quartz', 'human readable'],
  examples: [
    {
      title: 'weekday schedule',
      input: '0 9 * * MON-FRI',
      output:
        'At 09:00, Monday through Friday\n\nminute        0        minute 0\nhour          9        hour 9\nday of month  *        every day of the month\nmonth         *        every month\nday of week   MON-FRI  Monday through Friday'
    },
    {
      title: 'json output',
      input: '*/15 * * * *',
      params: { format: 'json' },
      output:
        '{\n  "expression": "*/15 * * * *",\n  "description": "Every 15 minutes",\n  "fields": [\n    {\n      "field": "minute",\n      "value": "*/15",\n      "description": "every 15 minutes"\n    },\n    {\n      "field": "hour",\n      "value": "*",\n      "description": "every hour"\n    },\n    {\n      "field": "day of month",\n      "value": "*",\n      "description": "every day of the month"\n    },\n    {\n      "field": "month",\n      "value": "*",\n      "description": "every month"\n    },\n    {\n      "field": "day of week",\n      "value": "*",\n      "description": "every day of the week"\n    }\n  ]\n}'
    }
  ],
  apply: async (input: any, params: any = {}) => {
    const format = String(params.format || 'text')
    const locale = String(params.locale || 'en')
    const verbose = params.verbose === true
    const use24Hour = params.use24Hour !== false
    const zeroBased = params.dayOfWeekStartIndexZero !== false
    const wantSeconds = params.seconds === true

    const raw = String(input ?? '').trim()
    if (!raw) return format === 'json' ? {} : ''

    // one expression per run: take the first non-empty line
    const line = raw.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? ''

    if (line.toLowerCase() === '@reboot') {
      const description = 'At system startup'
      const fields = [{ field: 'special', value: '@reboot', description }]
      if (format === 'json') return { expression: '@reboot', description, fields }
      return `${description}\n\nspecial  @reboot  ${description}`
    }

    const alias = ALIASES[line.toLowerCase()]
    let parts = alias ? alias.slice() : line.split(/\s+/).filter(Boolean)

    // "leading field is seconds" — give a 5-field expression an explicit second 0
    if (wantSeconds && parts.length === 5) parts = ['0', ...parts]
    if (parts.length < 5) {
      throw new Error(
        `invalid cron expression: expected at least 5 fields but got ${parts.length} ("${line}")`
      )
    }
    if (parts.length > 7) {
      throw new Error(`invalid cron expression: expected at most 7 fields but got ${parts.length} ("${line}")`)
    }

    const expression = parts.join(' ')
    const cronstrue = await getCronstrue(locale)

    let description: string
    try {
      description = cronstrue.toString(expression, {
        locale,
        verbose,
        use24HourTimeFormat: use24Hour,
        dayOfWeekStartIndexZero: zeroBased,
        throwExceptionOnParseError: true
      })
    } catch (err: any) {
      const message = String(err?.message ?? err).replace(/^Error:\s*/, '')
      throw new Error(`invalid cron expression "${line}": ${message}`)
    }

    const kinds = kindsFor(parts)
    const fields = kinds.map((kind, i) => ({
      field: FIELD_LABEL[kind],
      value: parts[i] ?? '*',
      description: describeCronField(kind, parts[i] ?? '*', zeroBased)
    }))

    if (format === 'json') return { expression, description, fields }

    const nameWidth = Math.max(...fields.map((f) => f.field.length))
    const valueWidth = Math.max(...fields.map((f) => f.value.length))
    const table = fields
      .map((f) => `${f.field.padEnd(nameWidth)}  ${f.value.padEnd(valueWidth)}  ${f.description}`)
      .join('\n')
    return `${description}\n\n${table}`
  }
}

export default util
