import type { Utility } from '@/types/utility'

type LinePart = { text: string; eol: string }

/** Split into lines while remembering each line's original terminator (LF / CRLF / CR). */
const splitLines = (s: string): LinePart[] => {
  const out: LinePart[] = []
  const re = /\r\n|\n|\r/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    out.push({ text: s.slice(last, m.index), eol: m[0] })
    last = re.lastIndex
  }
  out.push({ text: s.slice(last), eol: '' })
  return out
}

const isBlank = (line: string) => line.trim() === ''

const leadingWhitespace = (line: string) => line.match(/^[ \t]*/)?.[0] ?? ''

const numParam = (v: unknown, def: number, label: string) => {
  if (v === undefined || v === null || v === '') return def
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number`)
  return n
}

const boolParam = (v: unknown, def: boolean) => {
  if (v === undefined || v === null || v === '') return def
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

/** Longest common leading-whitespace prefix shared by every non-blank line. */
export const commonIndent = (lines: string[]): string => {
  let prefix: string | null = null
  for (const line of lines) {
    if (isBlank(line)) continue
    const lead = leadingWhitespace(line)
    if (prefix === null) {
      prefix = lead
      continue
    }
    let i = 0
    while (i < prefix.length && i < lead.length && prefix[i] === lead[i]) i++
    prefix = prefix.slice(0, i)
    if (prefix === '') break
  }
  return prefix ?? ''
}

const MODES = ['add', 'remove', 'auto-dedent']

const util: Utility = {
  id: 'indent',
  name: 'indent / dedent',
  category: 'Formatting',
  description:
    'Add or remove leading indentation on every line, or auto-dedent by stripping the common leading whitespace, using spaces or tabs.',
  accepts: 'string',
  produces: 'string',
  tags: ['dedent', 'indentation', 'whitespace', 'tabs', 'spaces', 'reindent'],
  aliases: ['textwrap.dedent'],
  examples: [
    { title: 'add two spaces', input: 'a\nb', params: { amount: 2, character: 'space' }, output: '  a\n  b' },
    { title: 'auto-dedent', input: '    a\n    b', params: { mode: 'auto-dedent' }, output: 'a\nb' }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: MODES,
      default: 'add'
    },
    amount: { kind: 'number', label: 'amount', default: 2, min: 0, integer: true, max: 64 },
    character: {
      kind: 'select',
      label: 'character',
      options: ['space', 'tab'],
      default: 'space'
    },
    skipBlank: { kind: 'boolean', label: 'skip blank lines', default: true }
  },
  apply: (input: any, params: any) => {
    const p = params || {}
    const s = input === undefined || input === null ? '' : String(input)
    const mode = (p.mode as string) || 'add'
    const amount = numParam(p.amount, 2, 'amount')
    const character = (p.character as string) || 'space'
    const skipBlank = boolParam(p.skipBlank, true)

    if (!MODES.includes(mode)) throw new Error(`unknown mode: ${mode}`)
    if (character !== 'space' && character !== 'tab') {
      throw new Error(`unknown character: ${character} (expected space or tab)`)
    }
    if (!Number.isInteger(amount) || amount < 0) {
      throw new Error('amount must be a whole number >= 0')
    }
    if (s === '') return ''

    const parts = splitLines(s)
    const lastIdx = parts.length - 1

    if (mode === 'auto-dedent') {
      const prefix = commonIndent(parts.map((part) => part.text))
      if (prefix === '') return s
      return parts
        .map(({ text, eol }) =>
          (text.startsWith(prefix) ? text.slice(prefix.length) : text.replace(/^[ \t]+/, '')) + eol
        )
        .join('')
    }

    const unit = character === 'tab' ? '\t' : ' '

    if (mode === 'remove') {
      return parts
        .map(({ text, eol }) => {
          if (skipBlank && isBlank(text)) return text + eol
          let n = 0
          while (n < amount && text[n] === unit) n++
          return text.slice(n) + eol
        })
        .join('')
    }

    const pad = unit.repeat(amount)
    return parts
      .map(({ text, eol }, i) => {
        // never indent the empty remainder that follows a trailing newline
        if (i === lastIdx && i > 0 && text === '') return text + eol
        if (skipBlank && isBlank(text)) return text + eol
        return pad + text + eol
      })
      .join('')
  }
}

export default util
