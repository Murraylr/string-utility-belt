import { describe, it, expect } from 'vitest'
import util from './index'

describe('bytes_humanize', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('bytes_humanize')
    expect(util.name).toBe('humanize bytes')
    expect(util.category).toBe('Numbers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect((util.params.direction as { options: string[] }).options).toEqual(['to-human', 'to-bytes'])
  })

  it('humanizes byte counts with binary units by default', async () => {
    expect(await util.apply('1536', {})).toBe('1.50 KiB')
    expect(await util.apply('1610612736', {})).toBe('1.50 GiB')
    expect(await util.apply('512', {})).toBe('512 B')
    expect(await util.apply('0', {})).toBe('0 B')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
  })

  it('supports decimal (SI) units', async () => {
    expect(await util.apply('1500000', { unit: 'decimal' })).toBe('1.50 MB')
    expect(await util.apply('1024', { unit: 'decimal' })).toBe('1.02 kB')
    expect(await util.apply('1024', { unit: 'binary' })).toBe('1.00 KiB')
    // IEC suffixes are always 1024-based even when the decimal unit system is selected
    expect(await util.apply('1.5 GiB', { unit: 'decimal' })).toBe('1.61 GB')
  })

  it('honours the decimals option and rounds up into the next unit', async () => {
    expect(await util.apply('1536', { decimals: 3 })).toBe('1.500 KiB')
    expect(await util.apply('1048576', { decimals: 0 })).toBe('1 MiB')
    expect(await util.apply('1048575', { decimals: 2 })).toBe('1.00 MiB')
    expect(await util.apply('999600', { unit: 'decimal', decimals: 2 })).toBe('999.60 kB')
  })

  it('parses human sizes back to bytes', async () => {
    expect(await util.apply('1.5 GiB', { direction: 'to-bytes' })).toBe('1610612736')
    expect(await util.apply('10MB', { direction: 'to-bytes', unit: 'decimal' })).toBe('10000000')
    expect(await util.apply('10MB', { direction: 'to-bytes', unit: 'binary' })).toBe('10485760')
    expect(await util.apply('1024', { direction: 'to-bytes' })).toBe('1024')
    expect(await util.apply('2 gigabytes', { direction: 'to-bytes', unit: 'decimal' })).toBe('2000000000')
    expect(await util.apply('2 gibibytes', { direction: 'to-bytes', unit: 'decimal' })).toBe('2147483648')
    expect(await util.apply('900 bytes', { direction: 'to-bytes' })).toBe('900')
  })

  it('stays exact for very large sizes', async () => {
    expect(await util.apply('1 YB', { direction: 'to-bytes', unit: 'decimal' }))
      .toBe('1000000000000000000000000')
    expect(await util.apply('1 YiB', { direction: 'to-bytes' }))
      .toBe('1208925819614629174706176')
    expect(await util.apply('1208925819614629174706176', { unit: 'binary' })).toBe('1.00 YiB')
  })

  it('round-trips to-human and back to-bytes', async () => {
    const human = await util.apply('1610612736', { direction: 'to-human', unit: 'binary' })
    expect(human).toBe('1.50 GiB')
    expect(await util.apply(human as string, { direction: 'to-bytes', unit: 'binary' })).toBe('1610612736')

    const si = await util.apply('1500000', { direction: 'to-human', unit: 'decimal' })
    expect(await util.apply(si as string, { direction: 'to-bytes', unit: 'decimal' })).toBe('1500000')
  })

  it('handles negative sizes, grouped digits and non-ASCII spacing', async () => {
    expect(await util.apply('-1536', {})).toBe('-1.50 KiB')
    expect(await util.apply('-1.5 KiB', { direction: 'to-bytes' })).toBe('-1536')
    expect(await util.apply('1,048,576', {})).toBe('1.00 MiB')
    // a non-breaking space between the number and its unit is accepted
    expect(await util.apply('1 GiB', { direction: 'to-bytes' })).toBe('1073741824')
    // European decimal comma
    expect(await util.apply('1,5 GiB', { direction: 'to-bytes' })).toBe('1610612736')
  })

  it('converts one size per line, or the whole input when perLine is false', async () => {
    expect(await util.apply('1536\n1048576', { perLine: true })).toBe('1.50 KiB\n1.00 MiB')
    expect(await util.apply('1536\n\n1048576', { perLine: true })).toBe('1.50 KiB\n\n1.00 MiB')
    expect(await util.apply(' 1.5 KiB ', { direction: 'to-bytes', perLine: false })).toBe('1536')
  })

  it('throws clear errors on unknown units and non-numeric input', () => {
    expect(() => util.apply('1 QB', { direction: 'to-bytes' })).toThrow(/unknown size unit "QB"/)
    expect(() => util.apply('abc', {})).toThrow(/is not a byte size/)
    expect(() => util.apply('1 Ω', {})).toThrow(/is not a byte size/)
    // full-width digits and emoji are not silently mangled
    expect(() => util.apply('１０MB', {})).toThrow(/is not a byte size/)
    expect(() => util.apply('1 📦', {})).toThrow(/is not a byte size/)
    expect(() => util.apply('1536\nnope', {})).toThrow(/"nope" is not a byte size/)
  })
})
