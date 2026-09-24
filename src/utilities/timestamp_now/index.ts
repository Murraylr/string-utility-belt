import type { Utility, Value } from '@/types/utility'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const FORMATS = ['iso', 'unix', 'unix-ms', 'rfc2822', 'http', 'sql', 'local', 'all']

type Parts = {
  year: string
  month: string
  day: string
  hour: string
  minute: string
  second: string
  weekday: string
}

const partFormatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let dtf = partFormatters.get(timeZone)
  if (!dtf) {
    try {
      dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    } catch {
      throw new Error(`unknown timezone: ${timeZone}`)
    }
    partFormatters.set(timeZone, dtf)
  }
  return dtf
}

function partsIn(date: Date, timeZone: string): Parts {
  const bag: Record<string, string> = {}
  for (const part of formatterFor(timeZone).formatToParts(date)) bag[part.type] = part.value
  return {
    year: bag.year ?? '0000',
    month: bag.month ?? '01',
    day: bag.day ?? '01',
    hour: bag.hour === '24' ? '00' : (bag.hour ?? '00'),
    minute: bag.minute ?? '00',
    second: bag.second ?? '00',
    weekday: bag.weekday ?? ''
  }
}

/** Minutes east of UTC for `timeZone` at this instant (DST aware). */
function offsetMinutes(date: Date, timeZone: string): number {
  const p = partsIn(date, timeZone)
  const asUtc = Date.UTC(
    Number(p.year), Number(p.month) - 1, Number(p.day),
    Number(p.hour), Number(p.minute), Number(p.second)
  )
  const wholeSeconds = Math.floor(date.getTime() / 1000) * 1000
  return Math.round((asUtc - wholeSeconds) / 60000)
}

function offsetLabel(minutes: number, colon = true): string {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${sign}${hh}${colon ? ':' : ''}${mm}`
}

function isoIn(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone)
  const off = offsetMinutes(date, timeZone)
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0')
  const zone = off === 0 ? 'Z' : offsetLabel(off)
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${ms}${zone}`
}

function rfc2822In(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone)
  const off = offsetMinutes(date, timeZone)
  const month = MONTHS[Number(p.month) - 1] ?? 'Jan'
  return `${p.weekday}, ${p.day} ${month} ${p.year} ${p.hour}:${p.minute}:${p.second} ${offsetLabel(off, false)}`
}

function sqlIn(date: Date, timeZone: string): string {
  const p = partsIn(date, timeZone)
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`
}

function localIn(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      dateStyle: 'full',
      timeStyle: 'long'
    }).format(date)
  } catch {
    throw new Error(`unknown timezone: ${timeZone}`)
  }
}

const util: Utility = {
  id: 'timestamp_now',
  name: 'current timestamp',
  category: 'Generators',
  description:
    'Emit the current time as ISO 8601, unix seconds or milliseconds, RFC 2822, HTTP, SQL or a local string — in any timezone, optionally shifted by a number of seconds.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['time', 'date', 'now', 'epoch', 'unix time', 'current time', 'timestamp'],
  aliases: ['date +%s', 'now()'],
  examples: [
    {
      title: 'current time as ISO 8601',
      input: '',
      params: { format: 'iso' },
      outputMatches: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z$'
    },
    {
      title: 'current time as unix seconds',
      input: '',
      params: { format: 'unix' },
      outputMatches: '^\\d{9,10}$'
    }
  ],
  params: {
    format: {
      kind: 'select',
      label: 'format',
      options: FORMATS,
      default: 'iso'
    },
    timezone: { kind: 'string', label: 'timezone', default: 'UTC', placeholder: 'UTC, Europe/Paris, …' },
    offsetSeconds: { kind: 'number', label: 'offset (seconds)', default: 0 }
  },
  apply: (_input: any, params: any = {}): Value => {
    const format = String(params.format ?? 'iso')
    if (!FORMATS.includes(format)) throw new Error(`unknown format: ${format}`)

    const rawTz = params.timezone === undefined || params.timezone === null ? 'UTC' : String(params.timezone).trim()
    const timezone = rawTz === '' ? 'UTC' : rawTz

    const rawOffset = Number(params.offsetSeconds ?? 0)
    if (!Number.isFinite(rawOffset)) throw new Error('offset (seconds) must be a number')
    const offsetSeconds = Math.trunc(rawOffset)

    const millis = Date.now() + offsetSeconds * 1000
    if (!Number.isFinite(millis) || Math.abs(millis) > 8.64e15) {
      throw new Error('offset (seconds) moves the time outside the representable date range')
    }
    const date = new Date(millis)

    switch (format) {
      case 'iso':
        return isoIn(date, timezone)
      case 'unix':
        return String(Math.floor(date.getTime() / 1000))
      case 'unix-ms':
        return String(date.getTime())
      case 'rfc2822':
        return rfc2822In(date, timezone)
      case 'http':
        // RFC 7231 requires the HTTP-date to be expressed in GMT
        return date.toUTCString()
      case 'sql':
        return sqlIn(date, timezone)
      case 'local':
        return localIn(date, timezone)
      default:
        return {
          iso: isoIn(date, timezone),
          unix: Math.floor(date.getTime() / 1000),
          unixMs: date.getTime(),
          rfc2822: rfc2822In(date, timezone),
          http: date.toUTCString(),
          sql: sqlIn(date, timezone),
          local: localIn(date, timezone),
          timezone,
          utcOffset: offsetLabel(offsetMinutes(date, timezone)),
          offsetSeconds
        }
    }
  }
}

export default util
