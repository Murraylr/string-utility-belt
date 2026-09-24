import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import util from './index'

const FIXED = '2024-01-02T03:04:05.678Z'

const defaults = () =>
  Object.fromEntries(
    Object.entries(util.params).map(([k, v]) => [k, (v as { default?: unknown }).default])
  )

describe('timestamp_now', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('has correct metadata', () => {
    expect(util.id).toBe('timestamp_now')
    expect(util.name).toBe('current timestamp')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect((util.params.format as { options: string[] }).options)
      .toEqual(['iso', 'unix', 'unix-ms', 'rfc2822', 'http', 'sql', 'local', 'all'])
  })

  it('declares the specified default for every param', () => {
    expect(defaults()).toEqual({ format: 'iso', timezone: 'UTC', offsetSeconds: 0 })
  })

  it('defaults to an ISO 8601 instant in UTC', async () => {
    expect(await util.apply('', {})).toBe(FIXED)
    expect(await util.apply('', { format: 'iso', timezone: 'UTC' })).toBe(FIXED)
  })

  it('renders every scalar format option', async () => {
    expect(await util.apply('', { format: 'unix' })).toBe('1704164645')
    expect(await util.apply('', { format: 'unix-ms' })).toBe('1704164645678')
    expect(await util.apply('', { format: 'rfc2822' })).toBe('Tue, 02 Jan 2024 03:04:05 +0000')
    expect(await util.apply('', { format: 'http' })).toBe('Tue, 02 Jan 2024 03:04:05 GMT')
    expect(await util.apply('', { format: 'sql' })).toBe('2024-01-02 03:04:05')
    expect(String(await util.apply('', { format: 'local' }))).toContain('January 2, 2024')
  })

  it('returns a json object for the all format', async () => {
    const all = await util.apply('', { format: 'all', timezone: 'Europe/Paris' }) as Record<string, unknown>
    expect(typeof all).toBe('object')
    expect(all).toMatchObject({
      iso: '2024-01-02T04:04:05.678+01:00',
      unix: 1704164645,
      unixMs: 1704164645678,
      rfc2822: 'Tue, 02 Jan 2024 04:04:05 +0100',
      http: 'Tue, 02 Jan 2024 03:04:05 GMT',
      sql: '2024-01-02 04:04:05',
      timezone: 'Europe/Paris',
      utcOffset: '+01:00',
      offsetSeconds: 0
    })
    expect(typeof all.local).toBe('string')
  })

  it('applies the timezone param, including a half-hour zone', async () => {
    expect(await util.apply('', { format: 'iso', timezone: 'America/New_York' }))
      .toBe('2024-01-01T22:04:05.678-05:00')
    expect(await util.apply('', { format: 'iso', timezone: 'Asia/Kolkata' }))
      .toBe('2024-01-02T08:34:05.678+05:30')
    expect(await util.apply('', { format: 'sql', timezone: 'Asia/Kolkata' }))
      .toBe('2024-01-02 08:34:05')
    expect(await util.apply('', { format: 'rfc2822', timezone: 'America/New_York' }))
      .toBe('Mon, 01 Jan 2024 22:04:05 -0500')
    // an empty timezone falls back to UTC rather than throwing
    expect(await util.apply('', { format: 'iso', timezone: '  ' })).toBe(FIXED)
  })

  it('follows daylight saving time', async () => {
    vi.setSystemTime(new Date('2024-07-02T03:04:05.678Z'))
    expect(await util.apply('', { format: 'iso', timezone: 'America/New_York' }))
      .toBe('2024-07-01T23:04:05.678-04:00')
    expect(await util.apply('', { format: 'http' })).toBe('Tue, 02 Jul 2024 03:04:05 GMT')
  })

  it('shifts the instant by offsetSeconds in both directions', async () => {
    expect(await util.apply('', { format: 'unix', offsetSeconds: 3600 })).toBe('1704168245')
    expect(await util.apply('', { format: 'unix', offsetSeconds: -3600 })).toBe('1704161045')
    expect(await util.apply('', { format: 'iso', offsetSeconds: -90061 })).toBe('2024-01-01T02:03:04.678Z')
    expect(await util.apply('', { format: 'unix-ms', offsetSeconds: 0 })).toBe('1704164645678')
    // fractional seconds are truncated, not rounded
    expect(await util.apply('', { format: 'unix', offsetSeconds: 1.9 })).toBe('1704164646')
    expect(await util.apply('', { format: 'unix', offsetSeconds: '60' })).toBe('1704164705')
    // the shift crosses into the correct calendar date in a non-UTC zone too
    expect(await util.apply('', { format: 'sql', timezone: 'Asia/Tokyo', offsetSeconds: 3600 * 21 }))
      .toBe('2024-01-03 09:04:05')
  })

  it('ignores the input, including empty and non-ASCII input', async () => {
    const baseline = await util.apply('', { format: 'iso' })
    expect(await util.apply('🎈 héllo wörld', { format: 'iso' })).toBe(baseline)
    expect(await util.apply('', { format: 'iso' })).toBe(baseline)
    expect(await util.apply('anything at all', {})).toBe(FIXED)
  })

  it('throws clear errors for an unknown format, timezone or offset', async () => {
    const run = async (params: Record<string, unknown>) => util.apply('', params)
    await expect(run({ format: 'klingon' })).rejects.toThrow(/unknown format: klingon/)
    await expect(run({ timezone: 'Mars/Olympus_Mons' })).rejects.toThrow(/unknown timezone/)
    await expect(run({ format: 'all', timezone: 'Nowhere/Land' })).rejects.toThrow(/unknown timezone/)
    await expect(run({ offsetSeconds: 'soon' })).rejects.toThrow(/offset \(seconds\) must be a number/)
    await expect(run({ offsetSeconds: 1e15 })).rejects.toThrow(/representable date range/)
  })
})
