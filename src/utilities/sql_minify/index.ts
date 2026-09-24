import type { Utility } from '@/types/utility'

/**
 * Characters that never want a separator space in front of them.
 * All three are unambiguously safe to tighten in every SQL dialect.
 */
const NO_SPACE_BEFORE = new Set([',', ';', ')'])
/** Characters after which a separator space is never needed. */
const NO_SPACE_AFTER = new Set(['('])

/** 1-based line number of `index` within `source` (for error messages). */
const lineAt = (source: string, index: number): number => {
  let line = 1
  for (let i = 0; i < index && i < source.length; i++) if (source[i] === '\n') line++
  return line
}

/**
 * Scan forward from an opening quote at `start` and return the index just past
 * the closing quote. Doubled quotes (`''`, `""`, ``` `` ```) are escapes, which
 * is the ANSI rule and also what MySQL/Postgres accept. Backslash escapes are
 * deliberately NOT honoured: in standard SQL `'C:\'` is a complete literal.
 */
const scanQuoted = (source: string, start: number, quote: string): number => {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] !== quote) continue
    if (source[i + 1] === quote) {
      i++
      continue
    }
    return i + 1
  }
  return -1
}

/**
 * Scan a T-SQL bracket identifier from `[` at `start` and return the index just
 * past its closing `]`. `]]` is the escape for a literal `]`, so `[a]] b]` is
 * ONE identifier — stopping at the first `]` would let the whitespace collapser
 * rewrite the rest of the name.
 */
const scanBracket = (source: string, start: number): number => {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] !== ']') continue
    if (source[i + 1] === ']') {
      i++
      continue
    }
    return i + 1
  }
  return -1
}

/** Match a Postgres dollar-quote tag (`$$` or `$tag$`) at `start`. */
const dollarTagAt = (source: string, start: number): string | null => {
  if (source[start] !== '$') return null
  let i = start + 1
  while (i < source.length && /[A-Za-z0-9_\u0080-\uFFFF]/.test(source[i])) {
    // A tag may not start with a digit — `$1` is a bind parameter, not a quote.
    if (i === start + 1 && /[0-9]/.test(source[i])) return null
    i++
  }
  return source[i] === '$' ? source.slice(start, i + 1) : null
}

const util: Utility = {
  id: 'sql_minify',
  name: 'sql minify',
  category: 'Formatting',
  description:
    'Collapse a SQL query onto one line, optionally stripping -- and /* */ comments or keeping a line break after each semicolon.',
  accepts: 'string',
  produces: 'string',
  tags: ['sql minify', 'compress sql', 'one-line sql', 'strip comments'],
  examples: [
    {
      title: 'strip comments and collapse',
      input: 'SELECT a, b\nFROM t -- comment\nWHERE a = 1;',
      output: 'SELECT a, b FROM t WHERE a = 1;'
    }
  ],
  params: {
    removeComments: { kind: 'boolean', label: 'remove comments', default: true },
    semicolonNewline: { kind: 'boolean', label: 'newline after each ;', default: false }
  },
  apply: (input: any, params: any) => {
    const source = String(input ?? '')
    if (source.trim() === '') return ''

    const removeComments = params?.removeComments !== false
    const semicolonNewline = params?.semicolonNewline === true

    let out = ''
    // `needSpace`: whitespace/comment was skipped, so a separator may be due.
    // `suppressSpace`: we are at a position where a leading space is unwanted.
    let needSpace = false
    let suppressSpace = true

    const emit = (text: string) => {
      if (needSpace && !suppressSpace) out += ' '
      needSpace = false
      suppressSpace = false
      out += text
    }
    const emitLineBreak = () => {
      out += '\n'
      needSpace = false
      suppressSpace = true
    }

    let i = 0
    while (i < source.length) {
      const ch = source[i]

      // --- whitespace ------------------------------------------------------
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v') {
        needSpace = true
        i++
        continue
      }

      // --- line comment ----------------------------------------------------
      if (ch === '-' && source[i + 1] === '-') {
        let end = source.indexOf('\n', i)
        if (end === -1) end = source.length
        if (!removeComments) {
          emit(source.slice(i, end).replace(/\r$/, ''))
          // A kept `--` comment runs to end of line, so the break is mandatory.
          emitLineBreak()
        } else {
          needSpace = true
        }
        i = end
        continue
      }

      // --- block comment ---------------------------------------------------
      if (ch === '/' && source[i + 1] === '*') {
        const close = source.indexOf('*/', i + 2)
        if (close === -1) {
          throw new Error(`unterminated block comment starting at line ${lineAt(source, i)}`)
        }
        if (!removeComments) emit(source.slice(i, close + 2))
        else needSpace = true
        i = close + 2
        continue
      }

      // --- quoted literals and identifiers ---------------------------------
      if (ch === "'" || ch === '"' || ch === '`') {
        const end = scanQuoted(source, i, ch)
        if (end === -1) {
          const what = ch === "'" ? 'string literal' : 'quoted identifier'
          throw new Error(`unterminated ${what} (${ch}) starting at line ${lineAt(source, i)}`)
        }
        emit(source.slice(i, end))
        i = end
        continue
      }

      // --- postgres dollar-quoted body -------------------------------------
      if (ch === '$') {
        const tag = dollarTagAt(source, i)
        if (tag) {
          const close = source.indexOf(tag, i + tag.length)
          if (close === -1) {
            throw new Error(
              `unterminated dollar-quoted string (${tag}) starting at line ${lineAt(source, i)}`
            )
          }
          emit(source.slice(i, close + tag.length))
          i = close + tag.length
          continue
        }
      }

      // --- T-SQL bracket identifier (non-fatal: a lone '[' stays literal) ---
      if (ch === '[') {
        const end = scanBracket(source, i)
        if (end !== -1 && !/[\n\r]/.test(source.slice(i, end))) {
          emit(source.slice(i, end))
          i = end
          continue
        }
      }

      // --- ordinary character ----------------------------------------------
      if (NO_SPACE_BEFORE.has(ch)) needSpace = false
      emit(ch)
      if (ch === ';' && semicolonNewline) emitLineBreak()
      else if (NO_SPACE_AFTER.has(ch)) suppressSpace = true
      i++
    }

    // A trailing `;` line break (or a trailing kept comment) leaves one newline.
    // Nothing else can be trimmed away: separator spaces are only ever written
    // immediately before a token, so preserved literals stay byte-for-byte.
    return out.trim()
  }
}

export default util
