import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * Character pools
 * ------------------------------------------------------------------ */

const LOWER = 'abcdefghijklmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~'

/** Glyphs that are easy to confuse in a rendered password (or a handwritten note). */
const AMBIGUOUS = new Set(Array.from('Il1|O0oB8S5Z2`\'"~,;:.{}[]()/\\'))

/** Consonants/vowels used by the pronounceable mode (q, x, y produce awkward syllables). */
const CONSONANTS = 'bcdfghjklmnprstvwz'
const VOWELS = 'aeiou'

/**
 * Embedded word list for passphrase mode (264 short, unambiguous English words).
 * Kept module-private-ish (exported only so the test can assert its size) so the
 * utility has no runtime dependency on a dictionary file.
 */
export const WORD_LIST: string[] = (
  'able acorn actor adapt agent album alert alien alloy alpha amber amuse ' +
  'anchor angel ankle apple apron arbor arena armor arrow aspen atlas attic ' +
  'audio aurora autumn awake award azure bacon badge bagel baker balmy banjo ' +
  'barge basil basin batch beach beacon beam bean beard bench berry birch ' +
  'bison black blade blaze blend bliss bloom blues board bonus boost booth ' +
  'bounce brace braid brain brand brass brave bread break breeze brick bridge ' +
  'brief brine brisk broad bronze brook broom brush bubble buddy bugle build ' +
  'bunch bundle bunny burst butler butter button cabin cable cactus cadet camel ' +
  'cameo canal candle canoe canvas canyon carbon cargo carol carpet carrot carve ' +
  'castle catch cedar celery cello census chalk chant chapel charm chase cheer ' +
  'cherry chess chest chief chill chime choir chord chorus cider cinema circle ' +
  'citrus civic clamp class clean clever cliff climb cloak clock cloud clover ' +
  'coach coast cobalt cocoa coffee comet comic coral corner cosmic cotton cougar ' +
  'county cover coyote crane crate crayon cream credit creek crest cricket crisp ' +
  'crown crystal cumin curve custom cycle cypress daisy dance dapper dawn decade ' +
  'deluxe denim depot desert detail device diamond diary digit dinner direct dive ' +
  'dolphin domain donor doodle dove dozen draft dragon drape dream drift drive ' +
  'dune dusk eagle early earth easel eclipse edge eight elbow elder elegant ' +
  'ember emerald empire enamel energy engine enter envoy equal errand escape essay ' +
  'ether evening exact exhale expert fabric fable falcon fancy feather fern festival ' +
  'fiber fiddle field fifty filter finch fjord flame flask fleet flint float ' +
  'flora flour flute focus foggy foliage forest forge fossil fountain fox frame'
).split(' ')

/* ------------------------------------------------------------------ *
 * Randomness — seed 0 uses crypto, any other seed is a deterministic PRNG
 * ------------------------------------------------------------------ */

type Rng = () => number

function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * `crypto.getRandomValues` has real per-call overhead and this generator draws once per
 * character, so refill a block at a time rather than making one call per character
 * (count 1000 x length 4096 is ~4M draws, re-run on every keystroke otherwise).
 */
function cryptoRng(): Rng {
  const buf = new Uint32Array(256)
  let i = buf.length
  return () => {
    if (i >= buf.length) {
      crypto.getRandomValues(buf)
      i = 0
    }
    return buf[i++] / 4294967296
  }
}

const makeRng = (seed: number): Rng => (seed === 0 ? cryptoRng() : mulberry32(seed))

function pick<T>(arr: T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)]
}

function shuffle<T>(arr: T[], rng: Rng): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

/* ------------------------------------------------------------------ *
 * Generators
 * ------------------------------------------------------------------ */

type Options = {
  length: number
  words: number
  separator: string
  uppercase: boolean
  digits: boolean
  symbols: boolean
  excludeAmbiguous: boolean
}

/** Code-point aware pool builder; drops confusable glyphs when asked to. */
const poolOf = (chars: string, excludeAmbiguous: boolean): string[] => {
  const cps = Array.from(chars)
  return excludeAmbiguous ? cps.filter((c) => !AMBIGUOUS.has(c)) : cps
}

function generateRandom(rng: Rng, o: Options): string {
  const classes: string[][] = [poolOf(LOWER, o.excludeAmbiguous)]
  if (o.uppercase) classes.push(poolOf(UPPER, o.excludeAmbiguous))
  if (o.digits) classes.push(poolOf(DIGITS, o.excludeAmbiguous))
  if (o.symbols) classes.push(poolOf(SYMBOLS, o.excludeAmbiguous))

  if (o.length < classes.length) {
    throw new Error(`length must be at least ${classes.length} to include every enabled character class`)
  }

  const pool = classes.reduce<string[]>((acc, c) => acc.concat(c), [])
  // one guaranteed character per enabled class, then fill, then shuffle
  const chars = classes.map((c) => pick(c, rng))
  while (chars.length < o.length) chars.push(pick(pool, rng))
  return shuffle(chars, rng).join('')
}

function generatePronounceable(rng: Rng, o: Options): string {
  const extras = (o.digits ? 1 : 0) + (o.symbols ? 1 : 0)
  if (o.length <= extras) {
    throw new Error(`length must be greater than ${extras} for the enabled character classes`)
  }

  const consonants = poolOf(CONSONANTS, o.excludeAmbiguous)
  const vowels = poolOf(VOWELS, o.excludeAmbiguous)
  const baseLen = o.length - extras

  const chars: string[] = []
  while (chars.length < baseLen) {
    chars.push(pick(consonants, rng))
    chars.push(pick(vowels, rng))
    if (rng() < 0.25) chars.push(pick(consonants, rng))
  }
  chars.length = baseLen

  if (o.uppercase) {
    const upperPool = poolOf(UPPER, o.excludeAmbiguous)
    let at = -1
    for (let i = 0; i < chars.length; i++) {
      const up = chars[i].toUpperCase()
      if (!o.excludeAmbiguous || !AMBIGUOUS.has(up)) {
        at = i
        break
      }
    }
    if (at >= 0) chars[at] = chars[at].toUpperCase()
    else chars[0] = pick(upperPool, rng)
  }

  if (o.digits) chars.push(pick(poolOf(DIGITS, o.excludeAmbiguous), rng))
  if (o.symbols) chars.push(pick(poolOf(SYMBOLS, o.excludeAmbiguous), rng))
  return chars.join('')
}

function generatePassphrase(rng: Rng, o: Options): string {
  const words: string[] = []
  for (let i = 0; i < o.words; i++) {
    const w = pick(WORD_LIST, rng)
    words.push(o.uppercase ? w.charAt(0).toUpperCase() + w.slice(1) : w)
  }
  if (o.digits) {
    const at = Math.floor(rng() * words.length)
    words[at] += pick(poolOf(DIGITS, o.excludeAmbiguous), rng)
  }
  let phrase = words.join(o.separator)
  if (o.symbols) phrase += pick(poolOf(SYMBOLS, o.excludeAmbiguous), rng)
  return phrase
}

/* ------------------------------------------------------------------ */

const util: Utility = {
  id: 'password_generator',
  name: 'password generator',
  category: 'Generators',
  description:
    'Generate passwords as random characters, pronounceable syllables, or word passphrases, with character-class, ambiguity and seed controls.',
  accepts: 'string',
  produces: 'string',
  tags: ['password', 'passphrase', 'pronounceable', 'secure password', 'random password', 'pin', 'diceware'],
  aliases: ['pwgen', 'diceware'],
  examples: [
    {
      title: 'seeded random password',
      input: '',
      params: { mode: 'random', length: 16, seed: 42 },
      output: 'nm7U=L&9*MvKtqHs'
    },
    {
      title: 'seeded passphrase',
      input: '',
      params: { mode: 'passphrase', words: 4, seed: 42 },
      output: 'Coyote6-Chase-Errand-Dance%'
    }
  ],
  params: {
    mode: { kind: 'select', label: 'mode', options: ['random', 'pronounceable', 'passphrase'], default: 'random' },
    length: { kind: 'number', label: 'length', default: 20, min: 1, max: 4096, integer: true },
    words: { kind: 'number', label: 'words (passphrase)', default: 4, min: 1, max: 64, integer: true },
    separator: { kind: 'string', label: 'separator (passphrase)', default: '-' },
    uppercase: { kind: 'boolean', label: 'uppercase', default: true },
    digits: { kind: 'boolean', label: 'digits', default: true },
    symbols: { kind: 'boolean', label: 'symbols', default: true },
    excludeAmbiguous: { kind: 'boolean', label: 'exclude ambiguous', default: true },
    count: { kind: 'number', label: 'count', default: 1, min: 1, max: 1000, integer: true },
    seed: { kind: 'number', label: 'seed (0 = crypto random)', default: 0 }
  },
  apply: (_input: any, p: any) => {
    const params = p ?? {}
    const mode = String(params.mode ?? 'random')
    if (mode !== 'random' && mode !== 'pronounceable' && mode !== 'passphrase') {
      throw new Error(`unknown mode "${mode}"`)
    }

    const length = Math.floor(Number(params.length ?? 20))
    const words = Math.floor(Number(params.words ?? 4))
    const count = Math.floor(Number(params.count ?? 1))
    const seedRaw = Number(params.seed ?? 0)
    const seed = Number.isFinite(seedRaw) ? Math.floor(seedRaw) : 0

    if (!Number.isFinite(count) || count < 1) throw new Error('count must be at least 1')
    if (count > 1000) throw new Error('count must be 1000 or less')

    if (mode === 'passphrase') {
      if (!Number.isFinite(words) || words < 1) throw new Error('words must be at least 1')
      if (words > 64) throw new Error('words must be 64 or less')
    } else {
      if (!Number.isFinite(length) || length < 1) throw new Error('length must be at least 1')
      if (length > 4096) throw new Error('length must be 4096 or less')
    }

    const o: Options = {
      length,
      words,
      separator: params.separator == null ? '-' : String(params.separator),
      uppercase: params.uppercase !== false,
      digits: params.digits !== false,
      symbols: params.symbols !== false,
      excludeAmbiguous: params.excludeAmbiguous !== false
    }

    const rng = makeRng(seed)
    const out: string[] = []
    for (let i = 0; i < count; i++) {
      if (mode === 'random') out.push(generateRandom(rng, o))
      else if (mode === 'pronounceable') out.push(generatePronounceable(rng, o))
      else out.push(generatePassphrase(rng, o))
    }
    return out.join('\n')
  }
}

export default util
