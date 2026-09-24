import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * Unit tables                                                         *
 * ------------------------------------------------------------------ */

type UnitSpec = { key: string; ms: number; one: string; many: string; short: string }

// Only exact units — months and years are deliberately absent from the output
// because their length varies; parsing still accepts them (30 / 365 days).
const UNITS: UnitSpec[] = [
  { key: 'day', ms: 86400000, one: 'day', many: 'days', short: 'd' },
  { key: 'hour', ms: 3600000, one: 'hour', many: 'hours', short: 'h' },
  { key: 'minute', ms: 60000, one: 'minute', many: 'minutes', short: 'm' },
  { key: 'second', ms: 1000, one: 'second', many: 'seconds', short: 's' },
  { key: 'millisecond', ms: 1, one: 'millisecond', many: 'milliseconds', short: 'ms' }
]

const UNIT_MS: Record<string, number> = {
  ns: 1e-6, nanosecond: 1e-6, nanoseconds: 1e-6,
  us: 0.001, 'µs': 0.001, 'μs': 0.001, microsecond: 0.001, microseconds: 0.001,
  ms: 1, msec: 1, msecs: 1, milli: 1, millis: 1, millisecond: 1, milliseconds: 1,
  s: 1000, sec: 1000, secs: 1000, second: 1000, seconds: 1000,
  m: 60000, min: 60000, mins: 60000, minute: 60000, minutes: 60000,
  h: 3600000, hr: 3600000, hrs: 3600000, hour: 3600000, hours: 3600000,
  d: 86400000, day: 86400000, days: 86400000,
  w: 604800000, wk: 604800000, wks: 604800000, week: 604800000, weeks: 604800000,
  mo: 2592000000, mon: 2592000000, mos: 2592000000, month: 2592000000, months: 2592000000,
  y: 31536000000, yr: 31536000000, yrs: 31536000000, year: 31536000000, years: 31536000000
}

const NUMBER_RE = /^\d+(?:\.\d+)?$/
const COLON_RE = /^\d+(?::\d{1,2}){1,3}(?:\.\d+)?$/
const ISO_RE =
  /^P(?!$)(?:(\d+(?:\.\d+)?)Y)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)W)?(?:(\d+(?:\.\d+)?)D)?(?:T(?!$)(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
const PAIR_RE = /(\d+(?:\.\d+)?)\s*([a-zµμ]+)/gi

/* ------------------------------------------------------------------ *
 * Helpers                                                             *
 * ------------------------------------------------------------------ */

const p2 = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0')

const formatNumber = (n: number): string => {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 1e6) / 1e6)
}

// sliced by code point so an astral character never becomes a lone surrogate
const clip = (s: string) => {
  const cps = Array.from(s)
  return cps.length > 40 ? cps.slice(0, 40).join('') + '…' : s
}

const unitScale = (unit: string) => (unit === 'milliseconds' ? 1 : 1000)

/* ------------------------------------------------------------------ *
 * Parsing                                                             *
 * ------------------------------------------------------------------ */

const parseColon = (s: string, raw: string): number => {
  const parts = s.split(':')
  if (parts.length > 4) throw new Error(`Too many colon-separated fields in "${clip(raw)}"`)
  const nums = parts.map((p) => {
    if (!/^\d+(?:\.\d+)?$/.test(p)) throw new Error(`Invalid clock duration: "${clip(raw)}"`)
    return Number(p)
  })
  // every field except the leading one is a 0-59 remainder
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] >= 60) throw new Error(`Field "${parts[i]}" must be below 60 in "${clip(raw)}"`)
  }
  const scale = [1000, 60000, 3600000, 86400000]
  let total = 0
  for (let i = 0; i < nums.length; i++) total += nums[nums.length - 1 - i] * scale[i]
  return total
}

const parseIsoDuration = (s: string, raw: string): number => {
  const m = ISO_RE.exec(s)
  if (!m) throw new Error(`Invalid ISO 8601 duration: "${clip(raw)}"`)
  const n = (v: string | undefined) => (v === undefined ? 0 : Number(v))
  return (
    n(m[1]) * 31536000000 + // years  ≈ 365 days
    n(m[2]) * 2592000000 + //  months ≈ 30 days
    n(m[3]) * 604800000 +
    n(m[4]) * 86400000 +
    n(m[5]) * 3600000 +
    n(m[6]) * 60000 +
    n(m[7]) * 1000
  )
}

const parseHuman = (s: string, raw: string): number => {
  let total = 0
  let matched = 0
  PAIR_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PAIR_RE.exec(s)) !== null) {
    const scale = UNIT_MS[m[2].toLowerCase()]
    if (scale === undefined) throw new Error(`Unknown duration unit: "${m[2]}" in "${clip(raw)}"`)
    total += Number(m[1]) * scale
    matched++
  }
  if (matched === 0) throw new Error(`Unrecognized duration: "${clip(raw)}"`)
  const leftover = s.replace(/(\d+(?:\.\d+)?)\s*([a-zµμ]+)/gi, ' ').replace(/\s|and|&|\+/gi, '')
  if (leftover) throw new Error(`Unrecognized text in duration: "${clip(leftover)}"`)
  return total
}

/** Parse any supported duration syntax into milliseconds. */
const parseDuration = (raw: string, unit: string): number => {
  let s = raw.trim().replace(/,/g, '')
  if (!s) throw new Error('Empty duration')

  let sign = 1
  if (s.startsWith('-') || s.startsWith('−')) {
    sign = -1
    s = s.slice(1).trim()
  } else if (s.startsWith('+')) {
    s = s.slice(1).trim()
  }
  if (!s) throw new Error(`Unrecognized duration: "${clip(raw)}"`)

  if (NUMBER_RE.test(s)) return sign * Number(s) * unitScale(unit)
  if (COLON_RE.test(s)) return sign * parseColon(s, raw)
  if (/^p/i.test(s)) return sign * parseIsoDuration(s, raw)
  return sign * parseHuman(s, raw)
}

/* ------------------------------------------------------------------ *
 * Rendering                                                           *
 * ------------------------------------------------------------------ */

type Component = { spec: UnitSpec; value: number }

const decompose = (absMs: number): Component[] => {
  let rest = Math.round(absMs * 1000) / 1000
  return UNITS.map((spec) => {
    const value = spec.ms === 1 ? rest : Math.floor(rest / spec.ms)
    rest -= value * spec.ms
    return { spec, value }
  })
}

/** The `maxUnits` most significant non-zero components, trailing zeros dropped. */
const significant = (components: Component[], maxUnits: number): Component[] => {
  const first = components.findIndex((c) => c.value > 0)
  if (first === -1) return []
  const window = components.slice(first, first + maxUnits)
  while (window.length > 1 && window[window.length - 1].value === 0) window.pop()
  return window.filter((c, i) => i === 0 || c.value > 0)
}

const renderLong = (chosen: Component[]): string =>
  chosen.map((c) => `${formatNumber(c.value)} ${c.value === 1 ? c.spec.one : c.spec.many}`).join(' ')

const renderShort = (chosen: Component[]): string =>
  chosen.map((c) => `${formatNumber(c.value)}${c.spec.short}`).join(' ')

const renderColon = (components: Component[]): string => {
  const [d, h, m, s, msPart] = components.map((c) => c.value)
  let out: string
  if (d > 0) out = `${d}:${p2(h)}:${p2(m)}:${p2(s)}`
  else if (h > 0) out = `${h}:${p2(m)}:${p2(s)}`
  else out = `${m}:${p2(s)}`
  if (msPart > 0) out += `.${String(Math.round(msPart)).padStart(3, '0')}`
  return out
}

const renderIso = (chosen: Component[]): string => {
  const value = (key: string) => {
    const hit = chosen.find((c) => c.spec.key === key)
    return hit ? hit.value : 0
  }
  const days = value('day')
  const hours = value('hour')
  const minutes = value('minute')
  const seconds = value('second') + value('millisecond') / 1000
  let out = 'P'
  if (days) out += `${formatNumber(days)}D`
  const time =
    (hours ? `${formatNumber(hours)}H` : '') +
    (minutes ? `${formatNumber(minutes)}M` : '') +
    (seconds ? `${formatNumber(seconds)}S` : '')
  if (time) out += `T${time}`
  return out === 'P' ? 'PT0S' : out
}

const humanize = (ms: number, style: string, maxUnits: number): string => {
  const negative = ms < 0
  const abs = Math.abs(ms)
  // clock notation has no room for a fraction of a millisecond, and rounding it
  // inside renderColon would overflow the field (999.6 ms → ".1000")
  const components = decompose(style === 'colon' ? Math.round(abs) : abs)
  const chosen = significant(components, maxUnits)
  let body: string
  if (style === 'colon') {
    body = renderColon(components)
  } else if (style === 'iso8601') {
    body = renderIso(chosen)
  } else if (chosen.length === 0) {
    body = style === 'short' ? '0s' : '0 seconds'
  } else {
    body = style === 'short' ? renderShort(chosen) : renderLong(chosen)
  }
  return negative ? `-${body}` : body
}

/* ------------------------------------------------------------------ *
 * Utility                                                             *
 * ------------------------------------------------------------------ */

const util: Utility = {
  id: 'duration_humanize',
  name: 'humanize duration',
  category: 'Date & Time',
  description:
    'Turn a number of seconds or milliseconds into a readable duration — long ("1 hour 30 minutes"), short ("1h 30m"), colon ("1:30:00") or ISO 8601 ("PT1H30M") — or parse any of those forms back into a number.',
  accepts: 'string',
  produces: 'string',
  params: {
    direction: { kind: 'select', label: 'direction', options: ['to-human', 'to-seconds'], default: 'to-human' },
    unit: { kind: 'select', label: 'number unit', options: ['seconds', 'milliseconds'], default: 'seconds' },
    style: { kind: 'select', label: 'style', options: ['long', 'short', 'colon', 'iso8601'], default: 'long' },
    maxUnits: { kind: 'number', label: 'max units (0 = all)', default: 2, min: 0, integer: true },
    perLine: { kind: 'boolean', label: 'one duration per line', default: true }
  },
  tags: ['duration', 'humanize', 'seconds', 'time', 'elapsed', 'iso8601', 'countdown'],
  examples: [
    {
      title: 'seconds to human',
      input: '5400',
      output: '1 hour 30 minutes'
    },
    {
      title: 'colon form back to seconds',
      input: '1:30:00',
      params: { direction: 'to-seconds' },
      output: '5400'
    }
  ],
  apply: (input: any, params: any) => {
    const src = String(input ?? '')
    const direction = String(params?.direction ?? 'to-human') || 'to-human'
    const unit = String(params?.unit ?? 'seconds') || 'seconds'
    const style = String(params?.style ?? 'long') || 'long'
    const perLine = params?.perLine === undefined ? true : !!params.perLine

    const rawMax = Number(params?.maxUnits ?? 2)
    const maxUnits = Number.isFinite(rawMax) && rawMax > 0 ? Math.floor(rawMax) : UNITS.length

    if (!src.trim()) return ''

    const lines = perLine ? src.split(/\r?\n/) : [src]
    return lines
      .map((line) => {
        if (line.trim() === '') return ''
        const ms = parseDuration(line, unit)
        if (direction === 'to-seconds') return formatNumber(ms / unitScale(unit))
        return humanize(ms, style, maxUnits)
      })
      .join('\n')
  }
}

export default util
