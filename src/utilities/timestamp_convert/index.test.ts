import { describe, it, expect } from 'vitest'
import util from './index'

const all = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as any

describe('timestamp_convert', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('timestamp_convert')
    expect(util.name).toBe('timestamp convert')
    expect(util.category).toBe('Date & Time')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params).sort()).toEqual(['perLine', 'timezone', 'to'])
  })

  it('converts unix seconds and reports the detected format', async () => {
    const r = await all('1700000000')
    expect(r.detected).toBe('unix-seconds')
    expect(r.isoUtc).toBe('2023-11-14T22:13:20.000Z')
    expect(r.unix).toBe(1700000000)
    expect(r.unixMs).toBe(1700000000000)
    expect(r.dayOfWeek).toBe('Tuesday')
  })

  it('auto-detects milliseconds, microseconds, .NET ticks and Excel serials', async () => {
    expect((await all('1705314600000')).detected).toBe('unix-milliseconds')
    expect((await all('1705314600000')).isoUtc).toBe('2024-01-15T10:30:00.000Z')

    expect((await all('1705314600000000')).detected).toBe('unix-microseconds')
    expect((await all('1705314600000000')).isoUtc).toBe('2024-01-15T10:30:00.000Z')

    expect((await all('638409114000000000')).detected).toBe('dotnet-ticks')
    expect((await all('638409114000000000')).isoUtc).toBe('2024-01-15T10:30:00.000Z')

    expect((await all('45000')).detected).toBe('excel-serial')
    expect((await all('45000')).isoUtc).toBe('2023-03-15T00:00:00.000Z')
    // Excel's phantom 1900 leap day is compensated for below serial 60
    expect((await all('1')).isoUtc).toBe('1900-01-01T00:00:00.000Z')
  })

  it('parses ISO 8601, SQL, RFC 2822 and HTTP-date strings', async () => {
    expect((await all('2024-01-15T10:30:00Z')).detected).toBe('iso8601')
    expect((await all('2024-01-15T10:30:00Z')).unix).toBe(1705314600)
    expect((await all('2024-01-15T05:30:00-05:00')).unix).toBe(1705314600)
    expect((await all('2024-01-15')).isoUtc).toBe('2024-01-15T00:00:00.000Z')

    const sql = await all('2024-01-15 10:30:00')
    expect(sql.detected).toBe('sql')
    expect(sql.unix).toBe(1705314600)

    const rfc = await all('Mon, 15 Jan 2024 10:30:00 +0000')
    expect(rfc.detected).toBe('rfc2822')
    expect(rfc.unix).toBe(1705314600)

    const http = await all('Mon, 15 Jan 2024 10:30:00 GMT')
    expect(http.detected).toBe('http-date')
    expect(http.unix).toBe(1705314600)

    // asctime form used by some HTTP servers
    expect((await all('Sun Nov  6 08:49:37 1994')).isoUtc).toBe('1994-11-06T08:49:37.000Z')
  })

  it('renders every "to" option', async () => {
    const t = '1705314600'
    expect(await util.apply(t, { to: 'iso' })).toBe('2024-01-15T10:30:00.000Z')
    expect(await util.apply(t, { to: 'unix' })).toBe('1705314600')
    expect(await util.apply(t, { to: 'unix-ms' })).toBe('1705314600000')
    expect(await util.apply(t, { to: 'rfc2822' })).toBe('Mon, 15 Jan 2024 10:30:00 +0000')
    expect(await util.apply(t, { to: 'http' })).toBe('Mon, 15 Jan 2024 10:30:00 GMT')
    expect(await util.apply(t, { to: 'sql' })).toBe('2024-01-15 10:30:00')
    expect(await util.apply(t, { to: 'local' })).toContain('January 15, 2024')
    expect(String(await util.apply('0', { to: 'relative' }))).toMatch(/ago$/)
    expect(typeof (await util.apply(t, { to: 'all' }))).toBe('object')
  })

  it('honours the timezone param for both input and output', async () => {
    // naive input is read as wall-clock time in the given zone
    const r = await all('2024-01-15 10:30:00', { timezone: 'America/New_York' })
    expect(r.isoUtc).toBe('2024-01-15T15:30:00.000Z')
    expect(r.utcOffset).toBe('-05:00')
    expect(await util.apply('1705314600', { to: 'iso', timezone: 'America/New_York' }))
      .toBe('2024-01-15T05:30:00.000-05:00')
    expect(await util.apply('1705314600', { to: 'sql', timezone: 'Asia/Tokyo' })).toBe('2024-01-15 19:30:00')
    // HTTP-date is defined to always be GMT
    expect(await util.apply('1705314600', { to: 'http', timezone: 'Asia/Tokyo' }))
      .toBe('Mon, 15 Jan 2024 10:30:00 GMT')
  })

  it('resolves DST gaps forward and ambiguous wall times to the first occurrence', async () => {
    // 02:30 never happened in New York on 2024-03-10 — clocks jumped 02:00 → 03:00
    expect(await util.apply('2024-03-10 02:30:00', { to: 'iso', timezone: 'America/New_York' })).toBe(
      '2024-03-10T03:30:00.000-04:00'
    )
    // …and the same must hold in Paris, where the initial guess lands on the
    // other side of the transition
    expect(await util.apply('2024-03-31 02:30:00', { to: 'iso', timezone: 'Europe/Paris' })).toBe(
      '2024-03-31T03:30:00.000+02:00'
    )
    // 01:30 happened twice on 2024-11-03; the earlier, still-EDT one wins
    expect(await util.apply('2024-11-03 01:30:00', { to: 'unix', timezone: 'America/New_York' })).toBe('1730611800')
    expect(await util.apply('2024-11-03 01:30:00', { to: 'iso', timezone: 'America/New_York' })).toBe(
      '2024-11-03T01:30:00.000-04:00'
    )
    // half-hour DST shift
    expect(await util.apply('2024-04-07 01:30:00', { to: 'iso', timezone: 'Australia/Lord_Howe' })).toBe(
      '2024-04-07T01:30:00.000+11:00'
    )
  })

  it('reads zone-less date strings in the requested timezone, not the host one', async () => {
    expect((await all('January 15, 2024')).detected).toBe('date-string')
    expect(await util.apply('January 15, 2024', { to: 'iso' })).toBe('2024-01-15T00:00:00.000Z')
    expect(await util.apply('January 15, 2024', { to: 'iso', timezone: 'Asia/Tokyo' })).toBe(
      '2024-01-15T00:00:00.000+09:00'
    )
    // an explicit zone inside the string is honoured as-is
    expect(await util.apply('January 15, 2024 10:00 GMT', { to: 'unix', timezone: 'Asia/Tokyo' })).toBe('1705312800')
  })

  it('quantises sub-minute historical offsets so output re-parses exactly', async () => {
    // Paris ran on +00:09:21 local mean time until 1911; ISO offsets only have
    // minute resolution, so the wall clock must follow the rounded offset
    const paris = String(await util.apply('1890-06-15T12:00:00Z', { to: 'iso', timezone: 'Europe/Paris' }))
    expect(paris).toBe('1890-06-15T12:09:00.000+00:09')
    expect(Date.parse(paris)).toBe(Date.parse('1890-06-15T12:00:00Z'))
  })

  it('accepts the widest representable date and rejects anything past it', async () => {
    expect(await util.apply('+275760-09-13T00:00:00Z', { to: 'iso' })).toBe('+275760-09-13T00:00:00.000Z')
    expect(() => util.apply('+999999-01-01', { to: 'iso' })).toThrow(/outside the representable date range/)
  })

  it('handles perLine on and off', async () => {
    const two = '1705314600\n1700000000'
    expect(await util.apply(two, { to: 'unix-ms' })).toBe('1705314600000\n1700000000000')

    const rows = await all(two)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toHaveLength(2)
    expect(rows[1].unix).toBe(1700000000)

    // blank lines are preserved rather than erroring
    expect(await util.apply('1705314600\n\n1705314600', { to: 'unix' })).toBe('1705314600\n\n1705314600')

    // with perLine off the whole input is one timestamp
    expect(await util.apply('  2024-01-15T10:30:00Z  ', { to: 'unix', perLine: false })).toBe('1705314600')
    expect(() => util.apply(two, { to: 'unix', perLine: false })).toThrow(/Unrecognized timestamp/)
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  ', { to: 'iso' })).toBe('')
  })

  it('throws clear errors for unparseable, non-ASCII or impossible input', async () => {
    // fullwidth digits are not silently coerced to a date
    expect(() => util.apply('２０２４年', {})).toThrow(/Unrecognized timestamp/)
    expect(() => util.apply('not a date 🕒', {})).toThrow(/Unrecognized timestamp/)
    expect(() => util.apply('2024-02-31T00:00:00Z', {})).toThrow(/No such calendar date/)
    expect(() => util.apply('2024-13-01T00:00:00Z', {})).toThrow(/Invalid month/)
    expect(() => util.apply('1705314600', { timezone: 'Mars/Olympus' })).toThrow(/Unknown timezone/)
    expect(() => util.apply('Mon, 15 Foo 2024 10:30:00 GMT', {})).toThrow(/Unknown month name/)
  })
})
