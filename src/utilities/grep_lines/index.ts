import type { Utility } from '@/types/utility'

/** Escape a literal so it can be embedded in a RegExp source. */
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Word characters for `wholeWord`, unicode-aware (not JS `\w`, which is ASCII-only). */
const WORD = /[\p{L}\p{N}_]/u

/** The full code point ending at `i`, so an astral char is never seen as half a surrogate pair. */
function codePointBefore(s: string, i: number): string | undefined {
  if (i <= 0) return undefined
  const c = s.charCodeAt(i - 1)
  if (c >= 0xdc00 && c <= 0xdfff && i >= 2) {
    const p = s.charCodeAt(i - 2)
    if (p >= 0xd800 && p <= 0xdbff) return s.slice(i - 2, i)
  }
  return s[i - 1]
}

/** The full code point starting at `i`. */
function codePointAt(s: string, i: number): string | undefined {
  if (i >= s.length) return undefined
  const cp = s.codePointAt(i)
  return cp === undefined ? undefined : String.fromCodePoint(cp)
}

const isWordChar = (ch: string | undefined) => ch !== undefined && WORD.test(ch)

/**
 * Split into lines while remembering the exact terminator that followed each one, so a file
 * with mixed endings is not silently rewritten to a single style. `eols[i]` is `''` only for a
 * final line that the input left unterminated; `trailing` says whether the input ended with a
 * newline at all.
 */
function splitLines(s: string): { lines: string[]; eols: string[]; trailing: boolean } {
  const lines: string[] = []
  const eols: string[] = []
  const re = /\r\n|\n/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    lines.push(s.slice(last, m.index))
    eols.push(m[0])
    last = re.lastIndex
  }
  if (last < s.length) {
    lines.push(s.slice(last))
    eols.push('')
    return { lines, eols, trailing: false }
  }
  return { lines, eols, trailing: lines.length > 0 }
}

/**
 * Build a line predicate. `wholeWord` is checked against the surrounding text rather than
 * by rewriting the pattern, so it works identically for literal and regex searches.
 */
function buildMatcher(
  pattern: string,
  regex: boolean,
  ignoreCase: boolean,
  wholeWord: boolean
): (line: string) => boolean {
  const source = regex ? pattern : escapeRegExp(pattern)
  let re: RegExp
  try {
    re = new RegExp(source, ignoreCase ? 'gi' : 'g')
  } catch (err) {
    throw new Error(`invalid regular expression: ${(err as Error).message}`)
  }
  return (line: string) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      const len = m[0].length
      if (len === 0) {
        // a zero-length match is never a whole word, and would spin forever without a nudge
        re.lastIndex += 1
        if (!wholeWord) return true
        if (re.lastIndex > line.length) break
        continue
      }
      if (!wholeWord) return true
      if (
        !isWordChar(codePointBefore(line, m.index)) &&
        !isWordChar(codePointAt(line, m.index + len))
      ) {
        return true
      }
    }
    return false
  }
}

const util: Utility = {
  id: 'grep_lines',
  name: 'grep lines',
  category: 'Lines',
  description:
    'Keep only the lines matching a substring or regular expression, with invert, whole-word, ignore-case, surrounding context lines and grep-style line numbers.',
  accepts: 'string',
  produces: 'string',
  params: {
    pattern: { kind: 'string', label: 'pattern (blank = match every line)', default: '' },
    regex: { kind: 'boolean', label: 'regular expression', default: false },
    invert: { kind: 'boolean', label: 'invert match', default: false },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: false },
    wholeWord: { kind: 'boolean', label: 'whole word', default: false },
    context: { kind: 'number', label: 'context lines', default: 0, min: 0, integer: true, max: 1000 },
    lineNumbers: { kind: 'boolean', label: 'line numbers', default: false }
  },
  tags: ['grep', 'search lines', 'pattern match', 'regex filter', 'line search', 'filter'],
  aliases: ['grep'],
  examples: [
    { title: 'substring match', input: 'apple\nbanana\ncherry\ndate', params: { pattern: 'an' }, output: 'banana' },
    {
      title: 'regex with line numbers',
      input: 'foo\nbar\nfoobar\nbaz',
      params: { pattern: '^foo', regex: true, lineNumbers: true },
      output: '1:foo\n3:foobar'
    }
  ],
  apply: (input: any, params: any) => {
    const {
      pattern = '',
      regex = false,
      invert = false,
      ignoreCase = false,
      wholeWord = false,
      context = 0,
      lineNumbers = false
    } = params ?? {}

    const s = String(input)
    if (s === '') return ''

    const rawContext = Number(context)
    if (!Number.isFinite(rawContext)) throw new Error('context must be a finite number')
    const ctx = Math.max(0, Math.trunc(rawContext))

    const { lines, eols, trailing } = splitLines(s)

    // an empty pattern matches every line (like `grep ''`) — keeps the freshly added step a no-op
    const matcher =
      String(pattern) === ''
        ? () => true
        : buildMatcher(String(pattern), !!regex, !!ignoreCase, !!wholeWord)

    const hits = new Set<number>()
    const keep = new Set<number>()
    for (let i = 0; i < lines.length; i++) {
      const hit = invert ? !matcher(lines[i]) : matcher(lines[i])
      if (!hit) continue
      hits.add(i)
      for (let j = Math.max(0, i - ctx); j <= Math.min(lines.length - 1, i + ctx); j++) keep.add(j)
    }

    const indices = [...keep].sort((a, b) => a - b)
    if (indices.length === 0) return ''

    const out: string[] = []
    let prev = -1
    for (const i of indices) {
      // grep prints `--` between non-adjacent context groups
      if (ctx > 0 && prev !== -1 && i > prev + 1) out.push('--' + (eols[prev] || eols[i] || '\n'))
      const prefix = lineNumbers ? `${i + 1}${hits.has(i) ? ':' : '-'}` : ''
      // each line keeps the terminator it arrived with, so mixed endings survive untouched
      out.push(prefix + lines[i] + eols[i])
      prev = i
    }

    const text = out.join('')
    // the output ends with a newline only if the input did
    return trailing ? text : text.replace(/\r\n$|\n$/, '')
  }
}

export default util
