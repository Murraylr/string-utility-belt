import type { Utility } from '@/types/utility'

const UPPER_A = 65
const UPPER_Z = 90
const LOWER_A = 97
const LOWER_Z = 122
const DIGIT_0 = 48
const DIGIT_9 = 57

// ROT47 operates over the printable ASCII range '!' (33) .. '~' (126) — 94 characters.
const ROT47_LOW = 33
const ROT47_HIGH = 126
const ROT47_SPAN = 94

const MODES = ['letters', 'rot47', 'alphanumeric'] as const
type Mode = (typeof MODES)[number]

/** Always-positive modulo, so negative shifts work. */
const mod = (n: number, m: number) => ((n % m) + m) % m

/** Coerce the `shift` param; the UI hands us a number, a pipeline replay may hand us a string. */
export function readShift(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return 13
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(n)) {
    throw new Error(`caesar: shift must be a number (got "${String(raw)}")`)
  }
  return Math.trunc(n)
}

function readMode(raw: unknown): Mode {
  if (raw === undefined || raw === null || raw === '') return 'letters'
  const m = String(raw)
  if ((MODES as readonly string[]).includes(m)) return m as Mode
  throw new Error(`caesar: unknown mode "${m}" (expected letters, rot47 or alphanumeric)`)
}

function shiftChar(ch: string, shift: number, mode: Mode, preserveCase: boolean): string {
  const cp = ch.codePointAt(0) as number

  if (mode === 'rot47') {
    // Case is inherent to the ROT47 alphabet, so `preserveCase` cannot apply here.
    if (cp < ROT47_LOW || cp > ROT47_HIGH) return ch
    return String.fromCodePoint(ROT47_LOW + mod(cp - ROT47_LOW + shift, ROT47_SPAN))
  }

  if (cp >= UPPER_A && cp <= UPPER_Z) {
    return String.fromCodePoint(UPPER_A + mod(cp - UPPER_A + shift, 26))
  }
  if (cp >= LOWER_A && cp <= LOWER_Z) {
    const base = preserveCase ? LOWER_A : UPPER_A
    return String.fromCodePoint(base + mod(cp - LOWER_A + shift, 26))
  }
  if (mode === 'alphanumeric' && cp >= DIGIT_0 && cp <= DIGIT_9) {
    return String.fromCodePoint(DIGIT_0 + mod(cp - DIGIT_0 + shift, 10))
  }
  // Everything else (non-ASCII letters, emoji, punctuation) passes through untouched.
  return ch
}

const util: Utility = {
  id: 'caesar',
  name: 'caesar / rot-n',
  category: 'Ciphers',
  description:
    'Shift letters by a fixed amount: classic Caesar/ROT-N, rot47 over printable ASCII (use shift 47 for standard ROT47), or alphanumeric which also rotates digits 0-9.',
  accepts: 'string',
  produces: 'string',
  tags: ['rot13', 'rot47', 'shift cipher', 'substitution cipher', 'rotn'],
  aliases: ['rot13', 'rot47'],
  streamable: true,
  examples: [
    {
      title: 'shift 3',
      input: 'Attack at Dawn',
      params: { shift: 3 },
      output: 'Dwwdfn dw Gdzq'
    },
    {
      title: 'rot47',
      input: 'Hello, World! 123',
      params: { shift: 47, mode: 'rot47' },
      output: 'w6==@[ (@C=5P `ab'
    }
  ],
  params: {
    shift: { kind: 'number', label: 'shift', default: 13, integer: true },
    mode: {
      kind: 'select',
      label: 'alphabet',
      options: [...MODES],
      default: 'letters'
    },
    preserveCase: {
      kind: 'boolean',
      label: 'preserve case (off = uppercase output; ignored for rot47)',
      default: true
    }
  },
  apply: (input: any, params: any) => {
    const p = params ?? {}
    const s = String(input ?? '')
    // Empty input is never an error, even when the params are unusable — a freshly
    // added step must not light up red before anything has been typed.
    if (s === '') return ''
    const shift = readShift(p.shift)
    const mode = readMode(p.mode)
    const preserveCase = p.preserveCase === undefined ? true : Boolean(p.preserveCase)

    let out = ''
    // `for..of` iterates by code point, so astral characters stay intact.
    for (const ch of s) out += shiftChar(ch, shift, mode, preserveCase)
    return out
  }
}

export default util
