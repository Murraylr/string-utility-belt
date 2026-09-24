import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as any

describe('ieee754', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('ieee754')
    expect(util.name).toBe('ieee 754 float bits')
    expect(util.category).toBe('Numbers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params)).toEqual(['direction', 'precision', 'format'])
  })

  it('encodes doubles to hex bit patterns', async () => {
    expect(await run('1', { format: 'hex' })).toBe('0x3ff0000000000000')
    expect(await run('0.1', { format: 'hex' })).toBe('0x3fb999999999999a')
    expect(await run('-2.5', { format: 'hex' })).toBe('0xc004000000000000')
    expect(await run('3.141592653589793', { format: 'hex' })).toBe('0x400921fb54442d18')
    expect(await run(' 1.25e2 ', { format: 'hex' })).toBe('0x405f400000000000')
  })

  it('encodes to grouped binary', async () => {
    expect(await run('1', { format: 'binary' })).toBe(
      '0 01111111111 0000000000000000000000000000000000000000000000000000'
    )
    expect(await run('1', { format: 'binary', precision: 'single' })).toBe(
      '0 01111111 00000000000000000000000'
    )
  })

  it('breaks a double down into fields', async () => {
    const b = await run('1')
    expect(b.classification).toBe('normal')
    expect(b.sign).toEqual({ bit: 0, symbol: '+' })
    expect(b.exponent).toEqual({ bits: '01111111111', raw: 1023, bias: 1023, unbiased: 0 })
    expect(b.mantissa.raw).toBe('0')
    expect(b.mantissa.significand).toBe(1)
    expect(b.hex).toBe('0x3ff0000000000000')
    expect(b.bits).toHaveLength(64)
    expect(b.value).toBe(1)
    expect(b.exactValue).toBe('1')
    expect(b.ulp).toBe(2 ** -52)
    expect(b.isExact).toBe(true)
    expect(b.nearestDouble).toBe(1)
  })

  it('reports inexact decimals with their exact stored value', async () => {
    const b = await run('0.1')
    expect(b.isExact).toBe(false)
    expect(b.exponent.unbiased).toBe(-4)
    expect(b.mantissa.hex).toBe('999999999999a')
    expect(b.mantissa.significand).toBe(1.6)
    expect(b.exactValue).toBe('0.1000000000000000055511151231257827021181583404541015625')
    expect(b.ulp).toBe(2 ** -56)
    expect((await run('0.5')).isExact).toBe(true)
    expect((await run('-2.5')).isExact).toBe(true)
  })

  it('supports single precision', async () => {
    expect(await run('0.1', { precision: 'single', format: 'hex' })).toBe('0x3dcccccd')
    const b = await run('0.1', { precision: 'single' })
    expect(b.precision).toBe('single')
    expect(b.bits).toHaveLength(32)
    expect(b.exponent).toEqual({ bits: '01111011', raw: 123, bias: 127, unbiased: -4 })
    expect(b.mantissa.hex).toBe('4ccccd')
    expect(b.value).toBe(0.10000000149011612)
    expect(b.nearestDouble).toBe(0.1)
    expect(b.isExact).toBe(false)
    expect(b.exactValue).toBe('0.100000001490116119384765625')
    expect(await run('1', { precision: 'single', format: 'hex' })).toBe('0x3f800000')
  })

  it('handles zero, subnormals, infinities and NaN', async () => {
    expect(await run('-0', { format: 'hex' })).toBe('0x8000000000000000')
    expect((await run('0')).classification).toBe('zero')
    const sub = await run('5e-324')
    expect(sub.classification).toBe('subnormal')
    expect(sub.hex).toBe('0x0000000000000001')
    expect(sub.exponent.unbiased).toBe(-1022)
    const inf = await run('Infinity')
    expect(inf.classification).toBe('infinity')
    expect(inf.value).toBe('Infinity')
    expect(inf.hex).toBe('0x7ff0000000000000')
    expect(inf.isExact).toBe(false)
    const nan = await run('NaN')
    expect(nan.classification).toBe('nan')
    expect(nan.hex).toBe('0x7ff8000000000000')
    expect(await run('-inf', { format: 'hex' })).toBe('0xfff0000000000000')
  })

  it('accepts the unicode infinity sign', async () => {
    expect(await run('∞', { format: 'hex' })).toBe('0x7ff0000000000000')
    expect(await run('-∞', { format: 'hex' })).toBe('0xfff0000000000000')
    await expect(run('π')).rejects.toThrow(/not a number/)
    await expect(run('１２３')).rejects.toThrow(/not a number/)
  })

  it('decodes bit patterns back to numbers', async () => {
    const opts = { direction: 'to-number', format: 'hex' }
    expect(await run('0x400921fb54442d18', opts)).toBe('3.141592653589793')
    expect(await run('400921FB54442D18', opts)).toBe('3.141592653589793')
    expect(await run('0x8000000000000000', opts)).toBe('-0')
    expect(await run('0x7ff0000000000000', opts)).toBe('Infinity')
    expect(await run('0x7ff8000000000000', opts)).toBe('NaN')
    expect(await run('0x3f800000', { ...opts, precision: 'single' })).toBe('1')
    expect(
      await run('0 01111111111 0000000000000000000000000000000000000000000000000000', {
        direction: 'to-number',
        format: 'binary'
      })
    ).toBe('1')
    const b = await run('0x3ff8000000000000', { direction: 'to-number' })
    expect(b.value).toBe(1.5)
    expect(b.isExact).toBe(true)
  })

  it('reads bit patterns that merely look like a 0b literal as hex', async () => {
    // 0x0b1999999999999a is a perfectly ordinary double; it must not be mistaken for binary.
    const opts = { direction: 'to-number', format: 'hex' }
    expect(await run('0b1999999999999a', opts)).toBe('3.409915766259544e-255')
    expect(await run('0b1ccccd', { ...opts, precision: 'single' })).toBe('3.0198582115739034e-32')
    // A genuine 0b literal still wins when the digits really are binary, whatever the format.
    expect(await run('0b1010', opts)).toBe('5e-323')
    expect(await run('0b1010', { ...opts, format: 'binary' })).toBe('5e-323')
    await expect(run('0b12', opts)).rejects.toThrow(/invalid binary digits/)
  })

  it('uses the format as the radix hint for ambiguous patterns', async () => {
    expect(await run('1010', { direction: 'to-number', format: 'binary' })).toBe('5e-323')
    expect(await run('1010', { direction: 'to-number', format: 'hex' })).toBe('2.0316e-320')
    // The hint never forces an impossible reading: 64 binary digits stay binary under 'hex'.
    expect(
      await run('0 01111111111 0000000000000000000000000000000000000000000000000000', {
        direction: 'to-number',
        format: 'hex'
      })
    ).toBe('1')
  })

  it('round-trips numbers through bits in both formats and precisions', async () => {
    for (const value of ['3.141592653589793', '-2.5', '1e-300', '0.1', '12345678901234.5']) {
      const hex = await run(value, { format: 'hex' })
      expect(await run(hex, { direction: 'to-number', format: 'hex' })).toBe(value)
      const bin = await run(value, { format: 'binary' })
      expect(await run(bin, { direction: 'to-number', format: 'binary' })).toBe(value)
    }
    const single = await run('0.5', { precision: 'single', format: 'binary' })
    expect(await run(single, { direction: 'to-number', precision: 'single', format: 'binary' })).toBe('0.5')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n ', { direction: 'to-number' })).toBe('')
  })

  it('throws clear errors on malformed input', async () => {
    await expect(run('12abc')).rejects.toThrow(/not a number/)
    await expect(run('0x1g', { direction: 'to-number' })).rejects.toThrow(/invalid hex digits/)
    await expect(run('0x400921fb54442d1800', { direction: 'to-number' })).rejects.toThrow(/too many bits/)
    await expect(run('0x3ff0000000000000', { direction: 'to-number', precision: 'single' })).rejects.toThrow(
      /too many bits/
    )
    await expect(run('nope', { direction: 'to-number' })).rejects.toThrow(/not a 64-bit pattern/)
  })
})
