import { describe, it, expect } from 'vitest'
import util from './index'
import encoder from '../morse_encode'

describe('morse_decode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('morse_decode')
    expect(util.name).toBe('morse decode')
    expect(util.category).toBe('Decoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params).toEqual({})
  })

  it('decodes words separated by a slash', async () => {
    expect(await util.apply('.... . .-.. .-.. --- / .-- --- .-. .-.. -..', {})).toBe('HELLO WORLD')
    expect(await util.apply('... --- ...', {})).toBe('SOS')
  })

  it('returns empty string for empty or blank input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
  })

  it('tolerates middot and dash-like symbols', async () => {
    expect(await util.apply('···· · ·—·· ·—·· ———', {})).toBe('HELLO')
    expect(await util.apply('··· −−− ···', {})).toBe('SOS')
    expect(await util.apply('._ _...', {})).toBe('AB')
  })

  it('accepts varied word separators', async () => {
    expect(await util.apply('... --- ...|.... ..', {})).toBe('SOS HI')
    expect(await util.apply('... --- ...   .... ..', {})).toBe('SOS HI')
    expect(await util.apply('...---... // .... ..', {})).toBe('<SOS> HI')
  })

  it('decodes digits, punctuation and accented letters', async () => {
    expect(await util.apply('----. .---- .----', {})).toBe('911')
    expect(await util.apply('.-.-.- --..-- ..--..', {})).toBe('.,?')
    expect(await util.apply('-.-. .- ..-. ..-..', {})).toBe('CAFÉ')
  })

  it('prefers real characters over prosigns that share a code', async () => {
    expect(await util.apply('.-.-.', {})).toBe('+')
    expect(await util.apply('-...-', {})).toBe('=')
    // codes no character claims do surface as prosigns
    expect(await util.apply('...---...', {})).toBe('<SOS>')
    expect(await util.apply('...-.-', {})).toBe('<SK>')
  })

  it('passes non-Morse tokens through and keeps them whole', async () => {
    expect(await util.apply('.- € -...', {})).toBe('A€B')
    const emoji = (await util.apply('.... .. / 😀', {})) as string
    expect(emoji).toBe('HI 😀')
    expect(Array.from(emoji)).toHaveLength(4)
  })

  it('keeps line structure', async () => {
    expect(await util.apply('... --- ...\n.... ..', {})).toBe('SOS\nHI')
    expect(await util.apply('.... ..\n\n-.-- ---', {})).toBe('HI\n\nYO')
    expect(await util.apply('... --- ...\r\n.... ..', {})).toBe('SOS\nHI')
  })

  it('throws on an unknown dot-dash sequence', () => {
    expect(() => util.apply('.........', {})).toThrow(/unknown sequence/)
    expect(() => util.apply('.... . --------', {})).toThrow(/unknown sequence/)
  })

  it('round-trips back through morse_encode', async () => {
    const cases = ['HELLO WORLD', 'SOS 911', 'CAFÉ', 'A+B=C', 'LINE ONE\nLINE TWO']
    for (const value of cases) {
      const encoded = (await encoder.apply(value, {})) as string
      expect(await util.apply(encoded, {})).toBe(value)
    }
    expect(await encoder.apply((await util.apply('...---...', {})) as string, {})).toBe('...---...')
  })
})
