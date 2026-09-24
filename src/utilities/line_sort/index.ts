import type { Utility } from '@/types/utility'

type Cmp = (a: string, b: string) => number

/** Deterministic PRNG so `random` mode is reproducible when a seed is given. */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Leading numeric value of a line, or NaN when it does not start with a number. */
function leadingNumber(s: string): number {
  const m = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(s)
  return m ? Number(m[0]) : NaN
}

/** Compare digit runs numerically and text runs lexically, so v2 sorts before v10. */
function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g
  const ax = a.match(re) ?? []
  const bx = b.match(re) ?? []
  const len = Math.min(ax.length, bx.length)
  for (let i = 0; i < len; i++) {
    const an = /^\d/.test(ax[i])
    const bn = /^\d/.test(bx[i])
    if (an && bn) {
      const d = Number(ax[i]) - Number(bx[i])
      if (d !== 0) return d < 0 ? -1 : 1
      // equal value but different width ("01" vs "1"): shorter first, stable and total
      if (ax[i].length !== bx[i].length) return ax[i].length - bx[i].length
    } else {
      const d = ax[i].localeCompare(bx[i])
      if (d !== 0) return d
    }
  }
  return ax.length - bx.length
}

/** Pull the 1-based `column`th field out of a line. */
function fieldOf(line: string, column: number, separator: string): string {
  const parts = separator === ''
    ? line.trim().split(/\s+/)
    : line.split(separator)
  const idx = Math.max(1, Math.floor(column)) - 1
  return parts[idx] ?? ''
}

const util: Utility = {
  id: 'line_sort',
  name: 'sort lines',
  category: 'Formatting',
  description:
    'Sort lines alphabetically, numerically, naturally (v2 before v10), by length, by a column, or randomly.',
  accepts: 'string',
  produces: 'string',
  tags: ['sort', 'order lines', 'alphabetize', 'shuffle', 'natural sort', 'numeric sort'],
  aliases: ['sort', 'sort -n', 'sort -V', 'shuf'],
  examples: [
    { title: 'alphabetical', input: 'banana\napple\ncherry', output: 'apple\nbanana\ncherry' },
    { title: 'natural (v2 before v10)', input: 'v2\nv10\nv1', params: { mode: 'natural' }, output: 'v1\nv2\nv10' }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['alphabetical', 'numeric', 'natural', 'length', 'column', 'random'],
      default: 'alphabetical'
    },
    direction: { kind: 'select', label: 'direction', options: ['asc', 'desc'], default: 'asc' },
    caseSensitive: { kind: 'boolean', label: 'case sensitive', default: false },
    unique: { kind: 'boolean', label: 'remove duplicates', default: false },
    column: { kind: 'number', label: 'column (1-based, column mode)', default: 1, min: 1, integer: true },
    separator: { kind: 'string', label: 'column separator (blank = whitespace)', default: '' },
    seed: { kind: 'number', label: 'random seed (0 = unseeded)', default: 0 }
  },
  apply: (input: any, params: any) => {
    const {
      mode = 'alphabetical',
      direction = 'asc',
      caseSensitive = false,
      unique = false,
      column = 1,
      separator = '',
      seed = 0
    } = params ?? {}

    const s = String(input)
    // keep CR out of comparisons and don't sort the empty string after a
    // trailing newline to the top; both are restored on output
    const nl = s.includes('\r\n') ? '\r\n' : '\n'
    const trailing = /\r?\n$/.exec(s)
    const body = trailing ? s.slice(0, s.length - trailing[0].length) : s
    let lines = body.split(/\r?\n/)

    const fold = (v: string) => (caseSensitive ? v : v.toLowerCase())
    const textCmp: Cmp = caseSensitive
      ? (a, b) => (a < b ? -1 : a > b ? 1 : 0)
      : (a, b) => fold(a).localeCompare(fold(b))

    if (unique) {
      const seen = new Set<string>()
      lines = lines.filter((l) => {
        const key = fold(l)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }

    if (mode === 'random') {
      const rand = seed ? mulberry32(seed) : Math.random
      for (let i = lines.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[lines[i], lines[j]] = [lines[j], lines[i]]
      }
      // a shuffle has no direction; `desc` would just re-order the shuffle
      return lines.join(nl) + (trailing ? nl : '')
    }

    let cmp: Cmp
    switch (mode) {
      case 'numeric':
        cmp = (a, b) => {
          const na = leadingNumber(a)
          const nb = leadingNumber(b)
          const aNaN = Number.isNaN(na)
          const bNaN = Number.isNaN(nb)
          // non-numeric lines sort last, then among themselves by text
          if (aNaN && bNaN) return textCmp(a, b)
          if (aNaN) return 1
          if (bNaN) return -1
          return na === nb ? textCmp(a, b) : na - nb
        }
        break
      case 'natural':
        cmp = (a, b) => naturalCompare(fold(a), fold(b))
        break
      case 'length':
        cmp = (a, b) => ([...a].length - [...b].length) || textCmp(a, b)
        break
      case 'column':
        cmp = (a, b) => {
          const fa = fieldOf(a, column, separator)
          const fb = fieldOf(b, column, separator)
          const na = leadingNumber(fa)
          const nb = leadingNumber(fb)
          if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb
          return textCmp(fa, fb) || textCmp(a, b)
        }
        break
      default:
        cmp = textCmp
    }

    lines.sort(cmp)
    if (direction === 'desc') lines.reverse()
    return lines.join(nl) + (trailing ? nl : '')
  }
}
export default util
