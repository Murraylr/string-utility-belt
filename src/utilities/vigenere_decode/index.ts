import type { Utility } from '@/types/utility'

const UPPER_A = 65
const UPPER_Z = 90
const LOWER_A = 97
const LOWER_Z = 122

const mod = (n: number, m: number) => ((n % m) + m) % m

/** Turn the keyword into per-letter shifts (A/a = 0 .. Z/z = 25). Non-letters in the key are ignored. */
export function keyShifts(raw: unknown): number[] {
  const key = raw === undefined || raw === null ? 'KEY' : String(raw)
  const shifts: number[] = []
  for (const ch of key) {
    const cp = ch.codePointAt(0) as number
    if (cp >= UPPER_A && cp <= UPPER_Z) shifts.push(cp - UPPER_A)
    else if (cp >= LOWER_A && cp <= LOWER_Z) shifts.push(cp - LOWER_A)
  }
  if (shifts.length === 0) {
    throw new Error('vigenère: key must contain at least one letter a-z')
  }
  return shifts
}

/** direction: +1 encrypts, -1 decrypts. Shared shape with vigenere_encode. */
export function vigenere(
  s: string,
  shifts: number[],
  preserveCase: boolean,
  skipNonLetters: boolean,
  direction: 1 | -1
): string {
  let out = ''
  let ki = 0
  // `for..of` iterates by code point, so astral characters stay intact.
  for (const ch of s) {
    const cp = ch.codePointAt(0) as number
    const isUpper = cp >= UPPER_A && cp <= UPPER_Z
    const isLower = cp >= LOWER_A && cp <= LOWER_Z
    if (isUpper || isLower) {
      const base = isUpper ? UPPER_A : LOWER_A
      const k = shifts[ki % shifts.length]
      ki++
      const offset = mod(cp - base + direction * k, 26)
      out += String.fromCodePoint((preserveCase ? base : UPPER_A) + offset)
    } else {
      out += ch
      // When non-letters are not skipped they still consume a key position.
      if (!skipNonLetters) ki++
    }
  }
  return out
}

const util: Utility = {
  id: 'vigenere_decode',
  name: 'vigenère decode',
  category: 'Ciphers',
  description:
    'Decrypt Vigenère ciphertext with the keyword it was encrypted under, using the same preserve-case and skip-non-letters options.',
  accepts: 'string',
  produces: 'string',
  tags: ['cipher', 'decrypt', 'decode', 'classical', 'keyword', 'polyalphabetic', 'vigenere'],
  aliases: ['vigenère'],
  examples: [
    {
      title: 'decode with key LEMON',
      input: 'LXFOPVEFRNHR',
      params: { key: 'LEMON', preserveCase: true, skipNonLetters: true },
      output: 'ATTACKATDAWN'
    }
  ],
  params: {
    key: { kind: 'string', label: 'key', default: 'KEY', placeholder: 'KEY' },
    preserveCase: { kind: 'boolean', label: 'preserve case (off = uppercase output)', default: true },
    skipNonLetters: {
      kind: 'boolean',
      label: 'skip non-letters (off = they advance the key)',
      default: true
    }
  },
  apply: (input: any, params: any) => {
    const p = params ?? {}
    const s = String(input ?? '')
    if (s === '') return ''
    const shifts = keyShifts(p.key)
    const preserveCase = p.preserveCase === undefined ? true : Boolean(p.preserveCase)
    const skipNonLetters = p.skipNonLetters === undefined ? true : Boolean(p.skipNonLetters)
    return vigenere(s, shifts, preserveCase, skipNonLetters, -1)
  }
}

export default util
