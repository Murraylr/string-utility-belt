import type { Utility } from '@/types/utility'

/**
 * Escape text so it can be pasted into a source file as a string literal.
 *
 * Per-language notes:
 *  - json    always double quoted; parses back to the input exactly like
 *            JSON.stringify() does (DEL is escaped as well, which is legal JSON
 *            but is the one place the two spellings differ).
 *  - c       control bytes use fixed 3-digit octal (`\0NN`) because C's `\x`
 *            escape is greedy and would swallow following hex digits.
 *  - csharp  control bytes use `\uXXXX` for the same reason.
 *  - go      a backtick quote means a raw string literal: no escaping at all.
 *  - php     `$` is always escaped so interpolation cannot fire; single-quoted
 *            PHP strings only understand `\\` and `\'`.
 *  - ruby    `#` is escaped before `{`, `$` and `@`; single-quoted Ruby strings
 *            only understand `\\` and `\'`.
 *  - sql     no backslash escapes at all — the delimiter is doubled instead.
 */

type Lang = 'javascript' | 'json' | 'c' | 'java' | 'python' | 'go' | 'csharp' | 'php' | 'ruby' | 'sql'
type QuoteName = 'double' | 'single' | 'backtick'

const LANGUAGES: string[] = ['javascript', 'json', 'c', 'java', 'python', 'go', 'csharp', 'php', 'ruby', 'sql']
const QUOTE_CHARS: Record<QuoteName, string> = { double: '"', single: "'", backtick: '`' }
// The only languages with a real backtick-delimited string form.
const BACKTICK_LANGUAGES = new Set<string>(['javascript', 'go', 'sql'])

const BEL = String.fromCharCode(7)
const BS = String.fromCharCode(8)
const VT = String.fromCharCode(11)
const FF = String.fromCharCode(12)
const ESC = String.fromCharCode(27)

const hex = (cp: number, width: number) => cp.toString(16).padStart(width, '0')

/** `\uXXXX`, using a surrogate pair for astral code points (JS / Java / JSON). */
const utf16Escape = (cp: number) => {
  if (cp <= 0xffff) return `\\u${hex(cp, 4)}`
  const v = cp - 0x10000
  return `\\u${hex(0xd800 + (v >> 10), 4)}\\u${hex(0xdc00 + (v & 0x3ff), 4)}`
}
/** `\uXXXX` / `\UXXXXXXXX` (C, Python, Go, C#). */
const wideEscape = (cp: number) => (cp > 0xffff ? `\\U${hex(cp, 8)}` : `\\u${hex(cp, 4)}`)
/** `\u{XXXX}` (PHP 7+, Ruby). */
const braceEscape = (cp: number) => `\\u{${hex(cp, 1)}}`

const hexByte = (cp: number) => `\\x${hex(cp, 2)}`
const uEscape = (cp: number) => `\\u${hex(cp, 4)}`
const octalByte = (cp: number) => `\\${cp.toString(8).padStart(3, '0')}`
// JS `\x` takes exactly two digits, so it is unambiguous below U+0100.
const jsControl = (cp: number) => (cp < 0x100 ? hexByte(cp) : uEscape(cp))

type Spec = {
  simple: Map<string, string>
  control: (cp: number) => string
  nonAscii: (cp: number) => string
}

const simpleMap = (extra: [string, string][]) =>
  new Map<string, string>([
    ['\\', '\\\\'],
    ['\n', '\\n'],
    ['\r', '\\r'],
    ['\t', '\\t'],
    ...extra
  ])

const SPECS: Record<string, Spec> = {
  javascript: {
    simple: simpleMap([[BS, '\\b'], [FF, '\\f'], [VT, '\\v']]),
    control: jsControl,
    nonAscii: utf16Escape
  },
  json: {
    simple: simpleMap([[BS, '\\b'], [FF, '\\f']]),
    control: uEscape,
    nonAscii: utf16Escape
  },
  c: {
    simple: simpleMap([[BS, '\\b'], [FF, '\\f'], [VT, '\\v'], [BEL, '\\a']]),
    control: octalByte,
    nonAscii: wideEscape
  },
  java: {
    simple: simpleMap([[BS, '\\b'], [FF, '\\f']]),
    control: uEscape,
    nonAscii: utf16Escape
  },
  python: {
    simple: simpleMap([[BS, '\\b'], [FF, '\\f'], [VT, '\\v'], [BEL, '\\a']]),
    control: hexByte,
    nonAscii: wideEscape
  },
  go: {
    simple: simpleMap([[BS, '\\b'], [FF, '\\f'], [VT, '\\v'], [BEL, '\\a']]),
    control: hexByte,
    nonAscii: wideEscape
  },
  csharp: {
    simple: simpleMap([[BS, '\\b'], [FF, '\\f'], [VT, '\\v'], [BEL, '\\a']]),
    control: uEscape,
    nonAscii: wideEscape
  },
  php: {
    simple: simpleMap([[FF, '\\f'], [VT, '\\v'], [ESC, '\\e'], ['$', '\\$']]),
    control: hexByte,
    nonAscii: braceEscape
  },
  ruby: {
    simple: simpleMap([[BS, '\\b'], [FF, '\\f'], [VT, '\\v'], [BEL, '\\a'], [ESC, '\\e']]),
    control: hexByte,
    nonAscii: braceEscape
  }
}

const escapeLiteral = (s: string, lang: Lang, quoteChar: string, escapeNonAscii: boolean) => {
  const spec = SPECS[lang]
  // Iterate code points so an emoji is escaped (or passed through) as a unit.
  const chars = Array.from(s)
  let out = ''
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    const next = chars[i + 1]
    const cp = ch.codePointAt(0) as number
    if (ch === quoteChar) { out += `\\${ch}`; continue }
    const simple = spec.simple.get(ch)
    if (simple !== undefined) { out += simple; continue }
    if (cp < 0x20 || cp === 0x7f) { out += spec.control(cp); continue }
    if (lang === 'javascript' && quoteChar === '`' && ch === '$' && next === '{') { out += '\\$'; continue }
    if (lang === 'ruby' && ch === '#' && (next === '{' || next === '$' || next === '@')) { out += '\\#'; continue }
    if (cp > 0x7f && escapeNonAscii) { out += spec.nonAscii(cp); continue }
    out += ch
  }
  return out
}

const util: Utility = {
  id: 'code_string_escape',
  name: 'code string escape',
  category: 'Encoding',
  description:
    'Escape text as a source string literal for JavaScript, JSON, C, Java, Python, Go, C#, PHP, Ruby, or SQL, with a chosen quote style, optional wrapping quotes, and optional escaping of non-ASCII characters.',
  accepts: 'string',
  produces: 'string',
  tags: ['escape', 'string literal', 'source code', 'quote', 'programming language'],
  examples: [
    {
      title: 'JavaScript, quoted',
      input: 'She said "hi"\nnew line',
      params: { language: 'javascript', wrap: true },
      output: '"She said \\"hi\\"\\nnew line"'
    },
    {
      title: 'Python, single-quoted',
      input: 'path\\to\\file',
      params: { language: 'python', quote: 'single', wrap: true },
      output: "'path\\\\to\\\\file'"
    }
  ],
  params: {
    language: {
      kind: 'select',
      label: 'language',
      options: ['javascript', 'json', 'c', 'java', 'python', 'go', 'csharp', 'php', 'ruby', 'sql'],
      default: 'javascript'
    },
    quote: {
      kind: 'select',
      label: 'quote style',
      options: ['double', 'single', 'backtick'],
      default: 'double'
    },
    wrap: {
      kind: 'boolean',
      label: 'wrap in quotes',
      default: false
    },
    escapeNonAscii: {
      kind: 'boolean',
      label: 'escape non-ascii',
      default: false
    }
  },
  apply: (input: any, { language = 'javascript', quote = 'double', wrap = false, escapeNonAscii = false }: any) => {
    const s = String(input ?? '')
    if (s === '') return ''

    const lang = (LANGUAGES.indexOf(String(language)) === -1 ? 'javascript' : String(language)) as Lang
    const quoteName = (Object.prototype.hasOwnProperty.call(QUOTE_CHARS, String(quote))
      ? String(quote)
      : 'double') as QuoteName
    if (quoteName === 'backtick' && !BACKTICK_LANGUAGES.has(lang)) {
      throw new Error(`${lang} has no backtick string literal — use the double or single quote style`)
    }
    // JSON string literals are always double quoted.
    const quoteChar = lang === 'json' ? '"' : QUOTE_CHARS[quoteName]

    // Go raw string literals contain no escapes whatsoever.
    if (lang === 'go' && quoteChar === '`') {
      if (s.indexOf('`') !== -1) throw new Error('a Go raw string literal cannot contain a backtick')
      if (s.indexOf('\r') !== -1) throw new Error('a Go raw string literal silently drops carriage returns')
      return wrap ? `\`${s}\`` : s
    }

    // SQL has no backslash escapes: the delimiter is doubled instead.
    if (lang === 'sql') {
      const body = s.split(quoteChar).join(quoteChar + quoteChar)
      return wrap ? `${quoteChar}${body}${quoteChar}` : body
    }

    // Single-quoted PHP and Ruby strings only understand \\ and \'.
    if ((lang === 'php' || lang === 'ruby') && quoteChar === "'") {
      const body = s.split('\\').join('\\\\').split("'").join("\\'")
      return wrap ? `'${body}'` : body
    }

    const body = escapeLiteral(s, lang, quoteChar, Boolean(escapeNonAscii))
    return wrap ? `${quoteChar}${body}${quoteChar}` : body
  }
}

export default util
