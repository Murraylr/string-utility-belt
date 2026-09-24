import type { Utility } from '@/types/utility'

/**
 * Turn a source-code string literal back into plain text: the inverse of
 * code_string_escape. Surrounding quotes are stripped when present, then the
 * body is decoded according to the language:
 *
 *  - json                    strict: only " \ / b f n r t and \uXXXX are legal,
 *                            anything else is an error.
 *  - go with backticks       raw string literal, nothing is decoded.
 *  - sql                     no backslash escapes; a doubled delimiter is one
 *                            delimiter character.
 *  - php / ruby with '...'   only \\ and \' mean anything.
 *  - everything else         \n \r \t \b \f \v \a \e \0, \NNN octal, \xNN,
 *                            \uNNNN (surrogate pairs recombine), \u{...},
 *                            \UNNNNNNNN, and backslash-newline continuations.
 */

type Lang = 'javascript' | 'json' | 'c' | 'java' | 'python' | 'go' | 'csharp' | 'php' | 'ruby' | 'sql'

const LANGUAGES: string[] = ['javascript', 'json', 'c', 'java', 'python', 'go', 'csharp', 'php', 'ruby', 'sql']
// Languages that keep an unrecognised escape as backslash + character. Ruby is
// NOT one of them: `"\q"` is just "q" there, the same as C, Java, JS and C#.
const KEEPS_UNKNOWN_ESCAPES = new Set<string>(['python', 'php'])

const BEL = String.fromCharCode(7)
const BS = String.fromCharCode(8)
const VT = String.fromCharCode(11)
const FF = String.fromCharCode(12)
const ESC = String.fromCharCode(27)

const HEX_RE = /^[0-9a-fA-F]+$/
const OCTAL_RE = /^[0-7]$/

const SIMPLE = new Map<string, string>([
  ['n', '\n'], ['r', '\r'], ['t', '\t'], ['b', BS], ['f', FF], ['v', VT], ['a', BEL], ['e', ESC],
  ['\\', '\\'], ['"', '"'], ["'", "'"], ['`', '`'], ['/', '/'], ['$', '$'], ['#', '#'], ['?', '?'], [' ', ' ']
])

const JSON_SIMPLE = new Map<string, string>([
  ['"', '"'], ['\\', '\\'], ['/', '/'], ['b', BS], ['f', FF], ['n', '\n'], ['r', '\r'], ['t', '\t']
])

const readHex = (s: string, start: number, count: number, label: string) => {
  const chunk = s.slice(start, start + count)
  if (chunk.length < count || !HEX_RE.test(chunk)) {
    throw new Error(`invalid ${label} escape sequence at offset ${start - 2}`)
  }
  return parseInt(chunk, 16)
}

const fromCodePoint = (value: number, label: string) => {
  if (value > 0x10ffff) throw new Error(`${label} escape is beyond the Unicode range (U+10FFFF)`)
  return String.fromCodePoint(value)
}

const decodeEscapes = (body: string, lang: Lang) => {
  let out = ''
  let i = 0
  while (i < body.length) {
    const ch = body[i]
    if (ch !== '\\') { out += ch; i++; continue }
    if (i + 1 >= body.length) throw new Error('trailing backslash: incomplete escape sequence')
    const e = body[i + 1]
    i += 2

    if (lang === 'json') {
      if (e === 'u') {
        out += String.fromCharCode(readHex(body, i, 4, '\\u'))
        i += 4
        continue
      }
      const mapped = JSON_SIMPLE.get(e)
      if (mapped === undefined) throw new Error(`invalid JSON escape sequence: \\${e}`)
      out += mapped
      continue
    }

    if (e === 'u') {
      if (body[i] === '{') {
        const close = body.indexOf('}', i + 1)
        if (close === -1) throw new Error('unterminated \\u{...} escape sequence')
        const digits = body.slice(i + 1, close)
        if (!digits || !HEX_RE.test(digits)) throw new Error(`invalid \\u{${digits}} escape sequence`)
        out += fromCodePoint(parseInt(digits, 16), '\\u{...}')
        i = close + 1
        continue
      }
      // Lone surrogates recombine naturally because JS strings are UTF-16.
      out += String.fromCharCode(readHex(body, i, 4, '\\u'))
      i += 4
      continue
    }

    if (e === 'U') {
      out += fromCodePoint(readHex(body, i, 8, '\\U'), '\\U')
      i += 8
      continue
    }

    if (e === 'x') {
      let digits = ''
      while (digits.length < 2 && i < body.length && HEX_RE.test(body[i])) { digits += body[i]; i++ }
      if (!digits) throw new Error('invalid \\x escape sequence: expected hex digits')
      out += String.fromCharCode(parseInt(digits, 16))
      continue
    }

    if (OCTAL_RE.test(e)) {
      let digits = e
      while (digits.length < 3 && i < body.length && OCTAL_RE.test(body[i])) { digits += body[i]; i++ }
      const value = parseInt(digits, 8)
      if (value > 0xff) throw new Error(`octal escape \\${digits} is out of range`)
      out += String.fromCharCode(value)
      continue
    }

    // Backslash before a real line break is a line continuation.
    if (e === '\n') continue
    if (e === '\r') { if (body[i] === '\n') i++; continue }

    const mapped = SIMPLE.get(e)
    if (mapped !== undefined) { out += mapped; continue }
    out += KEEPS_UNKNOWN_ESCAPES.has(lang) ? `\\${e}` : e
  }
  return out
}

const decodeMinimal = (body: string) => {
  let out = ''
  let i = 0
  while (i < body.length) {
    if (body[i] === '\\' && (body[i + 1] === '\\' || body[i + 1] === "'")) {
      out += body[i + 1]
      i += 2
      continue
    }
    out += body[i]
    i++
  }
  return out
}

const util: Utility = {
  id: 'code_string_unescape',
  name: 'code string unescape',
  category: 'Decoding',
  description:
    'Decode a source string literal back to plain text, handling \\n, \\t, \\xNN, \\uNNNN, \\u{...}, \\UNNNNNNNN, octal and line continuations, and stripping surrounding quotes.',
  accepts: 'string',
  produces: 'string',
  params: {
    language: {
      kind: 'select',
      label: 'language',
      options: ['javascript', 'json', 'c', 'java', 'python', 'go', 'csharp', 'php', 'ruby', 'sql'],
      default: 'javascript'
    }
  },
  tags: ['unescape', 'string literal', 'escape sequences', 'source code', 'quotes'],
  examples: [
    {
      title: 'escape sequences',
      input: '"hello\\nworld\\t!"',
      output: 'hello\nworld\t!'
    },
    {
      title: 'python single-quoted literal',
      input: "'it\\\\'s'",
      params: { language: 'python' },
      output: "it\\'s"
    }
  ],
  apply: (input: any, { language = 'javascript' }: any) => {
    const raw = String(input ?? '')
    if (raw === '') return ''
    const lang = (LANGUAGES.indexOf(String(language)) === -1 ? 'javascript' : String(language)) as Lang

    // Strip a matching pair of surrounding quotes, if the input has them.
    let body = raw
    let quoteChar = ''
    const first = raw[0]
    if (raw.length >= 2 && (first === '"' || first === "'" || first === '`') && raw[raw.length - 1] === first) {
      quoteChar = first
      body = raw.slice(1, -1)
    }
    if (body === '') return ''

    // Go raw string literals contain no escapes.
    if (lang === 'go' && quoteChar === '`') return body
    // SQL doubles the delimiter instead of using backslashes.
    if (lang === 'sql') {
      const delimiter = quoteChar || "'"
      return body.split(delimiter + delimiter).join(delimiter)
    }
    // Single-quoted PHP and Ruby strings only understand \\ and \'.
    if ((lang === 'php' || lang === 'ruby') && quoteChar === "'") return decodeMinimal(body)

    return decodeEscapes(body, lang)
  }
}

export default util
