const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000000], ['month', 2592000000], ['week', 604800000],
  ['day', 86400000], ['hour', 3600000], ['minute', 60000], ['second', 1000],
]

let rtf: Intl.RelativeTimeFormat | null = null

/** "3 hours ago" / "in 2 days" style label, used by the library dialog's entry list. */
export function relativeTime(ms: number, now: number = Date.now()): string {
  if (!rtf) rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const diff = ms - now
  const abs = Math.abs(diff)
  for (const [unit, size] of UNITS) {
    if (abs >= size) return rtf.format(Math.round(diff / size), unit)
  }
  return rtf.format(0, 'second')
}
