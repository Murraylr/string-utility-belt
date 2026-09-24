import type { Utility } from '@/types/utility'

type QuoteStyle = 'none' | 'double' | 'literal'

const pickBool = (v: unknown, fallback: boolean): boolean => {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

const pickNumber = (v: unknown, fallback: number): number => {
  if (v === undefined || v === null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const CANONICAL_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/
const INTEGER = /^-?\d+$/

/**
 * Prototype-less maps: a variable literally named `__proto__` must be stored as
 * plain data (a normal object silently ignores the assignment).
 */
const table = <T>(): Record<string, T> => Object.create(null) as Record<string, T>

const coerce = (value: string): unknown => {
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (CANONICAL_NUMBER.test(value)) {
    const n = Number(value)
    if (!Number.isFinite(n)) return value
    // Long ids (snowflakes, account numbers) would silently lose digits — keep them as text.
    if (INTEGER.test(value) && !Number.isSafeInteger(n)) return value
    return n
  }
  return value
}

/** `\$` is left intact here so `expand` can still tell it apart from a real reference. */
const unescapeDoubleQuoted = (raw: string): string =>
  raw.replace(/\\(u\{[0-9a-fA-F]{1,6}\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (match, seq: string) => {
    if (seq.startsWith('u{')) {
      const cp = Number.parseInt(seq.slice(2, -1), 16)
      return cp <= 0x10ffff ? String.fromCodePoint(cp) : match
    }
    if (seq[0] === 'u' || seq[0] === 'x') return String.fromCharCode(Number.parseInt(seq.slice(1), 16))
    switch (seq) {
      case 'n':
        return '\n'
      case 'r':
        return '\r'
      case 't':
        return '\t'
      case 'b':
        return '\b'
      case 'f':
        return '\f'
      case 'v':
        return '\v'
      case '0':
        return '\0'
      case '\\':
        return '\\'
      case '"':
        return '"'
      case "'":
        return "'"
      case '`':
        return '`'
      default:
        // unknown escape (including `\$`): keep it verbatim rather than losing data
        return match
    }
  })

/** Index of an inline `#` comment in an unquoted value, or -1. */
const inlineCommentIndex = (value: string): number => {
  for (let i = 0; i < value.length; i++) {
    if (value[i] !== '#') continue
    if (i === 0 || /\s/.test(value[i - 1])) return i
  }
  return -1
}

const VAR_PATTERN = /\\\$|\$\{([^}]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g

const expandValue = (
  value: string,
  values: Record<string, string>,
  styles: Record<string, QuoteStyle>,
  seen: Set<string>
): string =>
  value.replace(VAR_PATTERN, (match: string, braced: string | undefined, bare: string | undefined) => {
    if (match === '\\$') return '$'
    let name = braced ?? bare ?? ''
    let fallback = ''
    let hasFallback = false
    if (braced !== undefined) {
      const colonDash = braced.indexOf(':-')
      const dash = braced.indexOf('-')
      if (colonDash >= 0) {
        name = braced.slice(0, colonDash)
        fallback = braced.slice(colonDash + 2)
        hasFallback = true
      } else if (dash > 0) {
        name = braced.slice(0, dash)
        fallback = braced.slice(dash + 1)
        hasFallback = true
      }
    }
    name = name.trim()
    if (name === '' || !Object.prototype.hasOwnProperty.call(values, name)) {
      return hasFallback ? fallback : ''
    }
    if (seen.has(name)) throw new Error(`circular variable reference: ${name}`)
    const raw = values[name]
    const resolved =
      styles[name] === 'literal'
        ? raw
        : (() => {
            seen.add(name)
            const out = expandValue(raw, values, styles, seen)
            seen.delete(name)
            return out
          })()
    return resolved === '' && hasFallback ? fallback : resolved
  })

const util: Utility = {
  id: 'env_to_json',
  name: '.env to json',
  category: 'Data Formats',
  description:
    'Parse a .env file into JSON, handling export prefixes, comments, single, double and backtick quoted (including multi-line) values and escapes, with optional ${VAR} expansion, value typing and a configurable indent.',
  accepts: 'string',
  produces: 'string',
  tags: ['dotenv', 'env file', 'config', 'environment variables', 'parse', 'variable expansion'],
  aliases: ['dotenv'],
  examples: [
    {
      title: 'comments, export prefix, quoted value',
      input: 'PORT=3000\nDEBUG=true\n# comment\nexport NAME="Ada Lovelace"',
      output: '{\n  "PORT": "3000",\n  "DEBUG": "true",\n  "NAME": "Ada Lovelace"\n}'
    },
    {
      title: '${VAR} expansion',
      input: 'HOST=localhost\nURL=http://${HOST}:8080/api',
      params: { expand: true },
      output: '{\n  "HOST": "localhost",\n  "URL": "http://localhost:8080/api"\n}'
    },
    {
      title: 'typed values',
      input: 'COUNT=42\nENABLED=true',
      params: { typed: true },
      output: '{\n  "COUNT": 42,\n  "ENABLED": true\n}'
    }
  ],
  params: {
    typed: { kind: 'boolean', label: 'coerce numbers/booleans', default: false },
    expand: { kind: 'boolean', label: 'expand ${VAR}', default: false },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, params: any) => {
    const typed = pickBool(params?.typed, false)
    const expand = pickBool(params?.expand, false)
    const indent = Math.max(0, Math.min(10, Math.floor(pickNumber(params?.indent, 2))))

    const text = String(input ?? '')
    if (text.trim() === '') return JSON.stringify({}, null, indent)

    const lines = text.split(/\r\n|\r|\n/)
    const values = table<string>()
    const styles = table<QuoteStyle>()
    const order: string[] = []

    let i = 0
    while (i < lines.length) {
      const lineNumber = i + 1
      const line = lines[i]
      i++
      const trimmed = line.trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue

      const withoutExport = trimmed.replace(/^export[ \t]+/, '')
      const eq = withoutExport.indexOf('=')
      if (eq < 0) {
        throw new Error(`invalid .env line ${lineNumber}: expected KEY=value`)
      }
      const key = withoutExport.slice(0, eq).trim()
      if (key === '') throw new Error(`invalid .env line ${lineNumber}: missing key`)
      if (/[\s"'`]/.test(key)) {
        throw new Error(`invalid .env line ${lineNumber}: bad key "${key}"`)
      }

      const rest = withoutExport.slice(eq + 1).replace(/^[ \t]+/, '')
      const quote = rest[0]
      let value: string
      let style: QuoteStyle

      if (quote === '"' || quote === "'" || quote === '`') {
        let body = ''
        let current = rest
        let cursor = 1
        let closed = false
        for (;;) {
          while (cursor < current.length) {
            const ch = current[cursor]
            if (quote === '"' && ch === '\\' && cursor + 1 < current.length) {
              body += ch + current[cursor + 1]
              cursor += 2
              continue
            }
            if (ch === quote) {
              closed = true
              break
            }
            body += ch
            cursor++
          }
          if (closed) break
          if (i >= lines.length) {
            throw new Error(`invalid .env line ${lineNumber}: unterminated ${quote} quoted value`)
          }
          body += '\n'
          current = lines[i]
          i++
          cursor = 0
        }
        value = quote === '"' ? unescapeDoubleQuoted(body) : body
        style = quote === '"' ? 'double' : 'literal'
      } else {
        const comment = inlineCommentIndex(rest)
        value = (comment >= 0 ? rest.slice(0, comment) : rest).trim()
        style = 'none'
      }

      if (!Object.prototype.hasOwnProperty.call(values, key)) order.push(key)
      values[key] = value
      styles[key] = style
    }

    const out = table<unknown>()
    for (const key of order) {
      let value = values[key]
      if (styles[key] !== 'literal') {
        value = expand
          ? expandValue(value, values, styles, new Set([key]))
          : value.replace(/\\\$/g, '$')
      }
      out[key] = typed && styles[key] === 'none' ? coerce(value) : value
    }

    return JSON.stringify(out, null, indent)
  }
}

export default util
