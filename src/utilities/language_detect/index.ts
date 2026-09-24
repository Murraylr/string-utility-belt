import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/**
 * Dependencies must be loaded lazily: `src/utilities/index.ts` eagerly globs every
 * utility module, so a top-level `import 'franc-min'` would land in the initial bundle.
 * The module handle is cached because the pipeline re-runs on every keystroke.
 */
let _franc: typeof import('franc-min') | null = null
const getFranc = async () => (_franc ??= await import('franc-min'))

/** ISO 639-3 → English name. Covers every code franc-min can return, plus the
 *  script-fallback languages below. */
const LANGUAGE_NAMES: Record<string, string> = {
  amh: 'Amharic', arb: 'Arabic', azj: 'Azerbaijani', bel: 'Belarusian', ben: 'Bengali',
  bho: 'Bhojpuri', bod: 'Tibetan', bos: 'Bosnian', bul: 'Bulgarian', ceb: 'Cebuano',
  ces: 'Czech', chr: 'Cherokee', ckb: 'Central Kurdish', cmn: 'Mandarin Chinese',
  deu: 'German', div: 'Dhivehi', ell: 'Greek', eng: 'English', fra: 'French',
  fuv: 'Nigerian Fulfulde', guj: 'Gujarati', hau: 'Hausa', heb: 'Hebrew', hin: 'Hindi',
  hms: 'Southern Qiandong Miao', hnj: 'Hmong Njua', hrv: 'Croatian', hun: 'Hungarian',
  hye: 'Armenian', ibo: 'Igbo', ilo: 'Ilocano', ind: 'Indonesian', ita: 'Italian',
  jav: 'Javanese', jpn: 'Japanese', kan: 'Kannada', kat: 'Georgian', kaz: 'Kazakh',
  khm: 'Khmer', kin: 'Kinyarwanda', koi: 'Komi-Permyak', kor: 'Korean', lao: 'Lao',
  lin: 'Lingala', mad: 'Madurese', mag: 'Magahi', mai: 'Maithili', mal: 'Malayalam',
  mar: 'Marathi', mon: 'Mongolian', mya: 'Burmese', nld: 'Dutch', npi: 'Nepali',
  nya: 'Chichewa', ory: 'Odia', pan: 'Punjabi', pbu: 'Northern Pashto', pes: 'Persian',
  plt: 'Malagasy', pol: 'Polish', por: 'Portuguese', qug: 'Highland Quichua',
  ron: 'Romanian', run: 'Rundi', rus: 'Russian', sin: 'Sinhala', skr: 'Saraiki',
  som: 'Somali', spa: 'Spanish', srp: 'Serbian', sun: 'Sundanese', swe: 'Swedish',
  swh: 'Swahili', syr: 'Syriac', tam: 'Tamil', tel: 'Telugu', tgl: 'Tagalog',
  tha: 'Thai', tur: 'Turkish', ukr: 'Ukrainian', urd: 'Urdu', uzn: 'Uzbek',
  vie: 'Vietnamese', yor: 'Yoruba', zlm: 'Malay', zul: 'Zulu', zyb: 'Yongbei Zhuang',
  und: 'Undetermined'
}

export const languageName = (code: string) => LANGUAGE_NAMES[code] || code

type ScriptDef = {
  name: string
  re: RegExp
  /** Language this script implies on its own (used when franc cannot decide). */
  lang?: string
  /** Scripts where a handful of characters already carry a lot of signal. */
  dense?: boolean
}

/** Order matters only for readability — each character matches at most one script. */
const SCRIPTS: ScriptDef[] = [
  { name: 'Latin', re: /\p{Script=Latin}/u },
  { name: 'Cyrillic', re: /\p{Script=Cyrillic}/u },
  { name: 'Greek', re: /\p{Script=Greek}/u, lang: 'ell' },
  { name: 'Arabic', re: /\p{Script=Arabic}/u },
  { name: 'Hebrew', re: /\p{Script=Hebrew}/u, lang: 'heb' },
  { name: 'Han', re: /\p{Script=Han}/u, lang: 'cmn', dense: true },
  { name: 'Hiragana', re: /\p{Script=Hiragana}/u, lang: 'jpn', dense: true },
  { name: 'Katakana', re: /\p{Script=Katakana}/u, lang: 'jpn', dense: true },
  { name: 'Hangul', re: /\p{Script=Hangul}/u, lang: 'kor', dense: true },
  { name: 'Devanagari', re: /\p{Script=Devanagari}/u },
  { name: 'Bengali', re: /\p{Script=Bengali}/u, lang: 'ben' },
  { name: 'Gurmukhi', re: /\p{Script=Gurmukhi}/u, lang: 'pan' },
  { name: 'Gujarati', re: /\p{Script=Gujarati}/u, lang: 'guj' },
  { name: 'Oriya', re: /\p{Script=Oriya}/u, lang: 'ory' },
  { name: 'Tamil', re: /\p{Script=Tamil}/u, lang: 'tam' },
  { name: 'Telugu', re: /\p{Script=Telugu}/u, lang: 'tel' },
  { name: 'Kannada', re: /\p{Script=Kannada}/u, lang: 'kan' },
  { name: 'Malayalam', re: /\p{Script=Malayalam}/u, lang: 'mal' },
  { name: 'Sinhala', re: /\p{Script=Sinhala}/u, lang: 'sin' },
  { name: 'Thai', re: /\p{Script=Thai}/u, lang: 'tha', dense: true },
  { name: 'Lao', re: /\p{Script=Lao}/u, lang: 'lao', dense: true },
  { name: 'Myanmar', re: /\p{Script=Myanmar}/u, lang: 'mya' },
  { name: 'Khmer', re: /\p{Script=Khmer}/u, lang: 'khm', dense: true },
  { name: 'Georgian', re: /\p{Script=Georgian}/u, lang: 'kat' },
  { name: 'Armenian', re: /\p{Script=Armenian}/u, lang: 'hye' },
  { name: 'Ethiopic', re: /\p{Script=Ethiopic}/u, lang: 'amh' },
  { name: 'Tibetan', re: /\p{Script=Tibetan}/u, lang: 'bod' },
  { name: 'Mongolian', re: /\p{Script=Mongolian}/u, lang: 'mon' },
  { name: 'Cherokee', re: /\p{Script=Cherokee}/u, lang: 'chr' },
  { name: 'Syriac', re: /\p{Script=Syriac}/u, lang: 'syr' },
  { name: 'Thaana', re: /\p{Script=Thaana}/u, lang: 'div' }
]

const LETTER = /\p{L}/u
/** Characters sampled for the script histogram — plenty of signal, bounded cost. */
const SAMPLE_LIMIT = 4000

type ScriptInfo = { script: string; lang?: string; dense: boolean; letters: number }

/** Dominant script over the input's code points (never UTF-16 units). */
export function detectScript(text: string): ScriptInfo {
  const counts = new Map<string, number>()
  let letters = 0
  // for..of over a string iterates code points, so astral characters stay intact.
  for (const ch of text) {
    if (!LETTER.test(ch)) continue
    letters++
    for (const s of SCRIPTS) {
      if (s.re.test(ch)) {
        counts.set(s.name, (counts.get(s.name) || 0) + 1)
        break
      }
    }
    if (letters >= SAMPLE_LIMIT) break
  }
  if (counts.size === 0) return { script: 'Unknown', dense: false, letters }

  // Kana is exclusive to Japanese, so any kana at all settles a Han/kana mixture.
  const kana = (counts.get('Hiragana') || 0) + (counts.get('Katakana') || 0)
  if (kana > 0) return { script: 'Japanese', lang: 'jpn', dense: true, letters }

  let best = ''
  let bestCount = -1
  for (const [name, n] of counts) {
    if (n > bestCount) { best = name; bestCount = n }
  }
  const def = SCRIPTS.find(s => s.name === best)
  return { script: best, lang: def?.lang, dense: !!def?.dense, letters }
}

const round2 = (n: number) => Math.round(n * 100) / 100
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

const util: Utility = {
  id: 'language_detect',
  name: 'language detect',
  category: 'Analysis',
  description:
    'Detect the language of the text and report its ISO 639-3 code, English name, dominant script, a confidence score, and ranked alternative candidates.',
  accepts: 'string',
  produces: 'json',
  tags: ['langdetect', 'locale detection', 'iso 639', 'script detection', 'franc', 'language identification'],
  aliases: ['franc'],
  params: {},
  examples: [
    {
      title: 'a plain English sentence',
      input: 'The quick brown fox jumps over the lazy dog near the riverbank at dawn.',
      output: JSON.stringify(
        {
          code: 'eng',
          language: 'English',
          script: 'Latin',
          confidence: 0.18,
          alternatives: [
            { code: 'fra', language: 'French', score: 0.96 },
            { code: 'hnj', language: 'Hmong Njua', score: 0.87 },
            { code: 'ind', language: 'Indonesian', score: 0.84 },
            { code: 'por', language: 'Portuguese', score: 0.82 },
            { code: 'ita', language: 'Italian', score: 0.81 }
          ]
        },
        null,
        2
      )
    }
  ],
  apply: async (input: any) => {
    const text = toText(input)
    const { script, lang: scriptLang, dense, letters } = detectScript(text)

    if (!text.trim() || letters === 0) {
      return { code: 'und', language: languageName('und'), script, confidence: 0, alternatives: [] }
    }

    const { francAll } = await getFranc()
    const ranked = francAll(text).filter(([code]) => code !== 'und')

    // How much text we have relative to what the detector needs to be trusted.
    const lengthFactor = clamp(letters / (dense ? 15 : 60), 0, 1)

    if (ranked.length === 0) {
      // Too short (or unsupported) for trigram detection — fall back to the script,
      // which pins the language outright for scripts used by a single language.
      if (scriptLang) {
        return {
          code: scriptLang,
          language: languageName(scriptLang),
          script,
          confidence: round2(clamp(0.4 + 0.55 * lengthFactor, 0.05, 0.95)),
          alternatives: []
        }
      }
      return { code: 'und', language: languageName('und'), script, confidence: 0, alternatives: [] }
    }

    const [code] = ranked[0]
    const runnerUp = ranked.length > 1 ? ranked[1][1] : 0
    // franc normalises the winner to 1, so only the margin to the runner-up is
    // informative: a gap of 0.25 or more counts as a clean win.
    let gap = clamp((1 - runnerUp) / 0.25, 0, 1)
    if (scriptLang && scriptLang === code) gap = Math.max(gap, 0.9)

    return {
      code,
      language: languageName(code),
      script,
      confidence: round2(clamp(0.05 + 0.94 * gap * lengthFactor, 0.05, 0.99)),
      alternatives: ranked.slice(1, 6).map(([alt, score]) => ({
        code: alt,
        language: languageName(alt),
        score: round2(score)
      }))
    }
  }
}

/** Accept raw bytes defensively (a step may be handed bytes directly).
 *  `isBytes` rather than `instanceof`: jsdom hands back cross-realm typed arrays. */
function toText(input: unknown): string {
  if (isBytes(input)) {
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(input as BufferSource)
    } catch {
      throw new Error('input is not valid UTF-8 text')
    }
  }
  return String(input ?? '')
}

export default util
