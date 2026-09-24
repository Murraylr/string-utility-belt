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

type Fields = {
  epochMs: number
  date: Date
  tz: string
  locale: string
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  msPart: number
  weekday: number // 0 = Sunday
  dayOfYear: number
  isoWeek: number
  isoWeekYear: number
  offsetMinutes: number
}

/* ------------------------------------------------------------------ *
 * Constants                                                           *
 * ------------------------------------------------------------------ */

const DEFAULT_FORMAT = 'YYYY-MM-DD HH:mm:ss'

const TICKS_EPOCH_MS = 62135596800000
const EXCEL_EPOCH_DAYS = 25569
const EXCEL_MAX_SERIAL = 2958465
const MAX_TIME = 8.64e15
const DAY_MS = 86400000

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

const NAMED_ZONE_OFFSETS: Record<string, number> = {
  z: 0, ut: 0, utc: 0, gmt: 0,
  est: -300, edt: -240, cst: -360, cdt: -300,
  mst: -420, mdt: -360, pst: -480, pdt: -420
}

/* ------------------------------------------------------------------ *
 * Intl helpers                                                        *
 * ------------------------------------------------------------------ */

const fmtCache = new Map<string, Intl.DateTimeFormat>()

const getFmt = (locale: string, tz: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
  const key = `${locale}\u0000${tz}\u0000${JSON.stringify(options)}`
  let f = fmtCache.get(key)
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(locale, { timeZone: tz, ...options })
    } catch {
      throw new Error(`Cannot format for locale "${locale}" in timezone "${tz}"`)
    }
    fmtCache.set(key, f)
  }
  return f
}

const partOf = (locale: string, tz: string, options: Intl.DateTimeFormatOptions, type: string, date: Date): string => {
  const parts = getFmt(locale, tz, options).formatToParts(date)
  const hit = parts.find((p) => p.type === type)
  return hit ? hit.value : ''
}

const validateOptions = (tz: string, locale: string): void => {
  try {
    new Intl.DateTimeFormat(locale, { timeZone: 'UTC' })
  } catch {
    throw new Error(`Invalid locale: "${locale}"`)
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
  } catch {
    throw new Error(`Unknown timezone: "${tz}"`)
  }
}

const utcFromWall = (w: Wall): number => {
  const d = new Date(0)
  d.setUTCFullYear(w.year, w.month - 1, w.day)
  d.setUTCHours(w.hour, w.minute, w.second, w.ms)
  return d.getTime()
}

/** Wall-clock fields exactly as Intl reports them for `tz`. */
const intlWall = (ms: number, tz: string): Wall => {
  const parts = getFmt('en-US', tz, {
    era: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(ms))
  const get = (type: string) => {
    const p = parts.find((x) => x.type === type)
    return p ? p.value : ''
  }
  let year = Number(get('year'))
  if (/^b/i.test(get('era'))) year = 1 - year
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
 * Offset of `tz` at `ms`, rounded to whole minutes. The Z/ZZ/%z tokens have
 * minute resolution, so a zone whose historical LMT offset carried seconds
 * (Europe/Paris was +00:09:21 until 1911) must be quantised — and the wall clock
 * has to come from the same rounded offset, otherwise a formatted timestamp
 * re-parses to a different instant.
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
 * Interpret wall-clock fields as local time in `tz`. Probing the offset a day
 * either side of the guess makes DST transitions resolve the way every
 * mainstream library does: a time that happened twice (clocks went back) takes
 * the first occurrence, and a time that never happened (clocks went forward)
 * shifts forward by the gap instead of backwards.
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
 * Timestamp parsing (auto-detect, same rules as timestamp_convert)    *
 * ------------------------------------------------------------------ */

const NUM_RE = /^([+-]?)(\d+)(?:\.(\d+))?$/
const ISO_RE =
  /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:([Tt ])(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?\s*(Z|z|[+-]\d{2}:?\d{2})?$/
const RFC_RE =
  /^(?:([A-Za-z]{3,9}),?\s+)?(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s-]+(\d{2,4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s+([A-Za-z]{1,5}|[+-]\d{4}|[+-]\d{2}:\d{2}))?\s*$/
const ASCTIME_RE = /^[A-Za-z]{3,9}\s+([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+(\d{4})$/
const HAS_ZONE_RE = /(?:Z|[+-]\d{2}:?\d{2}|\bGMT\b|\bUTC\b|\bUT\b)\s*$/i

// sliced by code point so an astral character never becomes a lone surrogate
const clip = (s: string) => {
  const cps = Array.from(s)
  return cps.length > 40 ? cps.slice(0, 40).join('') + '…' : s
}

const checkRange = (ms: number): number => {
  if (!Number.isFinite(ms) || Math.abs(ms) > MAX_TIME) {
    throw new Error(`Timestamp is outside the representable date range: ${ms}`)
  }
  return ms
}

const excelSerialToMs = (serial: number): number => {
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

const parseTimestamp = (raw: string, tz: string): number => {
  const s = raw.trim()
  if (!s) throw new Error('Empty timestamp')

  const num = NUM_RE.exec(s)
  if (num) {
    const digits = num[2].replace(/^0+(?=\d)/, '')
    const n = Number(s)
    if (digits.length >= 18) {
      const ticks = BigInt(digits) * (num[1] === '-' ? -1n : 1n)
      return checkRange(Number(ticks / 10000n) - TICKS_EPOCH_MS)
    }
    const abs = Math.abs(n)
    if (abs >= 1e14) return checkRange(Math.round(n / 1000))
    if (abs >= 1e11) return checkRange(Math.round(n))
    if (abs >= 1e6) return checkRange(Math.round(n * 1000))
    if (n > 0 && n <= EXCEL_MAX_SERIAL) return checkRange(excelSerialToMs(n))
    return checkRange(Math.round(n * 1000))
  }

  const iso = ISO_RE.exec(s)
  if (iso) {
    const w: Wall = {
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      hour: iso[5] ? Number(iso[5]) : 0,
      minute: iso[6] ? Number(iso[6]) : 0,
      second: iso[7] ? Number(iso[7]) : 0,
      ms: iso[8] ? Number((iso[8] + '000').slice(0, 3)) : 0
    }
    assertRealDate(w, s)
    if (iso[9]) return checkRange(utcFromWall(w) - zoneToMinutes(iso[9]) * 60000)
    return checkRange(wallToUtcMs(w, tz))
  }

  const rfc = RFC_RE.exec(s)
  if (rfc) {
    const monthIdx = MONTH_ABBR.indexOf(rfc[3].slice(0, 3).toLowerCase())
    if (monthIdx < 0) throw new Error(`Unknown month name: "${rfc[3]}"`)
    let year = Number(rfc[4])
    if (rfc[4].length === 2) year = year < 50 ? 2000 + year : 1900 + year
    const w: Wall = {
      year,
      month: monthIdx + 1,
      day: Number(rfc[2]),
      hour: Number(rfc[5]),
      minute: Number(rfc[6]),
      second: rfc[7] ? Number(rfc[7]) : 0,
      ms: 0
    }
    assertRealDate(w, s)
    return checkRange(utcFromWall(w) - zoneToMinutes(rfc[8] || 'GMT') * 60000)
  }

  const asc = ASCTIME_RE.exec(s)
  if (asc) {
    const monthIdx = MONTH_ABBR.indexOf(asc[1].slice(0, 3).toLowerCase())
    if (monthIdx < 0) throw new Error(`Unknown month name: "${asc[1]}"`)
    const w: Wall = {
      year: Number(asc[6]),
      month: monthIdx + 1,
      day: Number(asc[2]),
      hour: Number(asc[3]),
      minute: Number(asc[4]),
      second: Number(asc[5]),
      ms: 0
    }
    assertRealDate(w, s)
    return checkRange(utcFromWall(w))
  }

  // A zone-less string handed to Date.parse ("January 15, 2024") is resolved in
  // the *host's* timezone, which ignores the `timezone` param and makes the
  // answer depend on the machine — re-read its wall clock in the wanted zone.
  const fallback = Date.parse(s)
  if (Number.isFinite(fallback)) {
    if (HAS_ZONE_RE.test(s)) return checkRange(fallback)
    const d = new Date(fallback)
    return checkRange(
      wallToUtcMs(
        {
          year: d.getFullYear(),
          month: d.getMonth() + 1,
          day: d.getDate(),
          hour: d.getHours(),
          minute: d.getMinutes(),
          second: d.getSeconds(),
          ms: d.getMilliseconds()
        },
        tz
      )
    )
  }

  throw new Error(`Unrecognized date/timestamp: "${clip(s)}"`)
}

/* ------------------------------------------------------------------ *
 * Field extraction                                                    *
 * ------------------------------------------------------------------ */

const p2 = (n: number) => String(Math.abs(Math.trunc(n))).padStart(2, '0')
const p3 = (n: number) => String(Math.abs(Math.trunc(n))).padStart(3, '0')
const p4 = (n: number) => (n < 0 ? '-' : '') + String(Math.abs(Math.trunc(n))).padStart(4, '0')

const midnightUtc = (year: number, month: number, day: number): Date => {
  const d = new Date(0)
  d.setUTCFullYear(year, month - 1, day)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

const isoWeekOf = (year: number, month: number, day: number): { week: number; isoYear: number } => {
  const d = midnightUtc(year, month, day)
  const dayNum = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayNum + 3) // Thursday of the same ISO week
  const isoYear = d.getUTCFullYear()
  const firstThursday = midnightUtc(isoYear, 1, 4)
  firstThursday.setUTCDate(firstThursday.getUTCDate() - ((firstThursday.getUTCDay() + 6) % 7) + 3)
  return { week: 1 + Math.round((d.getTime() - firstThursday.getTime()) / 604800000), isoYear }
}

const computeFields = (epochMs: number, tz: string, locale: string): Fields => {
  const w = zonedParts(epochMs, tz)
  const local = midnightUtc(w.year, w.month, w.day)
  const yearStart = midnightUtc(w.year, 1, 1)
  const { week, isoYear } = isoWeekOf(w.year, w.month, w.day)
  return {
    epochMs,
    date: new Date(epochMs),
    tz,
    locale,
    year: w.year,
    month: w.month,
    day: w.day,
    hour: w.hour,
    minute: w.minute,
    second: w.second,
    msPart: w.ms,
    weekday: local.getUTCDay(),
    dayOfYear: Math.round((local.getTime() - yearStart.getTime()) / 86400000) + 1,
    isoWeek: week,
    isoWeekYear: isoYear,
    offsetMinutes: zoneOffsetMs(epochMs, tz) / 60000
  }
}

/* ------------------------------------------------------------------ *
 * Field renderers                                                     *
 * ------------------------------------------------------------------ */

// format() rather than formatToParts() so locales that decorate the name
// (ja-JP renders January as "1月") keep their suffix
const monthName = (f: Fields, long: boolean) =>
  getFmt(f.locale, f.tz, { month: long ? 'long' : 'short' }).format(f.date)

const weekdayName = (f: Fields, long: boolean) =>
  getFmt(f.locale, f.tz, { weekday: long ? 'long' : 'short' }).format(f.date)

const dayPeriod = (f: Fields): string => {
  const v = partOf(f.locale, f.tz, { hour: 'numeric', hour12: true }, 'dayPeriod', f.date)
  return v || (f.hour < 12 ? 'AM' : 'PM')
}

const hour12 = (f: Fields) => (f.hour % 12 === 0 ? 12 : f.hour % 12)

const offsetText = (f: Fields, colon: boolean): string => {
  const sign = f.offsetMinutes < 0 ? '-' : '+'
  const abs = Math.abs(f.offsetMinutes)
  return `${sign}${p2(Math.floor(abs / 60))}${colon ? ':' : ''}${p2(Math.round(abs % 60))}`
}

const zoneAbbr = (f: Fields) =>
  partOf(f.locale, f.tz, { timeZoneName: 'short' }, 'timeZoneName', f.date) || f.tz

const ordinal = (n: number, locale: string): string => {
  if (!/^en\b/i.test(locale)) return String(n)
  const suffixes: Record<string, string> = { one: 'st', two: 'nd', few: 'rd', other: 'th' }
  try {
    return n + (suffixes[new Intl.PluralRules(locale, { type: 'ordinal' }).select(n)] || 'th')
  } catch {
    return String(n)
  }
}

/* ------------------------------------------------------------------ *
 * Token format (YYYY-MM-DD HH:mm:ss …)                                *
 * ------------------------------------------------------------------ */

const TOKEN_RENDERERS: Record<string, (f: Fields) => string> = {
  YYYY: (f) => p4(f.year),
  YY: (f) => p2(((f.year % 100) + 100) % 100),
  GGGG: (f) => p4(f.isoWeekYear),
  Q: (f) => String(Math.floor((f.month - 1) / 3) + 1),
  MMMM: (f) => monthName(f, true),
  MMM: (f) => monthName(f, false),
  MM: (f) => p2(f.month),
  M: (f) => String(f.month),
  DDDD: (f) => p3(f.dayOfYear),
  DDD: (f) => String(f.dayOfYear),
  DD: (f) => p2(f.day),
  Do: (f) => ordinal(f.day, f.locale),
  D: (f) => String(f.day),
  dddd: (f) => weekdayName(f, true),
  ddd: (f) => weekdayName(f, false),
  dd: (f) => Array.from(weekdayName(f, false)).slice(0, 2).join(''),
  d: (f) => String(f.weekday),
  E: (f) => String(f.weekday === 0 ? 7 : f.weekday),
  HH: (f) => p2(f.hour),
  H: (f) => String(f.hour),
  kk: (f) => p2(f.hour === 0 ? 24 : f.hour),
  k: (f) => String(f.hour === 0 ? 24 : f.hour),
  hh: (f) => p2(hour12(f)),
  h: (f) => String(hour12(f)),
  mm: (f) => p2(f.minute),
  m: (f) => String(f.minute),
  ss: (f) => p2(f.second),
  s: (f) => String(f.second),
  SSS: (f) => p3(f.msPart),
  SS: (f) => p2(Math.floor(f.msPart / 10)),
  S: (f) => String(Math.floor(f.msPart / 100)),
  A: (f) => dayPeriod(f).toUpperCase(),
  a: (f) => dayPeriod(f).toLowerCase(),
  ZZ: (f) => offsetText(f, false),
  Z: (f) => offsetText(f, true),
  zz: (f) => zoneAbbr(f),
  z: (f) => zoneAbbr(f),
  WW: (f) => p2(f.isoWeek),
  W: (f) => String(f.isoWeek),
  X: (f) => String(Math.floor(f.epochMs / 1000)),
  x: (f) => String(f.epochMs)
}

const TOKENS = Object.keys(TOKEN_RENDERERS).sort((a, b) => b.length - a.length)

/* ------------------------------------------------------------------ *
 * strftime format (%Y-%m-%d …)                                        *
 * ------------------------------------------------------------------ */

const strftimeValue = (spec: string, f: Fields): string | null => {
  switch (spec) {
    case 'A': return weekdayName(f, true)
    case 'a': return weekdayName(f, false)
    case 'B': return monthName(f, true)
    case 'b':
    case 'h': return monthName(f, false)
    case 'C': return p2(Math.floor(f.year / 100))
    case 'c': return getFmt(f.locale, f.tz, { dateStyle: 'medium', timeStyle: 'medium' }).format(f.date)
    case 'D': return `${p2(f.month)}/${p2(f.day)}/${p2(((f.year % 100) + 100) % 100)}`
    case 'd': return p2(f.day)
    case 'e': return String(f.day).padStart(2, ' ')
    case 'F': return `${p4(f.year)}-${p2(f.month)}-${p2(f.day)}`
    case 'G': return p4(f.isoWeekYear)
    case 'g': return p2(((f.isoWeekYear % 100) + 100) % 100)
    case 'H': return p2(f.hour)
    case 'I': return p2(hour12(f))
    case 'j': return p3(f.dayOfYear)
    case 'k': return String(f.hour).padStart(2, ' ')
    case 'L': return p3(f.msPart)
    case 'l': return String(hour12(f)).padStart(2, ' ')
    case 'M': return p2(f.minute)
    case 'm': return p2(f.month)
    case 'N': return String(f.msPart * 1000000).padStart(9, '0')
    case 'n': return '\n'
    case 'P': return dayPeriod(f).toLowerCase()
    case 'p': return dayPeriod(f).toUpperCase()
    case 'R': return `${p2(f.hour)}:${p2(f.minute)}`
    case 'r': return `${p2(hour12(f))}:${p2(f.minute)}:${p2(f.second)} ${dayPeriod(f).toUpperCase()}`
    case 'S': return p2(f.second)
    case 's': return String(Math.floor(f.epochMs / 1000))
    case 'T': return `${p2(f.hour)}:${p2(f.minute)}:${p2(f.second)}`
    case 't': return '\t'
    case 'u': return String(f.weekday === 0 ? 7 : f.weekday)
    case 'V': return p2(f.isoWeek)
    case 'w': return String(f.weekday)
    case 'X': return getFmt(f.locale, f.tz, { timeStyle: 'medium' }).format(f.date)
    case 'x': return getFmt(f.locale, f.tz, { dateStyle: 'short' }).format(f.date)
    case 'Y': return p4(f.year)
    case 'y': return p2(((f.year % 100) + 100) % 100)
    case 'Z': return zoneAbbr(f)
    case 'z': return offsetText(f, false)
    case ':z': return offsetText(f, true)
    case '%': return '%'
    default: return null
  }
}

const applyFlag = (value: string, flag: string): string => {
  if (flag === '-') return /^0\d/.test(value) ? value.replace(/^0+(?=\d)/, '') : value.replace(/^\s+/, '')
  if (flag === '_') return value.replace(/^0+(?=\d)/, (z) => ' '.repeat(z.length))
  if (flag === '0') return value.replace(/^\s+/, (sp) => '0'.repeat(sp.length))
  return value
}

/* ------------------------------------------------------------------ *
 * Formatter                                                           *
 * ------------------------------------------------------------------ */

// A format is treated as strftime as soon as it contains one real % directive;
// otherwise every bare letter would be a token and literals like "is" would be
// eaten by the token renderer.
const STRFTIME_RE = /%[-_0]?(?::z|[AaBbCcDdeFGgHhIjkLlMmNnPpRrSsTtuVwXxYyZz%])/

/** Copy one whole code point so astral characters are never split. */
const literalAt = (s: string, i: number): string => {
  const cp = s.codePointAt(i)
  return cp === undefined ? s[i] : String.fromCodePoint(cp)
}

const formatStrftime = (fmt: string, f: Fields): string => {
  let out = ''
  let i = 0
  while (i < fmt.length) {
    if (fmt[i] === '%') {
      let j = i + 1
      let flag = ''
      if (j < fmt.length && (fmt[j] === '-' || fmt[j] === '_' || fmt[j] === '0')) {
        flag = fmt[j]
        j++
      }
      const spec = j >= fmt.length ? '' : fmt[j] === ':' ? fmt.slice(j, j + 2) : fmt[j]
      const value = spec ? strftimeValue(spec, f) : null
      if (value !== null) {
        out += applyFlag(value, flag)
        i = j + spec.length
        continue
      }
    }
    const literal = literalAt(fmt, i)
    out += literal
    i += literal.length
  }
  return out
}

const formatTokens = (fmt: string, f: Fields): string => {
  let out = ''
  let i = 0
  while (i < fmt.length) {
    const ch = fmt[i]

    // [literal text] passes through untouched
    if (ch === '[') {
      const end = fmt.indexOf(']', i + 1)
      if (end === -1) {
        out += fmt.slice(i + 1)
        break
      }
      out += fmt.slice(i + 1, end)
      i = end + 1
      continue
    }

    // backslash escapes the next character (a whole code point, not half a pair)
    if (ch === '\\') {
      const next = i + 1 < fmt.length ? literalAt(fmt, i + 1) : ''
      out += next
      i += 1 + (next.length || 1)
      continue
    }

    const token = TOKENS.find((t) => fmt.startsWith(t, i))
    if (token) {
      out += TOKEN_RENDERERS[token](f)
      i += token.length
      continue
    }

    const literal = literalAt(fmt, i)
    out += literal
    i += literal.length
  }
  return out
}

const formatDate = (epochMs: number, fmt: string, tz: string, locale: string): string => {
  const f = computeFields(epochMs, tz, locale)
  return STRFTIME_RE.test(fmt) ? formatStrftime(fmt, f) : formatTokens(fmt, f)
}

/* ------------------------------------------------------------------ *
 * Utility                                                             *
 * ------------------------------------------------------------------ */

const util: Utility = {
  id: 'date_format',
  name: 'date format',
  category: 'Date & Time',
  description:
    'Reformat dates and timestamps with token patterns (YYYY-MM-DD HH:mm:ss) or strftime patterns (%Y-%m-%d), converting to any IANA timezone and localising month and weekday names.',
  accepts: 'string',
  produces: 'string',
  params: {
    format: {
      kind: 'string',
      label: 'format',
      default: DEFAULT_FORMAT,
      placeholder: 'YYYY-MM-DD HH:mm:ss or %Y-%m-%d'
    },
    timezone: {
      kind: 'string',
      label: 'timezone',
      default: 'UTC',
      placeholder: 'UTC, America/New_York, Europe/Paris…'
    },
    locale: { kind: 'string', label: 'locale', default: 'en-US', placeholder: 'en-US, fr-FR, ja-JP…' },
    perLine: { kind: 'boolean', label: 'one date per line', default: true }
  },
  tags: ['date', 'time', 'format', 'strftime', 'moment', 'dayjs', 'timezone', 'locale'],
  aliases: ['strftime', 'date +'],
  examples: [
    {
      title: 'token format',
      input: '2024-03-15T09:30:00Z',
      params: { format: 'YYYY-MM-DD HH:mm:ss' },
      output: '2024-03-15 09:30:00'
    },
    {
      title: 'strftime format',
      input: '2024-03-15T09:30:00Z',
      params: { format: '%A, %B %d, %Y', locale: 'en-US' },
      output: 'Friday, March 15, 2024'
    }
  ],
  apply: (input: any, params: any) => {
    const src = String(input ?? '')
    const rawFormat = params?.format === undefined || params.format === null ? DEFAULT_FORMAT : String(params.format)
    const fmt = rawFormat === '' ? DEFAULT_FORMAT : rawFormat
    const tz = String(params?.timezone ?? 'UTC').trim() || 'UTC'
    const locale = String(params?.locale ?? 'en-US').trim() || 'en-US'
    const perLine = params?.perLine === undefined ? true : !!params.perLine

    if (!src.trim()) return ''
    validateOptions(tz, locale)

    const lines = perLine ? src.split(/\r?\n/) : [src]
    return lines
      .map((line) => (line.trim() === '' ? '' : formatDate(parseTimestamp(line, tz), fmt, tz, locale)))
      .join('\n')
  }
}

export default util
