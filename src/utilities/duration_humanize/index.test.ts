import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: string, params: Record<string, unknown> = {}) => String(await util.apply(input, params))

describe('duration_humanize', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('duration_humanize')
    expect(util.name).toBe('humanize duration')
    expect(util.category).toBe('Date & Time')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['direction', 'maxUnits', 'perLine', 'style', 'unit'])
  })

  it('humanizes seconds in every style', async () => {
    expect(await run('5400')).toBe('1 hour 30 minutes')
    expect(await run('5400', { style: 'short' })).toBe('1h 30m')
    expect(await run('5400', { style: 'colon' })).toBe('1:30:00')
    expect(await run('5400', { style: 'iso8601' })).toBe('PT1H30M')
    expect(await run('90061', { style: 'colon' })).toBe('1:01:01:01')
    expect(await run('45', { style: 'colon' })).toBe('0:45')
  })

  it('respects maxUnits and drops empty trailing units', async () => {
    expect(await run('90061')).toBe('1 day 1 hour')
    expect(await run('90061', { maxUnits: 4 })).toBe('1 day 1 hour 1 minute 1 second')
    expect(await run('90061', { maxUnits: 4, style: 'iso8601' })).toBe('P1DT1H1M1S')
    expect(await run('90061', { maxUnits: 0 })).toBe('1 day 1 hour 1 minute 1 second')
    expect(await run('1500', { maxUnits: 3 })).toBe('25 minutes')
    expect(await run('1', { maxUnits: 3 })).toBe('1 second')
  })

  it('handles the milliseconds unit, fractions, zero and negatives', async () => {
    expect(await run('90000', { unit: 'milliseconds' })).toBe('1 minute 30 seconds')
    expect(await run('1.5')).toBe('1 second 500 milliseconds')
    expect(await run('1500', { unit: 'milliseconds', style: 'iso8601' })).toBe('PT1.5S')
    expect(await run('0')).toBe('0 seconds')
    expect(await run('0', { style: 'short' })).toBe('0s')
    expect(await run('0', { style: 'colon' })).toBe('0:00')
    expect(await run('0', { style: 'iso8601' })).toBe('PT0S')
    expect(await run('-5400')).toBe('-1 hour 30 minutes')
  })

  it('carries fractional milliseconds instead of overflowing the clock field', async () => {
    expect(await run('1.9996', { style: 'colon' })).toBe('0:02')
    expect(await run('59.9999', { style: 'colon' })).toBe('1:00')
    expect(await run('1.0005', { style: 'colon' })).toBe('0:01.001')
    // the other styles keep the fraction
    expect(await run('1.9996', { style: 'long', maxUnits: 0 })).toBe('1 second 999.6 milliseconds')
    expect(await run('1.9996', { style: 'iso8601' })).toBe('PT1.9996S')
  })

  it('parses human, colon and ISO 8601 durations back to numbers', async () => {
    const toSeconds = { direction: 'to-seconds' }
    expect(await run('1h 30m', toSeconds)).toBe('5400')
    expect(await run('1 hour and 30 minutes', toSeconds)).toBe('5400')
    expect(await run('90:00', toSeconds)).toBe('5400')
    expect(await run('PT1H30M', toSeconds)).toBe('5400')
    expect(await run('1d', toSeconds)).toBe('86400')
    expect(await run('500ms', toSeconds)).toBe('0.5')
    expect(await run('1h 30m', { direction: 'to-seconds', unit: 'milliseconds' })).toBe('5400000')
    // micro sign (U+00B5) and Greek mu are both accepted
    expect(await run('1000µs', { direction: 'to-seconds', unit: 'milliseconds' })).toBe('1')
    expect(await run('1000μs', { direction: 'to-seconds', unit: 'milliseconds' })).toBe('1')
  })

  it('round-trips between the two directions', async () => {
    const short = await run('93784', { style: 'short', maxUnits: 4 })
    expect(short).toBe('1d 2h 3m 4s')
    expect(await run(short, { direction: 'to-seconds' })).toBe('93784')

    const iso = await run('93784', { style: 'iso8601', maxUnits: 4 })
    expect(iso).toBe('P1DT2H3M4S')
    expect(await run(iso, { direction: 'to-seconds' })).toBe('93784')

    const colon = await run('93784', { style: 'colon' })
    expect(colon).toBe('1:02:03:04')
    expect(await run(colon, { direction: 'to-seconds' })).toBe('93784')
  })

  it('handles perLine on and off', async () => {
    expect(await run('60\n\n3600', { style: 'short' })).toBe('1m\n\n1h')
    expect(await run('  1h 30m \n', { direction: 'to-seconds', perLine: false })).toBe('5400')
    expect(() => util.apply('60\n3600', { perLine: false })).toThrow(/Unrecognized/)
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', { direction: 'to-seconds' })).toBe('')
  })

  it('throws clear errors for unparseable durations', async () => {
    expect(() => util.apply('banana', {})).toThrow(/Unrecognized duration/)
    expect(() => util.apply('1 fortnight', {})).toThrow(/Unknown duration unit/)
    expect(() => util.apply('1 час', {})).toThrow(/Unrecognized duration/)
    expect(() => util.apply('30m ⏱', {})).toThrow(/Unrecognized text/)
    expect(() => util.apply('1:75', {})).toThrow(/below 60/)
    expect(() => util.apply('P', {})).toThrow(/Invalid ISO 8601 duration/)
  })
})
