import type { Utility } from '@/types/utility'

type ValidationResult = {
  valid: boolean
  error: string | null
  line: number | null
  column: number | null
  excerpt: string | null
}

type PosError = Error & { at: number }

const posError = (message: string, at: number): PosError =>
  Object.assign(new Error(message), { at })

const isPosError = (e: unknown): e is PosError =>
  e instanceof Error && typeof (e as PosError).at === 'number'

function fail(message: string, at: number): never {
  throw posError(message, at)
}

/**
 * Hand-rolled scanner used purely to locate the first syntax error.
 * `lenient` accepts the JSON5-ish superset: comments, trailing commas,
 * single quotes, unquoted keys, hex/`+`/leading-dot numbers, Infinity/NaN.
 */
function scanJson(s: string, lenient: boolean): void {
  const len = s.length
  let i = 0

  const strictNumber = /-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/y
  const lenientNumber =
    /[+-]?(?:Infinity|NaN|0[xX][0-9a-fA-F]+|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)/y

  // Full code point, so an astral character is never reported as half a surrogate pair.
  function cpAt(at: number): string {
    const cp = s.codePointAt(at)
    return cp === undefined ? '' : String.fromCodePoint(cp)
  }

  function skipWs(): void {
    while (i < len) {
      const c = s[i]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue }
      if (lenient) {
        if (c === '/' && s[i + 1] === '/') {
          i += 2
          while (i < len && s[i] !== '\n') i++
          continue
        }
        if (c === '/' && s[i + 1] === '*') {
          const end = s.indexOf('*/', i + 2)
          if (end === -1) fail('unterminated block comment', i)
          i = end + 2
          continue
        }
        if (c === '\uFEFF' || /\s/.test(c)) { i++; continue }
      }
      break
    }
  }

  function parseString(quote: string): void {
    const start = i
    i++
    for (;;) {
      if (i >= len) fail('unterminated string', start)
      const c = s[i]
      if (c === quote) { i++; return }
      if (c === '\\') {
        const esc = i
        i++
        if (i >= len) fail('unterminated escape sequence', esc)
        const e = s[i]
        if (e === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(s.slice(i + 1, i + 5))) {
            fail('invalid \\u escape — expected four hex digits', esc)
          }
          i += 5
          continue
        }
        if (lenient && e === 'x') {
          if (!/^[0-9a-fA-F]{2}$/.test(s.slice(i + 1, i + 3))) {
            fail('invalid \\x escape — expected two hex digits', esc)
          }
          i += 3
          continue
        }
        if ('"\\/bfnrt'.indexOf(e) !== -1) { i++; continue }
        if (lenient) { i++; continue }
        fail(`invalid escape sequence \\${e}`, esc)
      }
      if (c < ' ') {
        if (!lenient) fail('unescaped control character in string — write it as \\u00XX', i)
        i++
        continue
      }
      i++
    }
  }

  function parseNumber(): void {
    const start = i
    const re = lenient ? lenientNumber : strictNumber
    re.lastIndex = i
    const m = re.exec(s)
    if (!m) fail('invalid number', start)
    i = re.lastIndex
    const next = s[i]
    if (next !== undefined && /[0-9A-Za-z_.+]/.test(next)) fail('invalid number', start)
  }

  function parseObject(depth: number): void {
    const open = i
    i++
    skipWs()
    if (i < len && s[i] === '}') { i++; return }
    for (;;) {
      skipWs()
      if (i >= len) fail('unexpected end of input — unterminated object', open)
      const c = s[i]
      if (c === '"') parseString('"')
      else if (lenient && c === "'") parseString("'")
      else if (lenient && /[A-Za-z_$]/.test(c)) { while (i < len && /[A-Za-z0-9_$]/.test(s[i])) i++ }
      else if (c === "'") fail('single-quoted property names are not valid JSON — turn strict off to allow them', i)
      else fail(`expected a double-quoted property name but found ${JSON.stringify(cpAt(i))}`, i)
      skipWs()
      if (i >= len || s[i] !== ':') fail("expected ':' after property name", Math.min(i, len))
      i++
      parseValue(depth + 1)
      skipWs()
      if (i >= len) fail('unexpected end of input — unterminated object', open)
      if (s[i] === ',') {
        const comma = i
        i++
        skipWs()
        if (i < len && s[i] === '}') {
          if (!lenient) fail('trailing comma is not allowed in strict JSON', comma)
          i++
          return
        }
        continue
      }
      if (s[i] === '}') { i++; return }
      fail(`expected ',' or '}' but found ${JSON.stringify(cpAt(i))}`, i)
    }
  }

  function parseArray(depth: number): void {
    const open = i
    i++
    skipWs()
    if (i < len && s[i] === ']') { i++; return }
    for (;;) {
      parseValue(depth + 1)
      skipWs()
      if (i >= len) fail('unexpected end of input — unterminated array', open)
      if (s[i] === ',') {
        const comma = i
        i++
        skipWs()
        if (i < len && s[i] === ']') {
          if (!lenient) fail('trailing comma is not allowed in strict JSON', comma)
          i++
          return
        }
        continue
      }
      if (s[i] === ']') { i++; return }
      fail(`expected ',' or ']' but found ${JSON.stringify(cpAt(i))}`, i)
    }
  }

  function parseValue(depth: number): void {
    if (depth > 500) fail('nesting is too deep', i)
    skipWs()
    if (i >= len) fail('unexpected end of input', len)
    const c = s[i]
    if (c === '{') return parseObject(depth)
    if (c === '[') return parseArray(depth)
    if (c === '"') return parseString('"')
    if (c === "'") {
      if (!lenient) fail('single-quoted strings are not valid JSON — turn strict off to allow them', i)
      return parseString("'")
    }
    if (c === 't' && s.startsWith('true', i)) { i += 4; return }
    if (c === 'f' && s.startsWith('false', i)) { i += 5; return }
    if (c === 'n' && s.startsWith('null', i)) { i += 4; return }
    if (lenient && (c === 'I' || c === 'N')) return parseNumber()
    if (c === '-' || c === '+' || c === '.' || (c >= '0' && c <= '9')) return parseNumber()
    fail(`unexpected token ${JSON.stringify(cpAt(i))}`, i)
  }

  skipWs()
  parseValue(0)
  skipWs()
  if (i < len) fail(`unexpected trailing content ${JSON.stringify(cpAt(i))}`, i)
}

const MAX_EXCERPT = 120

function locate(src: string, index: number): { line: number; column: number; excerpt: string } {
  const at = Math.max(0, Math.min(index, src.length))
  const before = src.slice(0, at)
  const lineStart = before.lastIndexOf('\n') + 1
  const line = before.split('\n').length
  // Column counts code points so an emoji advances the column by one, not two.
  const column = Array.from(src.slice(lineStart, at)).length + 1
  let lineEnd = src.indexOf('\n', at)
  if (lineEnd === -1) lineEnd = src.length
  let text = src.slice(lineStart, lineEnd)
  if (text.charAt(text.length - 1) === '\r') text = text.slice(0, -1)
  const cps = Array.from(text)
  if (cps.length > MAX_EXCERPT) {
    let start = Math.max(0, column - 1 - Math.floor(MAX_EXCERPT / 2))
    const end = Math.min(cps.length, start + MAX_EXCERPT)
    start = Math.max(0, end - MAX_EXCERPT)
    text = `${start > 0 ? '…' : ''}${cps.slice(start, end).join('')}${end < cps.length ? '…' : ''}`
  }
  return { line, column, excerpt: text }
}

const ok = (): ValidationResult => ({ valid: true, error: null, line: null, column: null, excerpt: null })

const bad = (src: string, message: string, at: number | null): ValidationResult => {
  if (at === null) return { valid: false, error: message, line: null, column: null, excerpt: null }
  const { line, column, excerpt } = locate(src, at)
  return { valid: false, error: message, line, column, excerpt }
}

const util: Utility = {
  id: 'json_validate',
  name: 'json validate',
  category: 'Data Formats',
  description:
    'Check whether the input is valid JSON and report the error message with its line, column and source excerpt; turn off strict to also accept JSON5-style comments, trailing commas and unquoted keys.',
  accepts: 'string',
  produces: 'json',
  tags: ['json', 'validate', 'lint', 'syntax check', 'jsonlint', 'json5'],
  aliases: ['jsonlint'],
  examples: [
    {
      title: 'valid document',
      input: '{"id":1,"name":"Ada"}',
      output: '{\n  "valid": true,\n  "error": null,\n  "line": null,\n  "column": null,\n  "excerpt": null\n}'
    },
    {
      title: 'trailing comma rejected in strict mode',
      input: '{"id":1,"name":"Ada",}',
      output:
        '{\n  "valid": false,\n  "error": "trailing comma is not allowed in strict JSON",\n  "line": 1,\n  "column": 21,\n  "excerpt": "{\\"id\\":1,\\"name\\":\\"Ada\\",}"\n}'
    },
    {
      title: 'same trailing comma accepted when strict is off',
      input: '{"id":1,}',
      params: { strict: false },
      output: '{\n  "valid": true,\n  "error": null,\n  "line": null,\n  "column": null,\n  "excerpt": null\n}'
    }
  ],
  params: {
    strict: { kind: 'boolean', label: 'strict (RFC 8259)', default: true }
  },
  apply: (input: any, { strict }: any) => {
    const src = String(input ?? '')
    if (src.trim() === '') return bad(src, 'empty input', null)
    const isStrict = strict !== false

    if (!isStrict) {
      try {
        scanJson(src, true)
        return ok()
      } catch (e) {
        if (isPosError(e)) return bad(src, e.message, e.at)
        return bad(src, e instanceof Error ? e.message : String(e), null)
      }
    }

    try {
      JSON.parse(src)
      return ok()
    } catch (native) {
      const nativeMessage = native instanceof Error ? native.message : String(native)
      try {
        // The scanner pinpoints the offending character; JSON.parse stays the source of truth.
        scanJson(src, false)
      } catch (e) {
        if (isPosError(e)) return bad(src, e.message, e.at)
      }
      // Scanner disagreed with the engine — fall back to the engine's own position, if any.
      const m = /position\s+(\d+)/.exec(nativeMessage)
      return bad(src, nativeMessage, m ? Number(m[1]) : null)
    }
  }
}

export default util
