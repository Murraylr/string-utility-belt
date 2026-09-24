import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * Tokenising helpers (module-private).
 * Everything walks code points so astral characters stay intact.
 * ------------------------------------------------------------------ */

const HAS_ALNUM = /[\p{L}\p{N}]/u
const WORD_RE = /[\p{L}\p{N}\p{M}]+(?:[.'’-][\p{L}\p{N}\p{M}]+)*/gu

/** Words: letters/digits/marks, allowing internal `.`, `'`, `’` and `-` (so `3.5`, `don't`, `self-esteem` are one word). */
export function words(text: string): string[] {
  return text.match(WORD_RE) ?? []
}

/** Abbreviations whose trailing period is not a sentence boundary. */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'mt', 'fig', 'no', 'vs', 'etc',
  'approx', 'inc', 'ltd', 'co', 'corp', 'dept', 'est', 'al', 'cf', 'eg', 'ie', 'rev',
  'gen', 'col', 'capt', 'sgt', 'lt', 'gov', 'sen', 'pres', 'univ', 'vol', 'pp'
])

const TERMINATORS = new Set(['.', '!', '?', '…'])
const TRAILERS = /["'”’)\]}»]/
const LOWERCASE = /\p{Ll}/u

/**
 * Split into sentences. Blank lines end a sentence; decimals (`3.5`), initials
 * (`J. R. R.`), known abbreviations (`Mr.`), quoted dialogue followed by a speech
 * tag (`"Stop!" she said.`) and ellipses mid-thought (`Wait… what?`) do not.
 */
export function sentences(text: string): string[] {
  const out: string[] = []
  const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/)

  for (const block of blocks) {
    const chars = Array.from(block)
    let cur = ''

    for (let i = 0; i < chars.length; i++) {
      const c = chars[i]
      cur += c
      if (!TERMINATORS.has(c)) continue

      if (c === '.') {
        const prev = chars[i - 1] ?? ''
        const next = chars[i + 1] ?? ''
        if (/\d/.test(prev) && /\d/.test(next)) continue // 3.5
        const word = cur.match(/(\p{L}+)\.$/u)
        if (word && ABBREVIATIONS.has(word[1].toLowerCase())) continue
        if (/(^|\s)\p{L}\.$/u.test(cur)) continue // initials: "J."
      }

      // swallow repeated terminators and closing quotes/brackets
      let j = i + 1
      let sawTrailer = false
      let sawExtraTerminator = false
      while (j < chars.length && (TERMINATORS.has(chars[j]) || TRAILERS.test(chars[j]))) {
        if (TERMINATORS.has(chars[j])) sawExtraTerminator = true
        else sawTrailer = true
        cur += chars[j]
        j++
      }
      i = j - 1

      const after = chars[i + 1]
      if (after === undefined) {
        if (HAS_ALNUM.test(cur)) out.push(cur.trim())
        cur = ''
        continue
      }
      if (!/\s/.test(after)) continue // "end.Next" — not a boundary

      // A closing quote or an ellipsis followed by a lower-case word continues the
      // same sentence: `"Stop!" she said.` and `Wait… what?` are one sentence each.
      if (sawTrailer || c === '…' || (c === '.' && sawExtraTerminator)) {
        let k = i + 1
        while (k < chars.length && /\s/.test(chars[k])) k++
        if (k < chars.length && LOWERCASE.test(chars[k])) continue
      }

      if (HAS_ALNUM.test(cur)) out.push(cur.trim())
      cur = ''
    }

    if (HAS_ALNUM.test(cur)) out.push(cur.trim())
  }

  return out
}

/* ------------------------------------------------------------------ *
 * Syllables — heuristic English counter with a small exception table.
 * ------------------------------------------------------------------ */

/**
 * A Map, not an object literal: the key is arbitrary user text, and a plain
 * object would resolve `constructor` (and friends) off `Object.prototype` and
 * hand back a function where a syllable count is expected.
 */
const SYLLABLE_EXCEPTIONS = new Map<string, number>([
  ['aisle', 1], ['area', 3], ['beautiful', 3], ['business', 2], ['colonel', 2],
  ['idea', 3], ['poem', 2], ['queue', 1], ['science', 2], ['sciences', 3],
  ['wednesday', 2],
  // Contractions, keyed on their apostrophe-free form, where the vowel-group
  // heuristic misses the syllabic (or silent) `n't` / `'ve`.
  ['arent', 1], ['werent', 1],
  ['didnt', 2], ['doesnt', 2], ['isnt', 2], ['wasnt', 2], ['hasnt', 2],
  ['hadnt', 2], ['mustnt', 2], ['neednt', 2], ['wouldnt', 2], ['couldnt', 2],
  ['shouldnt', 2], ['wouldve', 2], ['couldve', 2], ['shouldve', 2]
])

function syllablesOfPart(part: string): number {
  const raw = part.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
  const w = raw.replace(/[^a-z]/g, '')
  if (!w) return HAS_ALNUM.test(part) ? 1 : 0
  const known = SYLLABLE_EXCEPTIONS.get(w)
  if (known !== undefined) return known
  if (w.length <= 3) return 1
  const stripped = w
    .replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '')
    .replace(/^y/, '')
  const groups = stripped.match(/[aeiouy]{1,2}/g)
  return Math.max(1, groups ? groups.length : 0)
}

/**
 * Syllables in one word. Hyphenated compounds are counted per part; apostrophes
 * are NOT a split point — `syllablesOfPart` drops them, so a contraction stays a
 * single unit (`don't` = 1, not `don` + `t` = 2).
 */
export function syllablesOfWord(word: string): number {
  const parts = word.split('-').filter(Boolean)
  if (!parts.length) return 0
  return parts.reduce((sum, p) => sum + syllablesOfPart(p), 0)
}

/** Gunning Fog "complex word": 3+ syllables, ignoring -es/-ed/-ing inflections. */
function isComplex(word: string, syllables: number): boolean {
  if (syllables < 3) return false
  const m = word.toLowerCase().match(/^(.{3,}?)(es|ed|ing)$/)
  if (m && syllablesOfWord(m[1]) < 3) return false
  return true
}

/* ------------------------------------------------------------------ *
 * Scoring
 * ------------------------------------------------------------------ */

const round = (n: number, digits = 2) => {
  if (!Number.isFinite(n)) return 0
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}
const clampGrade = (n: number) => round(Math.max(0, n))
const clampEase = (n: number) => round(Math.min(100, Math.max(0, n)))

function easeLabelFor(score: number): string {
  if (score >= 90) return 'very easy'
  if (score >= 80) return 'easy'
  if (score >= 70) return 'fairly easy'
  if (score >= 60) return 'standard'
  if (score >= 50) return 'fairly difficult'
  if (score >= 30) return 'difficult'
  return 'very confusing'
}

function levelFor(grade: number): string {
  if (grade < 6) return 'elementary school'
  if (grade < 9) return 'middle school'
  if (grade < 13) return 'high school'
  if (grade < 17) return 'college'
  return 'graduate'
}

type Report = {
  fleschReadingEase: number
  fleschReadingEaseLabel: string
  fleschKincaidGrade: number
  gunningFog: number
  smog: number
  colemanLiau: number
  automatedReadabilityIndex: number
  averageGrade: number
  readingLevel: string
  words: number
  sentences: number
  syllables: number
  characters: number
  letters: number
  complexWords: number
  polysyllabicWords: number
  avgWordsPerSentence: number
  avgSyllablesPerWord: number
  avgLettersPerWord: number
}

const EMPTY: Report = {
  fleschReadingEase: 0,
  fleschReadingEaseLabel: 'n/a',
  fleschKincaidGrade: 0,
  gunningFog: 0,
  smog: 0,
  colemanLiau: 0,
  automatedReadabilityIndex: 0,
  averageGrade: 0,
  readingLevel: 'n/a',
  words: 0,
  sentences: 0,
  syllables: 0,
  characters: 0,
  letters: 0,
  complexWords: 0,
  polysyllabicWords: 0,
  avgWordsPerSentence: 0,
  avgSyllablesPerWord: 0,
  avgLettersPerWord: 0
}

export function analyse(text: string): Report {
  const wordList = words(text)
  const wordCount = wordList.length
  if (wordCount === 0) {
    return { ...EMPTY, characters: Array.from(text).length }
  }

  const sentenceCount = Math.max(1, sentences(text).length)
  const characters = Array.from(text).length
  let letters = 0
  for (const ch of text) if (HAS_ALNUM.test(ch)) letters++

  let syllableCount = 0
  let complexWords = 0
  let polysyllabicWords = 0
  for (const w of wordList) {
    const s = syllablesOfWord(w)
    syllableCount += s
    if (s >= 3) polysyllabicWords++
    if (isComplex(w, s)) complexWords++
  }

  const wps = wordCount / sentenceCount
  const spw = syllableCount / wordCount
  const lpw = letters / wordCount

  const fleschReadingEase = clampEase(206.835 - 1.015 * wps - 84.6 * spw)
  const fleschKincaidGrade = clampGrade(0.39 * wps + 11.8 * spw - 15.59)
  const gunningFog = clampGrade(0.4 * (wps + 100 * (complexWords / wordCount)))
  const smog = clampGrade(1.043 * Math.sqrt(polysyllabicWords * (30 / sentenceCount)) + 3.1291)
  const colemanLiau = clampGrade(0.0588 * (lpw * 100) - 0.296 * ((sentenceCount / wordCount) * 100) - 15.8)
  const automatedReadabilityIndex = clampGrade(4.71 * lpw + 0.5 * wps - 21.43)

  const grades = [fleschKincaidGrade, gunningFog, smog, colemanLiau, automatedReadabilityIndex]
  const averageGrade = round(grades.reduce((a, b) => a + b, 0) / grades.length)

  return {
    fleschReadingEase,
    fleschReadingEaseLabel: easeLabelFor(fleschReadingEase),
    fleschKincaidGrade,
    gunningFog,
    smog,
    colemanLiau,
    automatedReadabilityIndex,
    averageGrade,
    readingLevel: levelFor(averageGrade),
    words: wordCount,
    sentences: sentenceCount,
    syllables: syllableCount,
    characters,
    letters,
    complexWords,
    polysyllabicWords,
    avgWordsPerSentence: round(wps),
    avgSyllablesPerWord: round(spw),
    avgLettersPerWord: round(lpw)
  }
}

const row = (label: string, value: string | number) => `${(label + ':').padEnd(28)}${value}`

function renderText(r: Report): string {
  return [
    row('flesch reading ease', `${r.fleschReadingEase} (${r.fleschReadingEaseLabel})`),
    row('flesch-kincaid grade', r.fleschKincaidGrade),
    row('gunning fog', r.gunningFog),
    row('smog', r.smog),
    row('coleman-liau', r.colemanLiau),
    row('automated readability', r.automatedReadabilityIndex),
    '',
    row('estimated grade', `${r.averageGrade} (${r.readingLevel})`),
    row('words', r.words),
    row('sentences', r.sentences),
    row('syllables', r.syllables),
    row('complex words', r.complexWords),
    row('polysyllabic words', r.polysyllabicWords),
    row('avg words / sentence', r.avgWordsPerSentence),
    row('avg syllables / word', r.avgSyllablesPerWord)
  ].join('\n')
}

const util: Utility = {
  id: 'readability',
  name: 'readability scores',
  category: 'Analysis',
  description:
    'Score text for readability with Flesch Reading Ease, Flesch-Kincaid, Gunning Fog, SMOG, Coleman-Liau and ARI, as json or a plain-text report.',
  accepts: 'string',
  produces: ['json', 'string'],
  tags: ['flesch kincaid', 'gunning fog', 'smog', 'coleman-liau', 'reading grade level', 'readability score'],
  aliases: ['flesch'],
  params: {
    format: { kind: 'select', label: 'output format', options: ['json', 'text'], default: 'json' }
  },
  examples: [
    {
      title: 'two simple sentences',
      input: 'The cat sat on the mat. It was a sunny day.',
      output: JSON.stringify(
        {
          fleschReadingEase: 100,
          fleschReadingEaseLabel: 'very easy',
          fleschKincaidGrade: 0,
          gunningFog: 2.2,
          smog: 3.13,
          colemanLiau: 0,
          automatedReadabilityIndex: 0,
          averageGrade: 1.07,
          readingLevel: 'elementary school',
          words: 11,
          sentences: 2,
          syllables: 12,
          characters: 43,
          letters: 31,
          complexWords: 0,
          polysyllabicWords: 0,
          avgWordsPerSentence: 5.5,
          avgSyllablesPerWord: 1.09,
          avgLettersPerWord: 2.82
        },
        null,
        2
      )
    }
  ],
  apply: (input: any, { format }: any) => {
    const fmt = String(format || 'json')
    if (fmt !== 'json' && fmt !== 'text') {
      throw new Error(`unknown format "${fmt}" (expected json or text)`)
    }
    const report = analyse(String(input ?? ''))
    if (fmt === 'text') return report.words === 0 ? '' : renderText(report)
    return report
  }
}

export default util
