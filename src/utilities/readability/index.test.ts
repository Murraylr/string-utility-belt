import { describe, it, expect } from 'vitest'
import util, { words, sentences, syllablesOfWord, analyse } from './index'

type Report = Record<string, any>

describe('readability', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('readability')
    expect(util.name).toBe('readability scores')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['json', 'string'])
    expect(util.params.format).toEqual({
      kind: 'select',
      label: 'output format',
      options: ['json', 'text'],
      default: 'json'
    })
  })

  it('scores a simple sentence', async () => {
    const r = (await util.apply('The cat sat on the mat.', {})) as Report
    expect(r.words).toBe(6)
    expect(r.sentences).toBe(1)
    expect(r.syllables).toBe(6)
    expect(r.letters).toBe(17)
    // 206.835 - 1.015*6 - 84.6*1 = 116.15, clamped to the 0..100 reporting range
    expect(r.fleschReadingEase).toBe(100)
    expect(r.fleschReadingEaseLabel).toBe('very easy')
    expect(r.readingLevel).toBe('elementary school')
    expect(r.avgWordsPerSentence).toBe(6)
    expect(r.avgSyllablesPerWord).toBe(1)
  })

  /*
   * 31 words / 3 sentences / 38 syllables / 139 letters, 0 complex words.
   * wps = 10.3333, spw = 1.22581, lpw = 4.48387
   *   FRE  = 206.835 - 1.015*wps - 84.6*spw            = 92.64
   *   FK   = 0.39*wps + 11.8*spw - 15.59               =  2.90
   *   Fog  = 0.4*(wps + 100*0/31)                      =  4.13
   *   SMOG = 1.043*sqrt(0 * 30/3) + 3.1291             =  3.13
   *   CL   = 0.0588*448.387 - 0.296*9.6774 - 15.8      =  7.70
   *   ARI  = 4.71*lpw + 0.5*wps - 21.43                =  4.86
   */
  it('matches hand-computed values for every formula on a realistic paragraph', async () => {
    const para =
      'The quick brown fox jumps over the lazy dog. It was a bright cold day in April, ' +
      'and the clocks were striking thirteen. Winston Smith slipped quickly through the glass doors.'
    const r = (await util.apply(para, {})) as Report
    expect(r.words).toBe(31)
    expect(r.sentences).toBe(3)
    expect(r.syllables).toBe(38)
    expect(r.letters).toBe(139)
    expect(r.characters).toBe(173)
    expect(r.fleschReadingEase).toBe(92.64)
    expect(r.fleschKincaidGrade).toBe(2.9)
    expect(r.gunningFog).toBe(4.13)
    expect(r.smog).toBe(3.13)
    expect(r.colemanLiau).toBe(7.7)
    expect(r.automatedReadabilityIndex).toBe(4.86)
    expect(r.averageGrade).toBe(4.54)
    expect(r.avgWordsPerSentence).toBe(10.33)
    expect(r.avgSyllablesPerWord).toBe(1.23)
    expect(r.avgLettersPerWord).toBe(4.48)
  })

  it('scores harder prose lower than easy prose', async () => {
    const easy = (await util.apply('I ran. He sat. She won. We ate.', {})) as Report
    const hard = (await util.apply(
      'The unprecedented institutionalisation of administrative responsibilities necessitates ' +
        'considerable organisational reconfiguration throughout multinational corporations.',
      {}
    )) as Report
    expect(easy.fleschReadingEase).toBeGreaterThan(hard.fleschReadingEase)
    expect(hard.averageGrade).toBeGreaterThan(easy.averageGrade)
    expect(hard.readingLevel).toBe('graduate')
    expect(hard.fleschReadingEaseLabel).toBe('very confusing')
    expect(hard.gunningFog).toBeGreaterThan(0)
    expect(hard.smog).toBeGreaterThan(0)
    expect(hard.colemanLiau).toBeGreaterThan(0)
    expect(hard.automatedReadabilityIndex).toBeGreaterThan(0)
  })

  it('counts complex and polysyllabic words', async () => {
    const r = (await util.apply('Communication is fundamentally complicated.', {})) as Report
    expect(r.words).toBe(4)
    expect(r.polysyllabicWords).toBe(3)
    expect(r.complexWords).toBe(3)
  })

  it('ignores -es/-ed/-ing inflections when counting Gunning Fog complex words', async () => {
    const r = (await util.apply('The team wanted the report.', {})) as Report
    expect(r.complexWords).toBe(0)
    // "beginning" is 3 syllables but an inflected form of the 2-syllable stem
    // "begin", so SMOG counts it as polysyllabic and Gunning Fog does not.
    const inflected = (await util.apply('A beginning.', {})) as Report
    expect(inflected.polysyllabicWords).toBe(1)
    expect(inflected.complexWords).toBe(0)
    // "developing" has a 3-syllable stem, so it counts for both
    const genuine = (await util.apply('Developing.', {})) as Report
    expect(genuine.polysyllabicWords).toBe(1)
    expect(genuine.complexWords).toBe(1)
  })

  it('handles empty and whitespace-only input without throwing', async () => {
    const r = (await util.apply('', {})) as Report
    expect(r.words).toBe(0)
    expect(r.sentences).toBe(0)
    expect(r.characters).toBe(0)
    expect(r.fleschReadingEase).toBe(0)
    expect(r.fleschReadingEaseLabel).toBe('n/a')
    expect(r.readingLevel).toBe('n/a')
    expect(((await util.apply('   \n  ', {})) as Report).characters).toBe(6)
    expect(await util.apply('   \n  ', { format: 'text' })).toBe('')
    expect(await util.apply('', { format: 'text' })).toBe('')
  })

  it('does not split sentences on abbreviations, initials or decimals', async () => {
    const r = (await util.apply('Mr. Smith went to Washington. He arrived at 3.5 miles per hour.', {})) as Report
    expect(r.sentences).toBe(2)
    expect(r.words).toBe(12)
    expect(sentences('J. R. R. Tolkien wrote books. He liked trees.')).toEqual([
      'J. R. R. Tolkien wrote books.',
      'He liked trees.'
    ])
  })

  it('keeps quoted dialogue and mid-thought ellipses in one sentence', () => {
    expect(sentences('"Hello!" she said. Bye.')).toEqual(['"Hello!" she said.', 'Bye.'])
    expect(sentences('Wait… what?')).toEqual(['Wait… what?'])
    expect(sentences('Wait... what? Really.')).toEqual(['Wait... what?', 'Really.'])
    // a closing bracket or quote followed by a capital is still a real boundary
    expect(sentences('(He left.) She stayed.')).toEqual(['(He left.)', 'She stayed.'])
    expect(sentences('Wow!!! Amazing.')).toEqual(['Wow!!!', 'Amazing.'])
  })

  it('treats blank lines as sentence breaks', () => {
    expect(sentences('A heading\n\nSome body text here')).toEqual(['A heading', 'Some body text here'])
    expect(sentences('A heading\r\n\r\nBody')).toEqual(['A heading', 'Body'])
    expect(sentences('')).toEqual([])
    expect(sentences('!?!')).toEqual([])
  })

  it('handles unicode text and keeps astral characters whole', async () => {
    const text = 'Le café est très bon. Il coûte 3 € 🙂'
    const r = (await util.apply(text, {})) as Report
    // 36 code points but 37 UTF-16 units — the emoji must be counted once
    expect(r.characters).toBe(36)
    expect(text.length).toBe(37)
    expect(r.sentences).toBe(2)
    expect(r.words).toBe(8)
    expect(words('naïve résumé')).toEqual(['naïve', 'résumé'])
    expect(words("don't self-esteem 3.5")).toEqual(["don't", 'self-esteem', '3.5'])
  })

  it('counts syllables per hyphenated part but keeps contractions whole', () => {
    expect(syllablesOfWord('cat')).toBe(1)
    expect(syllablesOfWord('self-esteem')).toBe(3)
    expect(syllablesOfWord('business')).toBe(2)
    expect(syllablesOfWord('table')).toBe(2)
    expect(syllablesOfWord('readability')).toBe(5)
    // regression: apostrophes are not a syllable break
    expect(syllablesOfWord("don't")).toBe(1)
    expect(syllablesOfWord("it's")).toBe(1)
    expect(syllablesOfWord("they're")).toBe(1)
    expect(syllablesOfWord("aren't")).toBe(1)
    expect(syllablesOfWord("didn't")).toBe(2)
    expect(syllablesOfWord("o'clock")).toBe(2)
    expect(analyse("I don't think it's fine.").syllables).toBe(5)
  })

  /*
   * Regression: the syllable exception table must not be reachable through
   * Object.prototype. With a plain object literal, `constructor` resolved to a
   * function, `syllableCount += s` concatenated it as a string, and every derived
   * score silently collapsed (reading ease 0, syllables "10function Object()...").
   */
  it('does not resolve words off Object.prototype', async () => {
    expect(syllablesOfWord('constructor')).toBe(3)
    expect(syllablesOfWord('tostring')).toBe(2) // to-string
    expect(syllablesOfWord('valueof')).toBe(3) // val-ue-of
    const r = (await util.apply('The constructor runs first.', {})) as Report
    expect(r.words).toBe(4)
    expect(r.syllables).toBe(6)
    expect(typeof r.syllables).toBe('number')
    expect(r.polysyllabicWords).toBe(1)
    expect(r.complexWords).toBe(1)
    expect(r.avgSyllablesPerWord).toBe(1.5)
    expect(r.fleschReadingEase).toBe(75.88)
    expect(r.fleschReadingEaseLabel).toBe('fairly easy')
    expect(r.fleschKincaidGrade).toBe(3.67)
    expect(r.gunningFog).toBe(11.6)
    expect(r.smog).toBe(8.84)
    expect(r.colemanLiau).toBe(10.61)
    expect(r.automatedReadabilityIndex).toBe(7.65)
    expect(r.averageGrade).toBe(8.47)
    expect(r.readingLevel).toBe('middle school')
  })

  it('renders a plain-text report when format is text', async () => {
    const out = (await util.apply('The cat sat on the mat. The dog ran fast.', { format: 'text' })) as string
    const lines = out.split('\n')
    expect(lines[0]).toBe('flesch reading ease:        100 (very easy)')
    expect(lines[1]).toBe('flesch-kincaid grade:       0')
    expect(lines[2]).toBe('gunning fog:                2')
    expect(lines[3]).toBe('smog:                       3.13')
    expect(lines).toContain('estimated grade:            1.03 (elementary school)')
    expect(lines).toContain('words:                      10')
    expect(lines).toContain('sentences:                  2')
    expect(lines).toContain('syllables:                  10')
  })

  it('returns json by default and for format json', async () => {
    const a = await util.apply('Hello there.', {})
    const b = await util.apply('Hello there.', { format: 'json' })
    expect(typeof a).toBe('object')
    expect(a).toEqual(b)
    expect((a as Report).words).toBe(2)
  })

  it('throws on an unknown format', () => {
    expect(() => util.apply('hi', { format: 'yaml' })).toThrow(/unknown format "yaml"/)
    expect(() => util.apply('hi', { format: 'csv' })).toThrow()
  })
})
