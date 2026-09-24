import { describe, it, expect } from 'vitest'
import util from './index'

describe('text_stats', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('text_stats')
    expect(util.name).toBe('text statistics')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['json', 'string'])
  })

  it('reports the full stat set for a realistic sentence', async () => {
    const res = (await util.apply('Hello world. How are you?', {})) as any
    expect(typeof res).toBe('object')
    expect(res.characters).toBe(25)
    expect(res.charactersNoSpaces).toBe(21)
    expect(res.graphemes).toBe(25)
    expect(res.words).toBe(5)
    expect(res.uniqueWords).toBe(5)
    expect(res.sentences).toBe(2)
    expect(res.paragraphs).toBe(1)
    expect(res.lines).toBe(1)
    expect(res.nonEmptyLines).toBe(1)
    expect(res.bytesUtf8).toBe(25)
    expect(res.bytesUtf16).toBe(50)
    expect(res.avgWordLength).toBe(3.8)
    expect(res.avgWordsPerSentence).toBe(2.5)
    expect(res.longestWord).toBe('Hello')
    expect(res.longestLine).toBe(25)
  })

  it('returns zeroed stats for empty input without throwing', async () => {
    const res = (await util.apply('', {})) as any
    expect(res.characters).toBe(0)
    expect(res.words).toBe(0)
    expect(res.lines).toBe(0)
    expect(res.sentences).toBe(0)
    expect(res.paragraphs).toBe(0)
    expect(res.avgWordLength).toBe(0)
    expect(res.avgWordsPerSentence).toBe(0)
    expect(res.longestWord).toBe('')
    expect(res.longestLine).toBe(0)
  })

  it('counts astral characters as one grapheme and accented text correctly', async () => {
    const res = (await util.apply('héllo 😀', {})) as any
    expect(res.characters).toBe(8) // utf-16 code units
    expect(res.graphemes).toBe(7) // code points / grapheme clusters
    expect(res.bytesUtf8).toBe(11)
    expect(res.longestWord).toBe('héllo')
    expect(res.words).toBe(1) // the lone emoji is not a word
  })

  it('keeps combining marks attached in decomposed (NFD) text', async () => {
    // "cafe" + U+0301 and "nai" + U+0308 + "ve" — the same words in NFD form.
    const nfd = 'cafe\u0301, nai\u0308ve cafe\u0301'
    const res = (await util.apply(nfd, {})) as any
    expect(res.words).toBe(3)
    expect(res.uniqueWords).toBe(2)
    expect(res.longestWord).toBe('nai\u0308ve')
    expect(res.avgWordLength).toBe(5.33) // (5 + 6 + 5) / 3 code points
    expect(res.graphemes).toBe(16) // 19 code points, the three marks merge into their bases
  })

  it('does not count punctuation-only tokens as words', async () => {
    const res = (await util.apply('- - hello ...', {})) as any
    expect(res.words).toBe(1)
    expect(res.uniqueWords).toBe(1)
    expect(res.longestWord).toBe('hello')
    expect(res.avgWordsPerSentence).toBe(1)
  })

  it('counts lines, non-empty lines and paragraphs across line endings', async () => {
    const res = (await util.apply('One line.\n\nSecond para.\r\nThird line.', {})) as any
    expect(res.lines).toBe(4)
    expect(res.nonEmptyLines).toBe(3)
    expect(res.paragraphs).toBe(2)
    expect(res.sentences).toBe(3)
    expect(res.words).toBe(6)
  })

  it('ends a sentence after a closing quote but not inside brackets', async () => {
    const quoted = (await util.apply('He said "hi." Then left.', {})) as any
    expect(quoted.sentences).toBe(2)
    const parens = (await util.apply('Wait (really!) for it.', {})) as any
    expect(parens.sentences).toBe(1)
  })

  it('folds case for unique words and ignores trailing punctuation', async () => {
    const res = (await util.apply('Cat cat, CAT! dog', {})) as any
    expect(res.words).toBe(4)
    expect(res.uniqueWords).toBe(2)
  })

  it('renders a plain-text report with format=text', async () => {
    const res = (await util.apply('Hello world. How are you?', { format: 'text' })) as any
    expect(typeof res).toBe('string')
    const lines = String(res).split('\n')
    expect(lines).toHaveLength(15)
    expect(lines[0]).toMatch(/^characters: +25$/)
    expect(res).toMatch(/\nwords: +5\n/)
    expect(res).toMatch(/longest word: +Hello/)
  })

  it('returns json when format=json is set explicitly', async () => {
    const res = (await util.apply('one two', { format: 'json' })) as any
    expect(typeof res).toBe('object')
    expect(res.words).toBe(2)
  })

  it('throws on an unknown format', async () => {
    await expect(async () => await util.apply('hi', { format: 'xml' })).rejects.toThrow(
      /unknown format/
    )
  })

  it('counts graphemes across segmentation windows exactly like one pass', async () => {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const onePass = (t: string) => { let n = 0; for (const _ of seg.segment(t)) n++; return n }
    const family = '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}'
    const inputs = [
      // clusters of 1-8 code units at every offset relative to the 8192-unit windows
      Array.from({ length: 6000 }, (_, i) => ['a', 'e\u0301', '\u{1F1FA}\u{1F1F8}', family, '\u{1F600}'][i % 5]).join(''),
      // a long run of flags: regional-indicator pairing must survive the cuts
      '\u{1F1FA}'.repeat(20001),
      // one cluster longer than a window
      'a' + '\u0301'.repeat(20000) + 'b',
      'x'.repeat(8191) + family + 'y',
    ]
    for (const input of inputs) {
      const res = (await util.apply(input, {})) as any
      expect(res.graphemes).toBe(onePass(input))
    }
  })
})
