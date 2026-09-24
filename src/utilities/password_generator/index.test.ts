import { describe, it, expect } from 'vitest'
import util, { WORD_LIST } from './index'

const SEEDED_RANDOM = 'K*&7vHM=ULntT9HmasqY'
const SEEDED_PRONOUNCEABLE = 'Peragimasemr9!'
const SEEDED_PASSPHRASE = 'Coyote6-Chase-Errand-Dance%'

/** Confusable glyphs the utility promises to drop when excludeAmbiguous is on. */
const AMBIGUOUS = 'Il1|O0oB8S5Z2`\'"~,;:.{}[]()/\\'
/** The full symbol pool, ambiguous members included. */
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>?/~'
const hasSymbol = (s: string) => [...s].some((c) => SYMBOLS.includes(c))

describe('password_generator', () => {
  it('has correct metadata and a usable embedded word list', () => {
    expect(util.id).toBe('password_generator')
    expect(util.name).toBe('password generator')
    expect(util.category).toBe('Generators')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(new Set(WORD_LIST).size).toBe(WORD_LIST.length)
    expect(WORD_LIST.length).toBeGreaterThanOrEqual(256)
    expect(WORD_LIST.every((w) => /^[a-z]{3,}$/.test(w))).toBe(true)
  })

  it('is deterministic for a non-zero seed in every mode', async () => {
    expect(await util.apply('', { seed: 42 })).toBe(SEEDED_RANDOM)
    expect(await util.apply('', { seed: 42 })).toBe(SEEDED_RANDOM)
    expect(await util.apply('', { mode: 'pronounceable', length: 14, seed: 42 })).toBe(SEEDED_PRONOUNCEABLE)
    expect(await util.apply('', { mode: 'passphrase', seed: 42 })).toBe(SEEDED_PASSPHRASE)
    expect(await util.apply('', { seed: 43 })).not.toBe(SEEDED_RANDOM)
  })

  it('uses crypto randomness when the seed is 0 and honours length', async () => {
    const a = String(await util.apply('', { length: 24 }))
    const b = String(await util.apply('', { length: 24 }))
    expect(a).toHaveLength(24)
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[\x21-\x7e]{24}$/)
    // the buffered crypto pool must keep working past its refill boundary
    const long = String(await util.apply('', { length: 4000 }))
    expect(long).toHaveLength(4000)
    expect(new Set(long).size).toBeGreaterThan(30)
  })

  it('guarantees exact length and one character from every enabled class', async () => {
    const failures: string[] = []
    for (let seed = 1; seed <= 40; seed++) {
      for (const length of [4, 5, 8, 20, 33]) {
        const pw = String(await util.apply('', { length, seed }))
        if ([...pw].length !== length) failures.push(`length ${length} seed ${seed} -> ${pw}`)
        if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/[0-9]/.test(pw) || !hasSymbol(pw)) {
          failures.push(`missing class, length ${length} seed ${seed} -> ${pw}`)
        }
        if ([...pw].some((c) => AMBIGUOUS.includes(c))) failures.push(`ambiguous ${length}/${seed} -> ${pw}`)
      }
    }
    expect(failures.slice(0, 5)).toEqual([])
  })

  it('respects the character class toggles', async () => {
    const lowerOnly = String(
      await util.apply('', { length: 30, uppercase: false, digits: false, symbols: false, seed: 5 })
    )
    expect(lowerOnly).toMatch(/^[a-z]{30}$/)

    const noSymbols = String(await util.apply('', { length: 30, symbols: false, seed: 5 }))
    expect(noSymbols).toMatch(/^[a-zA-Z0-9]{30}$/)

    const symbolsOnlyExtra = String(await util.apply('', { length: 30, uppercase: false, digits: false, seed: 5 }))
    expect(symbolsOnlyExtra).toMatch(/^[a-z!@#$%^&*\-_=+<>?]{30}$/)
    expect(hasSymbol(symbolsOnlyExtra)).toBe(true)

    const withAmbiguous = String(await util.apply('', { length: 400, excludeAmbiguous: false, seed: 5 }))
    expect(withAmbiguous).toHaveLength(400)
    expect([...withAmbiguous].some((c) => AMBIGUOUS.includes(c))).toBe(true)
  })

  it('drops ambiguous glyphs when asked to', async () => {
    const pw = String(await util.apply('', { length: 400, excludeAmbiguous: true, seed: 5 }))
    expect(pw).toHaveLength(400)
    expect([...pw].filter((c) => AMBIGUOUS.includes(c))).toEqual([])
    // and the surviving pool is still wide enough to be worth generating
    expect(new Set(pw).size).toBeGreaterThan(40)
  })

  it('builds pronounceable passwords of the requested length', async () => {
    const pw = String(await util.apply('', { mode: 'pronounceable', length: 16, seed: 8 }))
    expect(pw).toHaveLength(16)
    // letters, then the guaranteed digit, then the guaranteed symbol
    expect(pw).toMatch(/^[A-Za-z]{14}[0-9][!@#$%^&*\-_=+<>?]$/)

    const failures: string[] = []
    for (let seed = 1; seed <= 30; seed++) {
      for (const length of [3, 6, 16, 31]) {
        const p = String(await util.apply('', { mode: 'pronounceable', length, seed }))
        if ([...p].length !== length) failures.push(`length ${length} seed ${seed} -> ${p}`)
        if (!/[A-Z]/.test(p) || !/[0-9]/.test(p) || !hasSymbol(p)) failures.push(`class ${length}/${seed} -> ${p}`)
        if ([...p].some((c) => AMBIGUOUS.includes(c))) failures.push(`ambiguous ${length}/${seed} -> ${p}`)
      }
    }
    expect(failures.slice(0, 5)).toEqual([])

    const plain = String(
      await util.apply('', {
        mode: 'pronounceable', length: 12, uppercase: false, digits: false, symbols: false, seed: 8
      })
    )
    expect(plain).toMatch(/^[a-z]{12}$/)
    // alternating consonant/vowel structure, so no run of four identical letters
    expect(plain).not.toMatch(/(.)\1\1/)

    const loose = String(await util.apply('', { mode: 'pronounceable', length: 12, excludeAmbiguous: false, seed: 8 }))
    expect(loose).toHaveLength(12)
  })

  it('builds passphrases from the word list with the chosen separator', async () => {
    const phrase = String(await util.apply('', { mode: 'passphrase', words: 5, separator: '.', seed: 3 }))
    const bare = phrase.slice(0, -1) // trailing guaranteed symbol
    const parts = bare.split('.')
    expect(parts).toHaveLength(5)
    expect(parts.every((w) => /^[A-Z]/.test(w))).toBe(true)
    expect(bare).toMatch(/[0-9]/)
    expect(phrase.slice(-1)).toMatch(/[!@#$%^&*\-_=+<>?]/)
    expect(parts.every((w) => WORD_LIST.includes(w.replace(/[0-9]/g, '').toLowerCase()))).toBe(true)

    const failures: string[] = []
    for (let seed = 1; seed <= 30; seed++) {
      const p = String(await util.apply('', { mode: 'passphrase', words: 4, separator: '-', seed }))
      const words = p.slice(0, -1).split('-')
      if (words.length !== 4) failures.push(`words ${seed} -> ${p}`)
      if (!/[0-9]/.test(p)) failures.push(`no digit ${seed} -> ${p}`)
      if (!SYMBOLS.includes(p.slice(-1))) failures.push(`no symbol ${seed} -> ${p}`)
      if (!words.every((w) => WORD_LIST.includes(w.replace(/[0-9]/g, '').toLowerCase()))) {
        failures.push(`off-list ${seed} -> ${p}`)
      }
    }
    expect(failures.slice(0, 5)).toEqual([])

    const quiet = String(
      await util.apply('', {
        mode: 'passphrase', words: 4, separator: ' ', uppercase: false, digits: false, symbols: false, seed: 3
      })
    )
    expect(quiet.split(' ')).toHaveLength(4)
    expect(quiet.split(' ').every((w) => WORD_LIST.includes(w))).toBe(true)

    const glued = String(
      await util.apply('', {
        mode: 'passphrase', words: 3, separator: '', digits: false, symbols: false, seed: 5
      })
    )
    expect(glued).toMatch(/^([A-Z][a-z]+){3}$/)
  })

  it('emits one password per line for a count above 1, in every mode', async () => {
    const lines = String(await util.apply('', { count: 5, seed: 12 })).split('\n')
    expect(lines).toHaveLength(5)
    expect(new Set(lines).size).toBe(5)
    expect(lines.every((l) => l.length === 20)).toBe(true)

    const pron = String(await util.apply('', { mode: 'pronounceable', length: 12, count: 3, seed: 12 })).split('\n')
    expect(pron).toHaveLength(3)
    expect(pron.every((l) => l.length === 12)).toBe(true)
    expect(new Set(pron).size).toBe(3)

    const phrases = String(await util.apply('', { mode: 'passphrase', words: 3, count: 3, seed: 12 })).split('\n')
    expect(phrases).toHaveLength(3)
    expect(phrases.every((l) => l.slice(0, -1).split('-').length === 3)).toBe(true)
  })

  it('ignores its input, including non-ASCII text', async () => {
    expect(await util.apply('🔐 naïve 日本語', { seed: 21 })).toBe(await util.apply('', { seed: 21 }))
    expect(String(await util.apply('', {}))).toHaveLength(20)
  })

  it('rejects impossible configurations', () => {
    expect(() => util.apply('', { length: 3 })).toThrow(/at least 4 to include every enabled character class/)
    expect(() => util.apply('', { length: 0 })).toThrow(/length must be at least 1/)
    expect(() => util.apply('', { length: 5000 })).toThrow(/length must be 4096 or less/)
    expect(() => util.apply('', { count: 0 })).toThrow(/count must be at least 1/)
    expect(() => util.apply('', { count: 5000 })).toThrow(/count must be 1000 or less/)
    expect(() => util.apply('', { mode: 'diceware' })).toThrow(/unknown mode/)
    expect(() => util.apply('', { mode: 'passphrase', words: 0 })).toThrow(/words must be at least 1/)
    expect(() => util.apply('', { mode: 'passphrase', words: 100 })).toThrow(/words must be 64 or less/)
    expect(() => util.apply('', { mode: 'pronounceable', length: 2 })).toThrow(/length must be greater than 2/)
  })
})
