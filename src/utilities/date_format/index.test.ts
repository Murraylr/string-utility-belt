import { describe, it, expect } from 'vitest'
import util from './index'

const T = '2024-01-15T10:30:00Z'
const fmt = async (format: string, input = T, extra: Record<string, unknown> = {}) =>
  String(await util.apply(input, { format, ...extra }))

describe('date_format', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('date_format')
    expect(util.name).toBe('date format')
    expect(util.category).toBe('Date & Time')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['format', 'locale', 'perLine', 'timezone'])
  })

  it('uses the default format and accepts every input flavour', async () => {
    expect(await util.apply(T, {})).toBe('2024-01-15 10:30:00')
    expect(await util.apply('1705314600', {})).toBe('2024-01-15 10:30:00')
    expect(await util.apply('1705314600000', {})).toBe('2024-01-15 10:30:00')
    expect(await util.apply('Mon, 15 Jan 2024 10:30:00 GMT', {})).toBe('2024-01-15 10:30:00')
    expect(await util.apply('2024-01-15 10:30:00', {})).toBe('2024-01-15 10:30:00')
    // Excel serial days
    expect(await util.apply('45000', {})).toBe('2023-03-15 00:00:00')
  })

  it('renders token patterns', async () => {
    expect(await fmt('YYYY-MM-DDTHH:mm:ss.SSSZ')).toBe('2024-01-15T10:30:00.000+00:00')
    expect(await fmt('dddd, MMMM Do YYYY')).toBe('Monday, January 15th 2024')
    expect(await fmt('ddd dd MMM YY')).toBe('Mon Mo Jan 24')
    expect(await fmt('h:mm a | hh:mm A | kk')).toBe('10:30 am | 10:30 AM | 10')
    // bare letters are tokens, so literal words must be bracketed
    expect(await fmt('Q [quarter], [week] WW, [day] DDDD (E)')).toBe('1 quarter, week 03, day 015 (1)')
    expect(await fmt('X | x | ZZ | z')).toBe('1705314600 | 1705314600000 | +0000 | UTC')
    expect(await fmt('GGGG-[W]WW-E')).toBe('2024-W03-1')
    expect(await fmt('M/D/YY H:m:s S')).toBe('1/15/24 10:30:0 0')
  })

  it('renders strftime patterns', async () => {
    expect(await fmt('%Y-%m-%d %H:%M:%S')).toBe('2024-01-15 10:30:00')
    expect(await fmt('%A %B %e, %Y')).toBe('Monday January 15, 2024')
    expect(await fmt('%a %b %j %u %V')).toBe('Mon Jan 015 1 03')
    expect(await fmt('%I:%M %p / %l:%M %P')).toBe('10:30 AM / 10:30 am')
    expect(await fmt('%F %T %:z %z %Z')).toBe('2024-01-15 10:30:00 +00:00 +0000 UTC')
    // a % directive switches the whole pattern to strftime, so "is" stays literal
    expect(await fmt('%-m/%-d/%y is 100%%')).toBe('1/15/24 is 100%')
    expect(await fmt('%s %L %N')).toBe('1705314600 000 000000000')
    expect(await fmt('%D %R %C')).toBe('01/15/24 10:30 20')
  })

  it('escapes literals with [brackets] and backslashes', async () => {
    expect(await fmt('[Today is] dddd')).toBe('Today is Monday')
    // a backslash escapes the next character, so \a\t is the literal word "at"
    expect(await fmt('YYYY \\a\\t HH:mm')).toBe('2024 at 10:30')
    expect(await fmt('[unterminated YYYY')).toBe('unterminated YYYY')
  })

  it('converts timezones and localises names, including non-ASCII output', async () => {
    expect(await fmt('YYYY-MM-DD HH:mm z', T, { timezone: 'America/New_York' })).toBe('2024-01-15 05:30 EST')
    expect(await fmt('YYYY-MM-DD HH:mm Z', T, { timezone: 'Asia/Tokyo' })).toBe('2024-01-15 19:30 +09:00')
    expect(await fmt('dddd D MMMM YYYY', T, { locale: 'fr-FR' })).toBe('lundi 15 janvier 2024')
    expect(await fmt('YYYY年MM月DD日 dddd 📅', T, { locale: 'ja-JP' })).toBe('2024年01月15日 月曜日 📅')
    // a naive timestamp is read as wall-clock time in the chosen zone
    expect(await fmt('X', '2024-01-15 10:30:00', { timezone: 'Asia/Tokyo' })).toBe('1705282200')
  })

  it('resolves DST gaps forward and ambiguous wall times to the first occurrence', async () => {
    // 02:30 never happened in New York on 2024-03-10 — clocks jumped 02:00 → 03:00
    expect(await fmt('YYYY-MM-DD HH:mm ZZ', '2024-03-10 02:30:00', { timezone: 'America/New_York' })).toBe(
      '2024-03-10 03:30 -0400'
    )
    // …and the same must hold in Paris, where the initial guess lands on the
    // other side of the transition
    expect(await fmt('YYYY-MM-DD HH:mm ZZ', '2024-03-31 02:30:00', { timezone: 'Europe/Paris' })).toBe(
      '2024-03-31 03:30 +0200'
    )
    // 01:30 happened twice on 2024-11-03; the earlier, still-EDT one wins
    expect(await fmt('X', '2024-11-03 01:30:00', { timezone: 'America/New_York' })).toBe('1730611800')
  })

  it('reads zone-less date strings in the requested timezone, not the host one', async () => {
    expect(await fmt('YYYY-MM-DD HH:mm ZZ', 'January 15, 2024', { timezone: 'America/New_York' })).toBe(
      '2024-01-15 00:00 -0500'
    )
    expect(await fmt('X', 'January 15, 2024', { timezone: 'Asia/Tokyo' })).toBe('1705244400')
    // an explicit zone inside the string is honoured as-is
    expect(await fmt('X', 'January 15, 2024 10:00 GMT', { timezone: 'Asia/Tokyo' })).toBe('1705312800')
  })

  it('accepts the widest representable date and rejects anything past it', async () => {
    expect(await fmt('YYYY-MM-DD', '+275760-09-13T00:00:00Z')).toBe('275760-09-13')
    expect(() => util.apply('+999999-01-01', {})).toThrow(/outside the representable date range/)
  })

  it('handles perLine on and off', async () => {
    expect(await util.apply('1705314600\n\n1700000000', { format: 'YYYY-MM-DD' })).toBe('2024-01-15\n\n2023-11-14')
    expect(await util.apply('  2024-01-15T10:30:00Z \n', { format: 'HH:mm', perLine: false })).toBe('10:30')
    expect(() => util.apply('1705314600\n1700000000', { format: 'YYYY', perLine: false })).toThrow(
      /Unrecognized date/
    )
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n\t ', { format: 'YYYY' })).toBe('')
  })

  it('throws clear errors for bad input, timezone or locale', async () => {
    expect(() => util.apply('not a date 🗓', {})).toThrow(/Unrecognized date/)
    expect(() => util.apply('2024-02-30T00:00:00Z', {})).toThrow(/No such calendar date/)
    expect(() => util.apply(T, { timezone: 'Nowhere/Land' })).toThrow(/Unknown timezone/)
    expect(() => util.apply(T, { locale: 'en_US' })).toThrow(/Invalid locale/)
  })
})
