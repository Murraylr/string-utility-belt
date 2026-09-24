import { describe, it, expect } from 'vitest'
import util from './index'
import decoder from '../morse_decode'

describe('morse_encode', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('morse_encode')
    expect(util.name).toBe('morse encode')
    expect(util.category).toBe('Encoding')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(util.params.onUnknown).toMatchObject({ kind: 'select', default: 'skip' })
    expect(util.params.letterSeparator).toMatchObject({ kind: 'string', default: ' ' })
    expect(util.params.wordSeparator).toMatchObject({ kind: 'string', default: ' / ' })
  })

  it('encodes words with the default separators', async () => {
    expect(await util.apply('HELLO WORLD', {})).toBe('.... . .-.. .-.. --- / .-- --- .-. .-.. -..')
    expect(await util.apply('sos', {})).toBe('... --- ...')
  })

  it('returns empty string for empty or blank input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  ', {})).toBe('')
  })

  it('encodes digits and punctuation', async () => {
    expect(await util.apply('911!', {})).toBe('----. .---- .---- -.-.--')
    expect(await util.apply('a,b.c?', {})).toBe('.- --..-- -... .-.-.- -.-. ..--..')
  })

  it('honours custom letter and word separators', async () => {
    expect(await util.apply('AB CD', { letterSeparator: '|', wordSeparator: '_' })).toBe('.-|-..._-.-.|-..')
    expect(await util.apply('AB CD', { letterSeparator: ' ', wordSeparator: '   ' })).toBe('.- -...   -.-. -..')
  })

  it('applies every onUnknown option', async () => {
    // skip (the default) drops characters with no Morse equivalent
    expect(await util.apply('a€b', {})).toBe('.- -...')
    expect(await util.apply('a€b', { onUnknown: 'skip' })).toBe('.- -...')
    // keep passes them through as their own token
    expect(await util.apply('a€b', { onUnknown: 'keep' })).toBe('.- € -...')
    // error refuses
    expect(() => util.apply('a€b', { onUnknown: 'error' })).toThrow(/no Morse code/)
  })

  it('encodes accented letters and keeps astral characters whole', async () => {
    expect(await util.apply('CAFÉ', {})).toBe('-.-. .- ..-. ..-..')
    // ß upper-cases to SS, so it expands to two Morse letters
    expect(await util.apply('grüße', {})).toBe('--. .-. ..-- ... ... .')
    // an emoji is one code point, never a pair of broken surrogate halves
    expect(await util.apply('hi 😀', { onUnknown: 'keep' })).toBe('.... .. / 😀')
    expect(await util.apply('😀', { onUnknown: 'skip' })).toBe('')
  })

  it('encodes <SOS>-style prosigns', async () => {
    expect(await util.apply('<SOS>', {})).toBe('...---...')
    expect(await util.apply('END <AR>', {})).toBe('. -. -.. / .-.-.')
    // an unknown angle-bracket name is not a prosign, so it follows onUnknown
    expect(() => util.apply('<ZZZ>', { onUnknown: 'error' })).toThrow(/no Morse code/)
  })

  it('keeps line structure so morse_decode can rebuild it', async () => {
    expect(await util.apply('HELLO\nWORLD', {})).toBe('.... . .-.. .-.. ---\n.-- --- .-. .-.. -..')
    // a blank line stays blank rather than being swallowed
    expect(await util.apply('HI\n\nYO', {})).toBe('.... ..\n\n-.-- ---')
    expect(await util.apply('HI\r\nYO', {})).toBe('.... ..\n-.-- ---')
    expect(await decoder.apply((await util.apply('HELLO\nWORLD', {})) as string, {})).toBe('HELLO\nWORLD')
  })

  it('round-trips through morse_decode', async () => {
    const cases = ['HELLO WORLD', 'SOS 911', 'CAFÉ AU LAIT', 'A+B=C', '<SK>', 'ONE\nTWO THREE']
    for (const value of cases) {
      const encoded = (await util.apply(value, {})) as string
      expect(await decoder.apply(encoded, {})).toBe(value)
    }
    // kept unknown characters survive the round trip too
    const kept = (await util.apply('HI 😀', { onUnknown: 'keep' })) as string
    expect(await decoder.apply(kept, {})).toBe('HI 😀')
  })
})
