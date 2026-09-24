import { describe, it, expect } from 'vitest'
import util, { detectScript, languageName } from './index'

type Detection = {
  code: string
  language: string
  script: string
  confidence: number
  alternatives: { code: string; language: string; score: number }[]
}

const detect = async (text: string) => (await util.apply(text, {})) as unknown as Detection

const EN = 'The quick brown fox jumps over the lazy dog and keeps running through the open field.'
const FR = 'Bonjour tout le monde, ceci est un texte écrit en français pour tester la détection.'
const DE = 'Guten Morgen, das ist ein deutscher Text zur Erkennung der Sprache in diesem Werkzeug.'
const RU = 'Привет мир, это довольно длинный текст на русском языке для проверки определения.'

describe('language_detect', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('language_detect')
    expect(util.name).toBe('language detect')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(util.params).toEqual({})
  })

  it('detects English and returns a real object, not a JSON string', async () => {
    const res = await detect(EN)
    expect(typeof res).toBe('object')
    expect(res.code).toBe('eng')
    expect(res.language).toBe('English')
    expect(res.script).toBe('Latin')
    expect(res.confidence).toBeGreaterThan(0.5)
  })

  it('detects other Latin-script languages', async () => {
    expect((await detect(FR)).code).toBe('fra')
    expect((await detect(FR)).language).toBe('French')
    expect((await detect(DE)).code).toBe('deu')
    expect((await detect(DE)).language).toBe('German')
  })

  it('detects non-Latin scripts', async () => {
    const ru = await detect(RU)
    expect(ru.code).toBe('rus')
    expect(ru.script).toBe('Cyrillic')

    const el = await detect('Καλημέρα κόσμε, αυτό είναι ένα κείμενο στα ελληνικά για δοκιμή.')
    expect(el.code).toBe('ell')
    expect(el.script).toBe('Greek')
  })

  it('handles CJK: kana wins over Han for Japanese, Han alone is Mandarin, Hangul is Korean', async () => {
    const ja = await detect('これは日本語のテキストです。言語検出のテストを行います。')
    expect(ja.code).toBe('jpn')
    expect(ja.script).toBe('Japanese')
    expect(ja.confidence).toBeGreaterThan(0.8)

    const zh = await detect('这是一段中文文本，用于测试语言检测功能是否正常工作。')
    expect(zh.code).toBe('cmn')
    expect(zh.script).toBe('Han')

    const ko = await detect('안녕하세요. 이것은 한국어 텍스트입니다.')
    expect(ko.code).toBe('kor')
    expect(ko.script).toBe('Hangul')
  })

  it('falls back to the script when the text is too short for trigrams', async () => {
    // Five kana: below franc's minimum length, but kana can only be Japanese.
    const ja = await detect('こんにちは')
    expect(ja.code).toBe('jpn')
    expect(ja.alternatives).toEqual([])
    expect(ja.confidence).toBeGreaterThan(0)

    // Hebrew is not in franc-min at all — the script heuristic still names it.
    const he = await detect('שלום עולם')
    expect(he.code).toBe('heb')
    expect(he.language).toBe('Hebrew')
    expect(he.script).toBe('Hebrew')
  })

  it('ranks alternatives with named languages and scores below the winner', async () => {
    const res = await detect(RU)
    expect(res.alternatives.length).toBeGreaterThan(0)
    expect(res.alternatives.map(a => a.code)).not.toContain(res.code)
    expect(res.alternatives.map(a => a.code)).toContain('bul')
    for (const alt of res.alternatives) {
      expect(alt.language).not.toBe(alt.code)
      expect(alt.score).toBeGreaterThan(0)
      expect(alt.score).toBeLessThanOrEqual(1)
    }
  })

  it('returns undetermined for empty, symbol-only and short ambiguous input without throwing', async () => {
    const empty = await detect('')
    expect(empty).toEqual({
      code: 'und', language: 'Undetermined', script: 'Unknown', confidence: 0, alternatives: []
    })
    expect((await detect('   \n\t ')).code).toBe('und')
    expect((await detect('12345 !!! ???')).code).toBe('und')

    // Astral emoji must not be split into surrogate halves while counting.
    const emoji = await detect('😀🎉🚀👨‍👩‍👧‍👦')
    expect(emoji.code).toBe('und')
    expect(emoji.confidence).toBe(0)
  })

  it('reports the dominant script over code points, ignoring digits and punctuation', () => {
    expect(detectScript('Hello, world! 123').script).toBe('Latin')
    expect(detectScript('Привет, мир!').script).toBe('Cyrillic')
    expect(detectScript('漢字とカタカナ').script).toBe('Japanese')
    expect(detectScript('😀😀').script).toBe('Unknown')
    expect(detectScript('😀 abc').letters).toBe(3)
  })

  it('caps alternatives at five, ranks them descending and keeps confidence in [0,1]', async () => {
    // Latin script gives franc ~44 candidates; only the top five may survive.
    const res = await detect(EN)
    expect(res.alternatives.length).toBe(5)
    const scores = res.alternatives.map(a => a.score)
    expect([...scores].sort((a, b) => b - a)).toEqual(scores)
    for (const text of [EN, FR, DE, RU, '', 'こんにちは', '12345']) {
      const r = await detect(text)
      expect(r.confidence).toBeGreaterThanOrEqual(0)
      expect(r.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('picks the dominant script when scripts are mixed and never splits astral characters', () => {
    // 10 Latin letters against 9 Cyrillic ones.
    expect(detectScript('Hello world Привет мир').script).toBe('Latin')
    expect(detectScript('Привет мир hello').script).toBe('Cyrillic')
    // Mathematical bold letters are Script=Common: five code points, no script.
    const styled = detectScript('𝐇𝐞𝐥𝐥𝐨')
    expect(styled.letters).toBe(5)
    expect(styled.script).toBe('Unknown')
    // A single kana settles a kanji-dominant string as Japanese.
    expect(detectScript('東京都庁舎の会議').script).toBe('Japanese')
    expect(detectScript('東京都庁舎会議').script).toBe('Han')
  })

  it('maps ISO 639-3 codes to English names and passes unknown codes through', () => {
    expect(languageName('spa')).toBe('Spanish')
    expect(languageName('cmn')).toBe('Mandarin Chinese')
    expect(languageName('und')).toBe('Undetermined')
    expect(languageName('xxx')).toBe('xxx')
  })

  it('rejects bytes that are not valid UTF-8 text', async () => {
    await expect(util.apply(new Uint8Array([0xff, 0xfe, 0xfd]), {}))
      .rejects.toThrow('input is not valid UTF-8 text')
    // Valid UTF-8 bytes are decoded and detected normally.
    const bytes = new TextEncoder().encode(EN)
    expect(((await util.apply(bytes, {})) as unknown as Detection).code).toBe('eng')
  })
})
