import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * A hand-rolled JSON5 / JSONC reader.
 *
 * Rather than "strip comments with a regex then JSON.parse" (which
 * corrupts any string containing `//` or a trailing comma) this is a
 * proper recursive-descent parser, so string contents are always safe.
 * ------------------------------------------------------------------ */

const LS = '\u2028'
const PS = '\u2029'

const IDENT_START = /[\p{ID_Start}$_]/u
const IDENT_PART = /[\p{ID_Continue}$_\u200c\u200d]/u
const NUMBER_RE =
  /[+-]?(?:0[xX][0-9a-fA-F]+|Infinity|NaN|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/y

const clampIndent = (v: unknown, fallback = 2): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(10, Math.max(0, Math.floor(n)))
}

function lineCol(src: string, idx: number): { line: number; column: number } {
  let line = 1
  let column = 1
  const stop = Math.max(0, Math.min(idx, src.length))
  for (let k = 0; k < stop; k++) {
    const c = src.charCodeAt(k)
    if (c === 10 || (c === 13 && src.charCodeAt(k + 1) !== 10)) {
      line++
      column = 1
    } else {
      column++
    }
  }
  return { line, column }
}

/** Always throws — declared `never` so callers type-check as unreachable. */
function fail(src: string, msg: string, at: number): never {
  const { line, column } = lineCol(src, at)
  throw new Error(`json5: ${msg} (line ${line}, column ${column})`)
}

function hexDigit(ch: string | undefined): number {
  if (ch === undefined) return -1
  const c = ch.charCodeAt(0)
  if (c >= 48 && c <= 57) return c - 48
  if (c >= 97 && c <= 102) return c - 87
  if (c >= 65 && c <= 70) return c - 55
  return -1
}

/** Assign without letting a `__proto__` key mutate the prototype chain. */
function setKey(obj: Record<string, unknown>, key: string, value: unknown): void {
  if (key === '__proto__') {
    Object.defineProperty(obj, key, {
      value,
      enumerable: true,
      writable: true,
      configurable: true
    })
  } else {
    obj[key] = value
  }
}

export type Json5Result = { empty: boolean; value: unknown }

export function parseJson5(src: string): Json5Result {
  const n = src.length
  let i = 0

  const skipWs = (): void => {
    for (;;) {
      while (i < n && /\s/.test(src[i])) i++
      if (src[i] === '/' && src[i + 1] === '/') {
        i += 2
        while (
          i < n &&
          src[i] !== '\n' &&
          src[i] !== '\r' &&
          src[i] !== LS &&
          src[i] !== PS
        ) {
          i++
        }
        continue
      }
      if (src[i] === '/' && src[i + 1] === '*') {
        const start = i
        i += 2
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i++
        if (i >= n) fail(src, 'unterminated block comment', start)
        i += 2
        continue
      }
      return
    }
  }

  const readHex = (len: number): number => {
    const start = i
    let v = 0
    for (let k = 0; k < len; k++) {
      const d = hexDigit(src[i])
      if (d < 0) fail(src, 'invalid hex escape', start)
      v = v * 16 + d
      i++
    }
    return v
  }

  const readEscape = (): string => {
    if (i >= n) fail(src, 'unterminated escape sequence', i)
    const c = src[i]
    i++
    switch (c) {
      case 'n':
        return '\n'
      case 't':
        return '\t'
      case 'r':
        return '\r'
      case 'b':
        return '\b'
      case 'f':
        return '\f'
      case 'v':
        return '\v'
      case '0': {
        const next = src[i]
        if (next !== undefined && next >= '0' && next <= '9') {
          fail(src, 'octal escapes are not allowed', i - 1)
        }
        return '\0'
      }
      case 'x':
        return String.fromCharCode(readHex(2))
      case 'u': {
        if (src[i] === '{') fail(src, '\\u{...} escapes are not valid JSON5', i - 1)
        return String.fromCharCode(readHex(4))
      }
      case '\r':
        if (src[i] === '\n') i++
        return ''
      case '\n':
      case LS:
      case PS:
        return ''
      default:
        if (c >= '1' && c <= '9') fail(src, 'octal escapes are not allowed', i - 1)
        return c
    }
  }

  const parseString = (): string => {
    const quote = src[i]
    const open = i
    i++
    let out = ''
    for (;;) {
      if (i >= n) fail(src, 'unterminated string', open)
      const c = src[i]
      if (c === quote) {
        i++
        return out
      }
      if (c === '\\') {
        i++
        out += readEscape()
        continue
      }
      if (c === '\n' || c === '\r') fail(src, 'unescaped newline in string', i)
      out += c
      i++
    }
  }

  const readIdent = (): string => {
    const start = i
    const first = src.codePointAt(i)
    if (first === undefined) fail(src, 'expected an object key', i)
    const fc = String.fromCodePoint(first)
    if (!IDENT_START.test(fc)) {
      fail(src, `unexpected ${JSON.stringify(fc)} where an object key was expected`, i)
    }
    i += fc.length
    while (i < n) {
      const cp = src.codePointAt(i)
      if (cp === undefined) break
      const ch = String.fromCodePoint(cp)
      if (!IDENT_PART.test(ch)) break
      i += ch.length
    }
    return src.slice(start, i)
  }

  const numberFromToken = (token: string): number => {
    let body = token
    let sign = 1
    if (body[0] === '+') body = body.slice(1)
    else if (body[0] === '-') {
      sign = -1
      body = body.slice(1)
    }
    if (body === 'Infinity') return sign * Infinity
    if (body === 'NaN') return NaN
    if (body[0] === '0' && (body[1] === 'x' || body[1] === 'X')) {
      return sign * parseInt(body.slice(2), 16)
    }
    return sign * Number(body)
  }

  const identFollows = (pos: number): boolean => {
    if (pos >= n) return false
    const cp = src.codePointAt(pos)
    if (cp === undefined) return false
    return IDENT_PART.test(String.fromCodePoint(cp))
  }

  const parsePrimitive = (): unknown => {
    const start = i
    if (src.startsWith('true', i) && !identFollows(i + 4)) {
      i += 4
      return true
    }
    if (src.startsWith('false', i) && !identFollows(i + 5)) {
      i += 5
      return false
    }
    if (src.startsWith('null', i) && !identFollows(i + 4)) {
      i += 4
      return null
    }
    NUMBER_RE.lastIndex = i
    const m = NUMBER_RE.exec(src)
    if (m && m[0].length > 0) {
      const token = m[0]
      // Neither JSON nor JSON5 allows a leading zero: `010` is a legacy octal
      // literal, so accepting it would silently pick 10 over 8.
      if (/^0\d/.test(token.replace(/^[+-]/, ''))) {
        fail(src, `"${token}" is not a valid number — numbers may not have a leading zero`, start)
      }
      i += token.length
      return numberFromToken(token)
    }
    const bad = src.codePointAt(i)
    const shown =
      bad === undefined ? 'end of input' : JSON.stringify(String.fromCodePoint(bad))
    return fail(src, `unexpected ${shown}`, start)
  }

  const parseArray = (): unknown[] => {
    const open = i
    i++
    const arr: unknown[] = []
    for (;;) {
      skipWs()
      if (i >= n) fail(src, 'unterminated array', open)
      if (src[i] === ']') {
        i++
        return arr
      }
      arr.push(parseValue())
      skipWs()
      if (i >= n) fail(src, 'unterminated array', open)
      if (src[i] === ',') {
        i++
        continue
      }
      if (src[i] === ']') {
        i++
        return arr
      }
      fail(src, "expected ',' or ']' in array", i)
    }
  }

  const parseObject = (): Record<string, unknown> => {
    const open = i
    i++
    const obj: Record<string, unknown> = {}
    for (;;) {
      skipWs()
      if (i >= n) fail(src, 'unterminated object', open)
      if (src[i] === '}') {
        i++
        return obj
      }
      const q = src[i]
      const key = q === '"' || q === "'" ? parseString() : readIdent()
      skipWs()
      if (src[i] !== ':') {
        fail(src, `expected ':' after object key ${JSON.stringify(key)}`, i)
      }
      i++
      setKey(obj, key, parseValue())
      skipWs()
      if (i >= n) fail(src, 'unterminated object', open)
      if (src[i] === ',') {
        i++
        continue
      }
      if (src[i] === '}') {
        i++
        return obj
      }
      fail(src, "expected ',' or '}' in object", i)
    }
  }

  function parseValue(): unknown {
    skipWs()
    if (i >= n) fail(src, 'unexpected end of input', i)
    const c = src[i]
    if (c === '{') return parseObject()
    if (c === '[') return parseArray()
    if (c === '"' || c === "'") return parseString()
    return parsePrimitive()
  }

  skipWs()
  if (i >= n) return { empty: true, value: undefined }
  const value = parseValue()
  skipWs()
  if (i < n) fail(src, 'unexpected trailing characters', i)
  return { empty: false, value }
}

const util: Utility = {
  id: 'json5_parse',
  name: 'json5 / jsonc parse',
  category: 'Data Formats',
  description:
    'Parse JSON5/JSONC — comments, trailing commas, single quotes, unquoted keys, hex and +/. numbers, Infinity and NaN — into strict JSON at the chosen indent.',
  accepts: 'string',
  produces: 'string',
  tags: ['json5', 'jsonc', 'comments', 'trailing comma', 'relaxed json', 'unquoted keys'],
  aliases: ['jsonc'],
  examples: [
    {
      title: 'comments, trailing comma, unquoted keys, single quotes',
      input: "{\n  // a comment\n  id: 1,\n  name: 'Ada',\n  tags: [1, 2,],\n}",
      output: '{\n  "id": 1,\n  "name": "Ada",\n  "tags": [\n    1,\n    2\n  ]\n}'
    }
  ],
  params: {
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, { indent }: any) => {
    const src = typeof input === 'string' ? input : String(input ?? '')
    if (src.trim() === '') return ''
    const parsed = parseJson5(src.replace(/^\uFEFF/, ''))
    if (parsed.empty) return ''
    const out = JSON.stringify(parsed.value, null, clampIndent(indent))
    return out === undefined ? 'null' : out
  }
}

export default util
