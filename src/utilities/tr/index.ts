import type { Utility } from '@/types/utility'

/** A single parsed element of a tr set. `lit` marks it as produced by a
 *  backslash escape, so it can never act as a range/class delimiter. */
type Tok = { ch: string; lit: boolean }

const SIMPLE_ESCAPES: Record<string, string> = {
  n: '\n',
  t: '\t',
  r: '\r',
  f: '\f',
  v: '\v',
  a: '\u0007',
  b: '\b',
  e: '\u001b'
}

const codeRange = (a: number, b: number): string[] => {
  const out: string[] = []
  for (let cp = a; cp <= b; cp++) out.push(String.fromCharCode(cp))
  return out
}

const DIGIT = codeRange(48, 57)
const UPPER = codeRange(65, 90)
const LOWER = codeRange(97, 122)

/** POSIX character classes, ASCII members in code-point order so that
 *  `[:upper:]` and `[:lower:]` line up index-for-index. */
const CLASSES: Record<string, string[]> = {
  alpha: [...UPPER, ...LOWER],
  alnum: [...DIGIT, ...UPPER, ...LOWER],
  digit: DIGIT,
  lower: LOWER,
  upper: UPPER,
  space: ['\t', '\n', '\v', '\f', '\r', ' '],
  blank: ['\t', ' '],
  punct: [...codeRange(33, 47), ...codeRange(58, 64), ...codeRange(91, 96), ...codeRange(123, 126)],
  print: codeRange(32, 126),
  graph: codeRange(33, 126),
  cntrl: [...codeRange(0, 31), '\u007f'],
  xdigit: [...DIGIT, ...codeRange(65, 70), ...codeRange(97, 102)]
}

const MAX_RANGE = 65536

/** Split a set into code points, resolving backslash escapes. */
export function tokenizeSet(set: string): Tok[] {
  const cps = Array.from(set)
  const out: Tok[] = []
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i]
    if (c !== '\\') {
      out.push({ ch: c, lit: false })
      continue
    }
    const n = cps[i + 1]
    if (n === undefined) {
      out.push({ ch: '\\', lit: true })
      continue
    }
    if (n >= '0' && n <= '7') {
      const oct = /^[0-7]{1,3}/.exec(cps.slice(i + 1).join(''))
      const digits = oct ? oct[0] : '0'
      out.push({ ch: String.fromCharCode(parseInt(digits, 8)), lit: true })
      i += digits.length
      continue
    }
    if (n === 'x' || n === 'u') {
      const rest = cps.slice(i + 2).join('')
      const m =
        n === 'x'
          ? /^[0-9a-fA-F]{1,2}/.exec(rest)
          : /^(?:\{[0-9a-fA-F]{1,6}\}|[0-9a-fA-F]{4})/.exec(rest)
      if (!m) throw new Error(`tr: invalid \\${n} escape in character set`)
      const hex = m[0].replace(/[{}]/g, '')
      const cp = parseInt(hex, 16)
      if (cp > 0x10ffff) throw new Error(`tr: code point \\${n}${hex} is out of range`)
      out.push({ ch: String.fromCodePoint(cp), lit: true })
      i += 1 + m[0].length
      continue
    }
    if (Object.prototype.hasOwnProperty.call(SIMPLE_ESCAPES, n)) {
      out.push({ ch: SIMPLE_ESCAPES[n], lit: true })
      i += 1
      continue
    }
    out.push({ ch: n, lit: true })
    i += 1
  }
  return out
}

/** Expand a tr set to an ordered list of single code points. */
export function expandSet(set: string, ranges: boolean): string[] {
  if (!set) return []
  const toks = tokenizeSet(set)
  const out: string[] = []
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]

    // [:class:]
    if (ranges && !t.lit && t.ch === '[' && toks[i + 1] && !toks[i + 1].lit && toks[i + 1].ch === ':') {
      let j = i + 2
      let name = ''
      let closed = false
      while (j < toks.length) {
        const a = toks[j]
        const b = toks[j + 1]
        if (!a.lit && a.ch === ':' && b && !b.lit && b.ch === ']') {
          closed = true
          break
        }
        name += a.ch
        j++
      }
      if (closed) {
        const members = CLASSES[name.toLowerCase()]
        if (!members) throw new Error(`tr: unknown character class "[:${name}:]"`)
        out.push(...members)
        i = j + 1
        continue
      }
    }

    // a-z
    const dash = toks[i + 1]
    const end = toks[i + 2]
    if (ranges && dash && !dash.lit && dash.ch === '-' && end) {
      const from = t.ch.codePointAt(0)
      const to = end.ch.codePointAt(0)
      if (from === undefined || to === undefined) throw new Error('tr: invalid range')
      if (to < from) throw new Error(`tr: invalid range "${t.ch}-${end.ch}" (end before start)`)
      if (to - from >= MAX_RANGE) throw new Error(`tr: range "${t.ch}-${end.ch}" is too large`)
      for (let cp = from; cp <= to; cp++) {
        if (cp >= 0xd800 && cp <= 0xdfff) continue // never emit lone surrogates
        out.push(String.fromCodePoint(cp))
      }
      i += 2
      continue
    }

    out.push(t.ch)
  }
  return out
}

const util: Utility = {
  id: 'tr',
  name: 'translate characters',
  category: 'String Ops',
  description:
    'Translate, delete, or squeeze repeated characters like POSIX tr, with a-z range and [:class:] expansion.',
  accepts: 'string',
  produces: 'string',
  tags: ['translate characters', 'character mapping', 'delete characters', 'squeeze repeats', 'posix tr', 'character substitution'],
  aliases: ['tr'],
  examples: [
    { title: 'uppercase via a-z range', input: 'hello world', params: { from: 'a-z', to: 'A-Z', delete: false, squeeze: false, ranges: true }, output: 'HELLO WORLD' }
  ],
  params: {
    from: { kind: 'string', label: 'from set', default: '', placeholder: 'a-z' },
    to: { kind: 'string', label: 'to set', default: '', placeholder: 'A-Z' },
    delete: { kind: 'boolean', label: 'delete "from" characters', default: false },
    squeeze: { kind: 'boolean', label: 'squeeze repeats', default: false },
    ranges: { kind: 'boolean', label: 'expand a-z ranges and [:classes:]', default: true }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    if (!s) return ''

    const useRanges = params?.ranges !== false
    const doDelete = params?.delete === true
    const doSqueeze = params?.squeeze === true
    const from = expandSet(String(params?.from ?? ''), useRanges)
    const to = expandSet(String(params?.to ?? ''), useRanges)

    let chars = Array.from(s)

    if (doDelete && from.length) {
      const dropped = new Set(from)
      chars = chars.filter((c) => !dropped.has(c))
    } else if (from.length && to.length) {
      // Later duplicates in `from` win, matching GNU tr. A short `to` set is
      // padded with its final character.
      const map = new Map<string, string>()
      for (let i = 0; i < from.length; i++) map.set(from[i], to[Math.min(i, to.length - 1)])
      chars = chars.map((c) => map.get(c) ?? c)
    }

    if (doSqueeze) {
      // POSIX squeezes the last set given: `to` when both are present,
      // otherwise `from` (so `from`-only + squeeze behaves like `tr -s SET`).
      const squeezeSet = new Set(to.length ? to : from)
      if (squeezeSet.size) {
        const out: string[] = []
        let prev: string | null = null
        for (const c of chars) {
          if (c === prev && squeezeSet.has(c)) continue
          out.push(c)
          prev = c
        }
        chars = out
      }
    }

    return chars.join('')
  }
}

export default util
