import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * Types                                                               *
 * ------------------------------------------------------------------ */

type Wall = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  ms: number
}

type Parsed = { ms: number; detected: string }

/* ------------------------------------------------------------------ *
 * Constants                                                           *
 * ------------------------------------------------------------------ */

// milliseconds between 0001-01-01T00:00:00Z (.NET tick epoch) and 1970-01-01
const TICKS_EPOCH_MS = 62135596800000
// days between the Excel serial epoch (1899-12-30) and 1970-01-01
const EXCEL_EPOCH_DAYS = 25569
// Excel serial for 9999-12-31
const EXCEL_MAX_SERIAL = 2958465
// widest instant a JS Date can represent
const MAX_TIME = 8.64e15
const DAY_MS = 86400000

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

// obsolete / military zone designators that may appear in RFC 2822 + HTTP dates
const NAMED_ZONE_OFFSETS: Record<string, number> = {
  z: 0, ut: 0, utc: 0, gmt: 0,
  est: -300, edt: -240, cst: -360, cdt: -300,
  mst: -420, mdt: -360, pst: -480, pdt: -420
}

/* ------------------------------------------------------------------ *
 * Timezone helpers (Intl based, no dependencies)                      *
 * ------------------------------------------------------------------ */

const partsCache = new Map<string, Intl.DateTimeFormat>()
const localCache = new Map<string, Intl.DateTimeFormat>()

const partsFormatter = (tz: string): Intl.DateTimeFormat => {
  let f = partsCache.get(tz)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        era: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
      })
    } catch {
      throw new Error(`Unknown timezone: "${tz}"`)
    }
    partsCache.set(tz, f)
  }
  return f
}

const localFormatter = (tz: string): Intl.DateTimeFormat => {
  let f = localCache.get(tz)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat('en-US', { timeZone: tz, dateStyle: 'full', timeStyle: 'long' })
    } catch {
      throw new Error(`Unknown timezone: "${tz}"`)
    }
    localCache.set(tz, f)
  }
  return f
}

/** Treat wall-clock fields as if they were UTC. */
const utcFromWall = (w: Wall): number => {
  const d = new Date(0)
  d.setUTCFullYear(w.year, w.month - 1, w.day)
  d.setUTCHours(w.hour, w.minute, w.second, w.ms)
  return d.getTime()
}

/** Wall-clock fields exactly as Intl reports them for `tz`. */
const intlWall = (ms: number, tz: string): Wall => {
  const parts = partsFormatter(tz).formatToParts(new Date(ms))
  const get = (type: string) => {
    const p = parts.find((x) => x.type === type)
    return p ? p.value : ''
  }
  let year = Number(get('year'))
  if (/^b/i.test(get('era'))) year = 1 - year // 1 BC == astronomical year 0
  return {
    year,
    month: Number(get('month')),
    day: Number(get('day')),
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    second: Number(get('second')),
    ms: ((ms % 1000) + 1000) % 1000
  }
}

/**
 * Offset of `tz` at `ms`, rounded to whole minutes. ISO 8601 and RFC 2822
 * offsets have minute resolution, so a zone whose historical LMT offset carried
 * seconds (Europe/Paris was +00:09:21 until 1911) must be quantised — and the
 * wall clock has to be derived from the same rounded offset, otherwise the
 * rendered string re-parses to a different instant.
 */
const zoneOffsetMs = (ms: number, tz: string): number =>
  Math.round((utcFromWall(intlWall(ms, tz)) - ms) / 60000) * 60000

/** Wall-clock fields of an instant as seen in `tz`, consistent with `zoneOffsetMs`. */
const zonedParts = (ms: number, tz: string): Wall => {
  const d = new Date(ms + zoneOffsetMs(ms, tz))
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
    ms: d.getUTCMilliseconds()
  }
}

const sameWall = (a: Wall, b: Wall): boolean =>
  a.year === b.year &&
  a.month === b.month &&
  a.day === b.day &&
  a.hour === b.hour &&
  a.minute === b.minute &&
  a.second === b.second

/**
 * Interpret wall-clock fields as local time in `tz` and return the UTC instant.
 * Probing the offset a day either side of the guess makes DST transitions
 * resolve the way every mainstream library does: a time that happened twice
 * (clocks went back) takes the first occurrence, and a time that never happened
 * (clocks went forward) shifts forward by the gap instead of backwards.
 */
const wallToUtcMs = (w: Wall, tz: string): number => {
  const guess = utcFromWall(w)
  if (!Number.isFinite(guess)) return guess // caller's range check reports it
  const clamp = (t: number) => Math.min(Math.max(t, -MAX_TIME), MAX_TIME)
  const before = zoneOffsetMs(clamp(guess - DAY_MS), tz)
  const after = zoneOffsetMs(clamp(guess + DAY_MS), tz)
  const candidates = before === after ? [guess - before] : [guess - before, guess - after]
  const valid = candidates.filter((t) => Math.abs(t) <= MAX_TIME && sameWall(zonedParts(t, tz), w))
  return valid.length ? Math.min(...valid) : guess - before
}

/* ------------------------------------------------------------------ *
 * Small formatting helpers                                            *
 * ------------------------------------------------------------------ */

const p2 = (n: number) => String(Math.abs(n)).padStart(2, '0')
const p3 = (n: number) => String(Math.abs(n)).padStart(3, '0')

const yearString = (y: number): string => {
  if (y < 0) return '-' + String(-y).padStart(6, '0')
  if (y > 9999) return '+' + String(y).padStart(6, '0')
  return String(y).padStart(4, '0')
}

const offsetString = (minutes: number, colon: boolean): string => {
  const sign = minutes < 0 ? '-' : '+'
  const abs = Math.abs(minutes)
  return `${sign}${p2(Math.floor(abs / 60))}${colon ? ':' : ''}${p2(Math.round(abs % 60))}`
}

const weekdayIndex = (w: Wall): number => new Date(utcFromWall(w)).getUTCDay()

const isLeapYear = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

const dayOfYear = (w: Wall): number => {
  const start = new Date(0)
  start.setUTCFullYear(w.year, 0, 1)
  start.setUTCHours(0, 0, 0, 0)
  const cur = new Date(0)
  cur.setUTCFullYear(w.year, w.month - 1, w.day)
  cur.setUTCHours(0, 0, 0, 0)
  return Math.round((cur.getTime() - start.getTime()) / 86400000) + 1
}

// sliced by code point so an astral character never becomes a lone surrogate
const clip = (s: string) => {
  const cps = Array.from(s)
  return cps.length > 40 ? cps.slice(0, 40).join('') + '…' : s
}

/* ------------------------------------------------------------------ *
 * Parsing                                                             *
 * ------------------------------------------------------------------ */

const NUM_RE = /^([+-]?)(\d+)(?:\.(\d+))?$/
const ISO_RE =
  /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:([Tt ])(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|z|[+-]\d{2}:?\d{2})?$/
const RFC_RE =
  /^(?:([A-Za-z]{3,9}),?\s+)?(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s+([A-Za-z]{1,5}|[+-]\d{4}|[+-]\d{2}:\d{2}))?\s*$/
const ASCTIME_RE = /^[A-Za-z]{3,9}\s+([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(\d{4})$/

const checkRange = (p: Parsed): Parsed => {
  if (!Number.isFinite(p.ms) || Math.abs(p.ms) > MAX_TIME) {
    throw new Error(`Timestamp is outside the representable date range: ${p.ms}`)
  }
  return p
}

const excelSerialToMs = (serial: number): number => {
  // Excel wrongly believes 1900 was a leap year; serials below 60 are one day off.
  const days = serial < 60 ? serial + 1 : serial
  return Math.round((days - EXCEL_EPOCH_DAYS) * 86400000)
}

const zoneToMinutes = (zone: string): number => {
  const z = zone.trim()
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(z)
  if (m) return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]))
  const named = NAMED_ZONE_OFFSETS[z.toLowerCase()]
  if (named === undefined) throw new Error(`Unknown timezone designator: "${zone}"`)
  return named
}

const parseNumeric = (raw: string, m: RegExpExecArray): Parsed => {
  const digits = m[2].replace(/^0+(?=\d)/, '')
  const negative = m[1] === '-'
  const n = Number(raw)

  // .NET ticks (100-nanosecond intervals since 0001-01-01) are always 18+ digits
  // for anything after the year 1; parse with BigInt so precision survives.
  if (digits.length >= 18) {
    const ticks = BigInt(digits) * (negative ? -1n : 1n)
    return checkRange({ ms: Number(ticks / 10000n) - TICKS_EPOCH_MS, detected: 'dotnet-ticks' })
  }

  const abs = Math.abs(n)
  if (abs >= 1e14) return checkRange({ ms: Math.round(n / 1000), detected: 'unix-microseconds' })
  if (abs >= 1e11) return checkRange({ ms: Math.round(n), detected: 'unix-milliseconds' })
  if (abs >= 1e6) return checkRange({ ms: Math.round(n * 1000), detected: 'unix-seconds' })
  // Below ~1e6 a bare number is far more likely to be an Excel serial day number
  // (1 == 1900-01-01, ~46000 == today) than a timestamp 11 days after the epoch.
  if (n > 0 && n <= EXCEL_MAX_SERIAL) return checkRange({ ms: excelSerialToMs(n), detected: 'excel-serial' })
  return checkRange({ ms: Math.round(n * 1000), detected: 'unix-seconds' })
}

const assertRealDate = (w: Wall, raw: string): void => {
  if (w.month < 1 || w.month > 12) throw new Error(`Invalid month in "${clip(raw)}"`)
  if (w.day < 1 || w.day > 31) throw new Error(`Invalid day in "${clip(raw)}"`)
  if (w.hour > 24 || w.minute > 59 || w.second > 60) throw new Error(`Invalid time in "${clip(raw)}"`)
  // midnight, not midday: midday would push the largest representable instant
  // (+275760-09-13T00:00:00Z) past the Date range and reject a legal date
  const probeMs = utcFromWall({ ...w, hour: 0, minute: 0, second: 0, ms: 0 })
  if (!Number.isFinite(probeMs)) {
    throw new Error(`Timestamp is outside the representable date range: "${clip(raw)}"`)
  }
  const probe = new Date(probeMs)
  if (probe.getUTCMonth() + 1 !== w.month || probe.getUTCDate() !== w.day) {
    throw new Error(`No such calendar date: "${clip(raw)}"`)
  }
}

const parseIso = (raw: string, m: RegExpExecArray, tz: string): Parsed => {
  const w: Wall = {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: m[5] ? Number(m[5]) : 0,
    minute: m[6] ? Number(m[6]) : 0,
    second: m[7] ? Number(m[7]) : 0,
    ms: m[8] ? Number((m[8] + '000').slice(0, 3)) : 0
  }
  assertRealDate(w, raw)
  const zone = m[9]
  const detected = !zone && m[4] === ' ' ? 'sql' : 'iso8601'
  if (zone) {
    return checkRange({ ms: utcFromWall(w) - zoneToMinutes(zone) * 60000, detected })
  }
  // naive date/time: interpret in the requested timezone
  return checkRange({ ms: wallToUtcMs(w, tz), detected })
}

const parseRfc = (raw: string, m: RegExpExecArray): Parsed => {
  const monthIdx = MONTH_ABBR.indexOf(m[3].slice(0, 3).toLowerCase())
  if (monthIdx < 0) throw new Error(`Unknown month name: "${m[3]}"`)
  let year = Number(m[4])
  if (m[4].length === 2) year = year < 50 ? 2000 + year : 1900 + year
  const w: Wall = {
    year,
    month: monthIdx + 1,
    day: Number(m[2]),
    hour: Number(m[5]),
    minute: Number(m[6]),
    second: m[7] ? Number(m[7]) : 0,
    ms: 0
  }
  assertRealDate(w, raw)
  const zone = m[8] || 'GMT'
  const isHttp = !!m[1] && /^gmt$/i.test(zone)
  return checkRange({
    ms: utcFromWall(w) - zoneToMinutes(zone) * 60000,
    detected: isHttp ? 'http-date' : 'rfc2822'
  })
}

const parseAsctime = (raw: string, m: RegExpExecArray): Parsed => {
  const monthIdx = MONTH_ABBR.indexOf(m[1].slice(0, 3).toLowerCase())
  if (monthIdx < 0) throw new Error(`Unknown month name: "${m[1]}"`)
  const w: Wall = {
    year: Number(m[6]),
    month: monthIdx + 1,
    day: Number(m[2]),
    hour: Number(m[3]),
    minute: Number(m[4]),
    second: Number(m[5]),
    ms: 0
  }
  assertRealDate(w, raw)
  return checkRange({ ms: utcFromWall(w), detected: 'http-date' })
}

// A zone-less string handed to Date.parse ("January 15, 2024") is resolved in
// the *host's* timezone, which ignores the `timezone` param and makes the answer
// depend on the machine — so its wall clock is re-read in the requested zone.
const HAS_ZONE_RE = /(?:Z|[+-]\d{2}:?\d{2}|\bGMT\b|\bUTC\b|\bUT\b)\s*$/i

const parseFallback = (s: string, tz: string): Parsed | null => {
  const t = Date.parse(s)
  if (!Number.isFinite(t)) return null
  if (HAS_ZONE_RE.test(s)) return { ms: t, detected: 'date-string' }
  const d = new Date(t)
  const w: Wall = {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
    second: d.getSeconds(),
    ms: d.getMilliseconds()
  }
  return { ms: wallToUtcMs(w, tz), detected: 'date-string' }
}

/** Auto-detect and parse a single timestamp token. */
export const parseTimestamp = (raw: string, tz: string): Parsed => {
  const s = raw.trim()
  if (!s) throw new Error('Empty timestamp')

  const num = NUM_RE.exec(s)
  if (num) return parseNumeric(s, num)

  const iso = ISO_RE.exec(s)
  if (iso) return parseIso(s, iso, tz)

  const rfc = RFC_RE.exec(s)
  if (rfc) return parseRfc(s, rfc)

  const asc = ASCTIME_RE.exec(s)
  if (asc) return parseAsctime(s, asc)

  const fallback = parseFallback(s, tz)
  if (fallback) return checkRange(fallback)

  throw new Error(`Unrecognized timestamp: "${clip(s)}"`)
}

/* ------------------------------------------------------------------ *
 * Rendering                                                           *
 * ------------------------------------------------------------------ */

const isoString = (ms: number, tz: string): string => {
  const w = zonedParts(ms, tz)
  const off = zoneOffsetMs(ms, tz) / 60000
  return (
    `${yearString(w.year)}-${p2(w.month)}-${p2(w.day)}` +
    `T${p2(w.hour)}:${p2(w.minute)}:${p2(w.second)}.${p3(w.ms)}` +
    (off === 0 ? 'Z' : offsetString(off, true))
  )
}

const sqlString = (ms: number, tz: string): string => {
  const w = zonedParts(ms, tz)
  return `${yearString(w.year)}-${p2(w.month)}-${p2(w.day)} ${p2(w.hour)}:${p2(w.minute)}:${p2(w.second)}`
}

const rfc2822String = (ms: number, tz: string): string => {
  const w = zonedParts(ms, tz)
  const off = zoneOffsetMs(ms, tz) / 60000
  return (
    `${WEEKDAYS_SHORT[weekdayIndex(w)]}, ${p2(w.day)} ${MONTHS_SHORT[w.month - 1]} ${yearString(w.year)} ` +
    `${p2(w.hour)}:${p2(w.minute)}:${p2(w.second)} ${offsetString(off, false)}`
  )
}

const httpString = (ms: number): string => {
  const d = new Date(ms)
  return (
    `${WEEKDAYS_SHORT[d.getUTCDay()]}, ${p2(d.getUTCDate())} ${MONTHS_SHORT[d.getUTCMonth()]} ` +
    `${yearString(d.getUTCFullYear())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())} GMT`
  )
}

const localString = (ms: number, tz: string): string => localFormatter(tz).format(new Date(ms))

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000000],
  ['month', 2592000000],
  ['week', 604800000],
  ['day', 86400000],
  ['hour', 3600000],
  ['minute', 60000],
  ['second', 1000]
]

// cached: the pipeline re-runs on every keystroke
let relativeFmt: Intl.RelativeTimeFormat | null = null

const relativeString = (ms: number, nowMs: number): string => {
  if (!relativeFmt) relativeFmt = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const rtf = relativeFmt
  const diff = ms - nowMs
  const abs = Math.abs(diff)
  for (const [unit, size] of RELATIVE_UNITS) {
    if (abs >= size) return rtf.format(Math.round(diff / size), unit)
  }
  return rtf.format(0, 'second')
}

const render = (ms: number, to: string, tz: string, nowMs: number): string => {
  switch (to) {
    case 'iso':
      return isoString(ms, tz)
    case 'unix':
      return String(Math.floor(ms / 1000))
    case 'unix-ms':
      return String(ms)
    case 'rfc2822':
      return rfc2822String(ms, tz)
    case 'http':
      return httpString(ms)
    case 'sql':
      return sqlString(ms, tz)
    case 'local':
      return localString(ms, tz)
    case 'relative':
      return relativeString(ms, nowMs)
    default:
      throw new Error(`Unknown target format: "${to}"`)
  }
}

const describe = (parsed: Parsed, raw: string, tz: string, nowMs: number): Record<string, unknown> => {
  const { ms } = parsed
  const w = zonedParts(ms, tz)
  return {
    input: raw,
    detected: parsed.detected,
    timezone: tz,
    utcOffset: offsetString(zoneOffsetMs(ms, tz) / 60000, true),
    unix: Math.floor(ms / 1000),
    unixMs: ms,
    iso: isoString(ms, tz),
    isoUtc: new Date(ms).toISOString(),
    rfc2822: rfc2822String(ms, tz),
    http: httpString(ms),
    sql: sqlString(ms, tz),
    local: localString(ms, tz),
    relative: relativeString(ms, nowMs),
    dayOfWeek: WEEKDAYS_LONG[weekdayIndex(w)],
    dayOfYear: dayOfYear(w),
    isLeapYear: isLeapYear(w.year)
  }
}

/* ------------------------------------------------------------------ *
 * Utility                                                             *
 * ------------------------------------------------------------------ */

const util: Utility = {
  id: 'timestamp_convert',
  name: 'timestamp convert',
  category: 'Date & Time',
  description:
    'Auto-detect a unix (s/ms/µs), ISO 8601, RFC 2822, HTTP-date, SQL, .NET ticks or Excel serial timestamp and convert it to iso, unix, unix-ms, rfc2822, http, sql, local or relative form — or all of them at once — in any IANA timezone.',
  accepts: 'string',
  produces: ['string', 'json'],
  params: {
    to: {
      kind: 'select',
      label: 'convert to',
      options: ['all', 'iso', 'unix', 'unix-ms', 'rfc2822', 'http', 'sql', 'local', 'relative'],
      default: 'all'
    },
    timezone: {
      kind: 'string',
      label: 'timezone',
      default: 'UTC',
      placeholder: 'UTC, America/New_York, Europe/Paris…'
    },
    perLine: { kind: 'boolean', label: 'one timestamp per line', default: true }
  },
  tags: ['timestamp', 'unix', 'epoch', 'date', 'iso8601', 'convert', 'rfc2822'],
  examples: [
    {
      title: 'unix seconds to ISO',
      input: '1710494400',
      params: { to: 'iso' },
      output: '2024-03-15T09:20:00.000Z'
    },
    {
      title: 'ISO to unix seconds',
      input: '2024-03-15T09:30:00Z',
      params: { to: 'unix' },
      output: '1710495000'
    }
  ],
  apply: (input: any, params: any) => {
    const src = String(input ?? '')
    const to = String(params?.to ?? 'all') || 'all'
    const tz = String(params?.timezone ?? 'UTC').trim() || 'UTC'
    const perLine = params?.perLine === undefined ? true : !!params.perLine

    if (!src.trim()) return ''

    const nowMs = Date.now()
    const tokens = perLine ? src.split(/\r?\n/) : [src]

    if (to === 'all') {
      const rows = tokens
        .filter((t) => t.trim() !== '')
        .map((t) => describe(parseTimestamp(t, tz), t.trim(), tz, nowMs))
      return (rows.length === 1 ? rows[0] : (rows as unknown)) as Record<string, unknown>
    }

    return tokens.map((line) => (line.trim() === '' ? '' : render(parseTimestamp(line, tz).ms, to, tz, nowMs))).join('\n')
  }
}

export default util
