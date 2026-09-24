import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as string

describe('bit_ops', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('bit_ops')
    expect(util.name).toBe('bit operations')
    expect(util.category).toBe('Numbers')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual([
      'operation',
      'operand',
      'width',
      'inputRadix',
      'outputRadix',
      'perLine'
    ])
  })

  it('performs and / or / xor against an operand', async () => {
    const base = { operand: '10', width: '8' }
    expect(await run('12', { ...base, operation: 'and' })).toBe('00001000')
    expect(await run('12', { ...base, operation: 'or' })).toBe('00001110')
    expect(await run('12', { ...base, operation: 'xor' })).toBe('00000110')
    expect(
      await run('0xffffffff', { operation: 'and', operand: '0xff00ff00', outputRadix: 16 })
    ).toBe('ff00ff00')
  })

  it('performs not, popcount and bit reversal', async () => {
    expect(await run('0', { operation: 'not', width: '8' })).toBe('11111111')
    expect(await run('12', { operation: 'not', width: '8' })).toBe('11110011')
    expect(await run('0', { operation: 'not', width: '16', outputRadix: 16 })).toBe('ffff')
    expect(await run('0', { operation: 'not', width: '64', outputRadix: 10 })).toBe(
      '18446744073709551615'
    )
    expect(await run('255', { operation: 'popcount', width: '8' })).toBe('8')
    expect(await run('0xff00ff00', { operation: 'popcount' })).toBe('16')
    expect(await run('1', { operation: 'reverse-bits', width: '8' })).toBe('10000000')
    expect(await run('0b10110000', { operation: 'reverse-bits', width: '8' })).toBe('00001101')
  })

  it('shifts left, arithmetic right and unsigned right', async () => {
    const base = { operand: '4', width: '8', outputRadix: 16 }
    expect(await run('1', { ...base, operation: 'shift-left' })).toBe('10')
    expect(await run('0xff', { ...base, operation: 'shift-left' })).toBe('f0')
    expect(await run('0xf0', { ...base, operation: 'shift-right' })).toBe('ff')
    expect(await run('0x70', { ...base, operation: 'shift-right' })).toBe('07')
    expect(await run('0xf0', { ...base, operation: 'unsigned-shift-right' })).toBe('0f')
    expect(await run('0xf0', { operation: 'shift-left', operand: '99', width: '8', outputRadix: 16 })).toBe('00')
  })

  it('rotates left and right, wrapping around the width', async () => {
    const base = { operand: '1', width: '8', outputRadix: 16 }
    expect(await run('0x80', { ...base, operation: 'rotate-left' })).toBe('01')
    expect(await run('0x01', { ...base, operation: 'rotate-right' })).toBe('80')
    expect(await run('0x12', { ...base, operand: '0', operation: 'rotate-left' })).toBe('12')
    expect(await run('0x12', { ...base, operand: '8', operation: 'rotate-right' })).toBe('12')
    expect(await run('0x0f0f', { operation: 'rotate-left', operand: '4', width: '16', outputRadix: 16 })).toBe('f0f0')
  })

  it('auto-detects input radix and honours an explicit one', async () => {
    const base = { operation: 'or', operand: '0', width: '8', outputRadix: 10 }
    expect(await run('0xff', base)).toBe('255')
    expect(await run('0b1010', base)).toBe('10')
    expect(await run('0o17', base)).toBe('15')
    expect(await run('-1', base)).toBe('255')
    expect(await run('ff', { ...base, inputRadix: 16 })).toBe('255')
    expect(await run('1010', { ...base, inputRadix: 2 })).toBe('10')
    expect(await run('73', { ...base, inputRadix: 36 })).toBe('255')
    expect(await run('ff', { operation: 'and', operand: 'f0', inputRadix: 16, width: '8', outputRadix: 16 })).toBe('f0')
  })

  it('does not mistake a valid digit for a base prefix under an explicit radix', async () => {
    // 0x0b1a is ordinary hex; 'b' is a hex digit, so there is no 0b prefix to honour here.
    expect(
      await run('0b1a', { operation: 'or', operand: '0', inputRadix: 16, width: '16', outputRadix: 16 })
    ).toBe('0b1a')
    expect(
      await run('0b1a', { operation: 'or', operand: '0', inputRadix: 16, width: '16', outputRadix: 10 })
    ).toBe('2842')
    // 'o' is a base-36/base-32 digit too.
    expect(
      await run('0o17', { operation: 'or', operand: '0', inputRadix: 32, width: '32', outputRadix: 10 })
    ).toBe('24615')
    // But an impossible letter is still reported as a prefix/radix clash.
    await expect(run('0b1a', { inputRadix: 8 })).rejects.toThrow(/0b prefix but input radix is 8/)
  })

  it('formats output in the requested radix with power-of-two padding', async () => {
    const base = { operation: 'or', operand: '0', width: '8' }
    expect(await run('255', base)).toBe('11111111')
    expect(await run('255', { ...base, outputRadix: 8 })).toBe('377')
    expect(await run('255', { ...base, outputRadix: 16 })).toBe('ff')
    expect(await run('255', { ...base, outputRadix: 10 })).toBe('255')
    expect(await run('255', { ...base, outputRadix: 36 })).toBe('73')
  })

  it('processes lines and whitespace-separated values, or the whole input at once', async () => {
    expect(await run('12\n10', { operation: 'or', operand: '0', width: '8' })).toBe(
      '00001100\n00001010'
    )
    expect(await run('12\n\n10', { operation: 'popcount' })).toBe('2\n\n2')
    expect(await run('0xf0 0x0f', { operation: 'popcount' })).toBe('4 4')
    expect(
      await run('1010 1010', {
        operation: 'or',
        operand: '0',
        inputRadix: 2,
        width: '16',
        outputRadix: 16,
        perLine: false
      })
    ).toBe('00aa')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n  ', { operation: 'not' })).toBe('')
  })

  it('reports unusable characters without splitting astral code points', async () => {
    await expect(run('🙂')).rejects.toThrow('invalid digit "🙂" for radix 10 in value "🙂"')
    await expect(run('１２３')).rejects.toThrow(/invalid digit "１"/)
    await expect(run('12é')).rejects.toThrow(/invalid digit "é"/)
  })

  it('throws clear errors on bad configuration', async () => {
    await expect(run('zz')).rejects.toThrow(/invalid digit "z" for radix 10/)
    await expect(run('12', { inputRadix: 40 })).rejects.toThrow(/input radix must be 0/)
    await expect(run('12', { outputRadix: 1 })).rejects.toThrow(/output radix must be between 2 and 36/)
    await expect(run('12', { operation: 'shift-left', operand: '-2' })).rejects.toThrow(
      /shift amount must not be negative/
    )
    await expect(run('0xff', { inputRadix: 2 })).rejects.toThrow(/0x prefix but input radix is 2/)
  })
})
