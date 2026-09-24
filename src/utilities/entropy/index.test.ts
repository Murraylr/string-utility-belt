import { describe, it, expect } from 'vitest'
import util, { shannonBits, charsetOf, humaniseLog10Seconds } from './index'

type Report = Record<string, any>

describe('entropy', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('entropy')
    expect(util.name).toBe('entropy')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['json', 'string'])
    expect(util.params.unit).toEqual({
      kind: 'select',
      label: 'unit',
      options: ['bits', 'nats'],
      default: 'bits'
    })
    expect(util.params.format).toEqual({
      kind: 'select',
      label: 'output format',
      options: ['json', 'text'],
      default: 'json'
    })
  })

  it('computes shannon entropy in bits by default', async () => {
    const r = (await util.apply('aabb', {})) as Report
    expect(r.unit).toBe('bits')
    expect(r.length).toBe(4)
    expect(r.uniqueCharacters).toBe(2)
    // two equally likely symbols => exactly 1 bit per character
    expect(r.entropyPerCharacter).toBe(1)
    expect(r.totalEntropy).toBe(4)
    expect(r.charsetSize).toBe(26)
    expect(r.charsetClasses).toEqual(['lowercase'])
    // 4 * log2(26) = 18.8018
    expect(r.passwordEntropyBits).toBe(18.8)
    // 18.8018 * log10(2) = 5.6597
    expect(r.guessesLog10).toBe(5.66)
    expect(r.strength).toBe('very weak')
    expect(r.crackTime).toBe('instant')
  })

  it('reports zero entropy for a single repeated character', async () => {
    const r = (await util.apply('aaaaaa', {})) as Report
    expect(r.entropyPerCharacter).toBe(0)
    expect(r.totalEntropy).toBe(0)
    expect(r.uniqueCharacters).toBe(1)
    expect(r.length).toBe(6)
  })

  it('converts to nats when unit is nats', async () => {
    const r = (await util.apply('aabb', { unit: 'nats' })) as Report
    expect(r.unit).toBe('nats')
    // 1 bit = ln(2) nats
    expect(r.entropyPerCharacter).toBe(0.69)
    expect(r.totalEntropy).toBe(2.77)
    expect(r.passwordEntropy).toBe(13.03)
    // the bits field and the verdict stay in bits whatever the display unit
    expect(r.passwordEntropyBits).toBe(18.8)
    expect(r.strength).toBe('very weak')
  })

  it('detects every character class in the pool size', async () => {
    const r = (await util.apply('Abc123!', {})) as Report
    expect(r.charsetClasses).toEqual(['lowercase', 'uppercase', 'digits', 'punctuation'])
    expect(r.charsetSize).toBe(26 + 26 + 10 + 32)
    expect(charsetOf(Array.from('a b'))).toEqual({ size: 27, classes: ['lowercase', 'space'] })
    expect(charsetOf(Array.from('a\tb'))).toEqual({ size: 27, classes: ['lowercase', 'control'] })
    // DEL (0x7f) is a control character, not punctuation
    expect(charsetOf(Array.from('a\u007f'))).toEqual({ size: 27, classes: ['lowercase', 'control'] })
    expect(charsetOf(Array.from('0123'))).toEqual({ size: 10, classes: ['digits'] })
    expect(charsetOf(Array.from('naïve'))).toEqual({ size: 27, classes: ['lowercase', 'non-ASCII'] })
    expect(charsetOf([])).toEqual({ size: 0, classes: [] })
  })

  it('walks the whole strength ladder', async () => {
    const verdict = async (s: string) => ((await util.apply(s, {})) as Report).strength
    expect(await verdict('aabb')).toBe('very weak') //  18.80 bits
    expect(await verdict('0123456789')).toBe('weak') //  33.22 bits
    expect(await verdict('hunter2')).toBe('reasonable') //  36.19 bits
    expect(await verdict('Tr0ub4dor&3xY!')).toBe('strong') //  91.76 bits
    expect(await verdict('correct horse battery staple')).toBe('very strong') // 133.14 bits
  })

  it('estimates crack time from the keyspace at 1e10 guesses/second', async () => {
    // 7 chars over a 36-symbol pool: 36.19 bits => 10^0.59 seconds
    const weak = (await util.apply('hunter2', {})) as Report
    expect(weak.charsetSize).toBe(36)
    expect(weak.passwordEntropyBits).toBe(36.19)
    expect(weak.crackTime).toBe('4 seconds')

    // 14 chars over the full 94-symbol printable pool: 91.76 bits
    const strong = (await util.apply('Tr0ub4dor&3xY!', {})) as Report
    expect(strong.charsetSize).toBe(94)
    expect(strong.passwordEntropyBits).toBe(91.76)
    expect(strong.guessesLog10).toBe(27.62)
    expect(strong.crackTime).toBe('6.7e+9 years')

    // digits only: exhausted faster than one second
    expect(((await util.apply('0123456789', {})) as Report).crackTime).toBe('instant')
  })

  it('handles astral characters as single code points', async () => {
    const r = (await util.apply('🙂🙂🙃', {})) as Report
    expect(r.length).toBe(3)
    expect('🙂🙂🙃'.length).toBe(6) // 6 UTF-16 units, 3 code points
    expect(r.uniqueCharacters).toBe(2)
    expect(r.charsetClasses).toEqual(['non-ASCII'])
    expect(r.charsetSize).toBe(2)
    expect(r.passwordEntropyBits).toBe(3)
    // -(2/3)log2(2/3) - (1/3)log2(1/3) = 0.9183
    expect(r.entropyPerCharacter).toBe(0.92)
    expect(r.totalEntropy).toBe(2.75)
  })

  it('handles empty input without throwing', async () => {
    const r = (await util.apply('', {})) as Report
    expect(r.length).toBe(0)
    expect(r.entropyPerCharacter).toBe(0)
    expect(r.totalEntropy).toBe(0)
    expect(r.charsetSize).toBe(0)
    expect(r.charsetClasses).toEqual([])
    expect(r.strength).toBe('empty')
    expect(r.crackTime).toBe('instant')
    expect(await util.apply('', { format: 'text' })).toBe('')
  })

  it('renders a plain-text report when format is text', async () => {
    const out = (await util.apply('correct horse battery staple', { format: 'text' })) as string
    expect(out.split('\n')).toEqual([
      'entropy:                3.49 bits/char',
      'total entropy:          97.85 bits',
      'length:                 28 characters',
      'unique characters:      13',
      'charset size:           27 (lowercase, space)',
      'password entropy:       133.14 bits',
      'strength:               very strong',
      'est. crack time:        1.9e+22 years'
    ])
  })

  it('labels the unit in the text report', async () => {
    const out = (await util.apply('hunter2', { format: 'text', unit: 'nats' })) as string
    expect(out).toContain('entropy:                1.95 nats/char')
    expect(out).toContain('total entropy:          13.62 nats')
    expect(out).toContain('password entropy:       25.08 nats')
  })

  it('returns json for the default and for an explicit format json', async () => {
    const a = await util.apply('hunter2', {})
    const b = await util.apply('hunter2', { format: 'json', unit: 'bits' })
    expect(typeof a).toBe('object')
    expect(a).toEqual(b)
  })

  it('exposes helpers that behave sensibly', () => {
    expect(shannonBits([])).toBe(0)
    expect(shannonBits(Array.from('a'))).toBe(0)
    expect(shannonBits(Array.from('ab'))).toBe(1)
    expect(shannonBits(Array.from('abcd'))).toBe(2)
    expect(humaniseLog10Seconds(-3)).toBe('instant')
    expect(humaniseLog10Seconds(0)).toBe('1 second')
    expect(humaniseLog10Seconds(Math.log10(45))).toBe('45 seconds')
    expect(humaniseLog10Seconds(Math.log10(3600))).toBe('1 hour')
    expect(humaniseLog10Seconds(Math.log10(31557600 * 5))).toBe('5 years')
    expect(humaniseLog10Seconds(13.6)).toBe('1.3e+6 years')
    expect(humaniseLog10Seconds(300)).toBe('effectively forever')
  })

  it('throws on unknown unit or format', () => {
    expect(() => util.apply('abc', { unit: 'joules' })).toThrow(/unknown unit "joules"/)
    expect(() => util.apply('abc', { format: 'yaml' })).toThrow(/unknown format "yaml"/)
  })
})
