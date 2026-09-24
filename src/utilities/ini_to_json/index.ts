import type { Utility } from '@/types/utility'

type IniScalar = string | number | boolean | null
type IniValue = IniScalar | IniValue[] | { [key: string]: IniValue }
type IniObject = { [key: string]: IniValue }

const isPlainObject = (v: unknown): v is IniObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Every object in the result tree is prototype-less: a key such as `toString`
 * or `__proto__` must behave like any other key instead of colliding with
 * `Object.prototype` (which would otherwise swallow the line or emit a bogus
 * "conflicting key" error). JSON.stringify treats these exactly like `{}`.
 */
const newObject = (): IniObject => Object.create(null) as IniObject

/**
 * Remove a trailing `;` / `#` comment from a line.
 * A comment marker only starts a comment when it opens the line or is preceded
 * by whitespace, so values such as `color=#ff8800` survive intact. Markers
 * inside single/double quoted values are always literal.
 */
function stripComment(line: string): string {
  const chars = Array.from(line)
  let out = ''
  let quote: string | null = null
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    if (quote) {
      out += c
      if (c === '\\' && i + 1 < chars.length) {
        out += chars[++i]
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      // Only a quote that opens the line or the value is a real delimiter — an
      // apostrophe inside a bare value (`greeting = don't ; hi`) is literal and
      // must not hide the comment that follows it.
      const before = out.trimEnd()
      if (before === '' || before.endsWith('=')) quote = c
      out += c
      continue
    }
    if (c === ';' || c === '#') {
      const prev = out.length ? out[out.length - 1] : ''
      if (out.trim() === '' || /\s/.test(prev)) break
    }
    out += c
  }
  return out
}

const unescapeChar = (c: string): string => {
  switch (c) {
    case 'n': return '\n'
    case 'r': return '\r'
    case 't': return '\t'
    case 'b': return '\b'
    case 'f': return '\f'
    case '0': return '\0'
    default: return c
  }
}

/**
 * If `s` is fully wrapped in matching quotes, return the unquoted (and, for
 * double quotes, unescaped) contents. Returns null when `s` is not a quoted
 * literal so the caller can fall back to the raw text.
 */
function tryUnquote(s: string): string | null {
  const q = s[0]
  if (q !== '"' && q !== "'") return null
  const chars = Array.from(s)
  let out = ''
  for (let i = 1; i < chars.length; i++) {
    const c = chars[i]
    if (q === '"' && c === '\\' && i + 1 < chars.length) {
      out += unescapeChar(chars[++i])
      continue
    }
    if (c === q) return i === chars.length - 1 ? out : null
    out += c
  }
  return null
}

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

function parseValue(raw: string, typed: boolean): IniScalar {
  const s = raw.trim()
  const unquoted = tryUnquote(s)
  if (unquoted !== null) return unquoted
  if (!typed) return s
  if (s === '') return ''
  const lower = s.toLowerCase()
  if (lower === 'true' || lower === 'yes' || lower === 'on') return true
  if (lower === 'false' || lower === 'no' || lower === 'off') return false
  if (lower === 'null' || lower === 'nil') return null
  if (NUMBER_RE.test(s)) {
    const n = Number(s)
    // An integer past 2^53 cannot survive as a JS number, so keep the digits.
    if (Number.isFinite(n) && (!Number.isInteger(n) || Number.isSafeInteger(n))) return n
  }
  return s
}

/** Walk (creating as needed) a path of objects, returning the container for the final key. */
function containerFor(root: IniObject, path: string[], where: string): IniObject {
  let node: IniObject = root
  const walked: string[] = []
  for (const part of path) {
    walked.push(part)
    const existing = node[part]
    if (existing === undefined) {
      const created = newObject()
      node[part] = created
      node = created
    } else if (isPlainObject(existing)) {
      node = existing
    } else {
      throw new Error(`conflicting key "${walked.join('.')}" (${where}): value and section share a name`)
    }
  }
  return node
}

function assign(target: IniObject, key: string, value: IniScalar, forceArray: boolean) {
  const existing = target[key]
  if (existing === undefined) {
    target[key] = forceArray ? [value] : value
    return
  }
  if (Array.isArray(existing)) {
    existing.push(value)
    return
  }
  target[key] = [existing as IniValue, value]
}

export function parseIni(text: string, nested: boolean, typed: boolean): IniObject {
  const root = newObject()
  let sectionPath: string[] = []
  const lines = text.split(/\r\n|\r|\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i]).trim()
    if (line === '') continue

    if (line.startsWith('[')) {
      const end = line.lastIndexOf(']')
      if (end !== line.length - 1 || end < 1) {
        throw new Error(`line ${i + 1}: unterminated section header: ${lines[i].trim()}`)
      }
      const name = line.slice(1, end).trim()
      if (name === '') throw new Error(`line ${i + 1}: empty section name`)
      sectionPath = nested ? name.split('.').map((p) => p.trim()).filter(Boolean) : [name]
      if (sectionPath.length === 0) throw new Error(`line ${i + 1}: empty section name`)
      // A section header alone is meaningful: it declares an (empty) object.
      containerFor(root, sectionPath, `section [${name}]`)
      continue
    }

    const eq = line.indexOf('=')
    if (eq === -1) {
      throw new Error(`line ${i + 1}: expected "key=value" or "[section]", got: ${lines[i].trim()}`)
    }
    let rawKey = line.slice(0, eq).trim()
    if (rawKey === '') throw new Error(`line ${i + 1}: missing key before "="`)
    let forceArray = false
    if (rawKey.endsWith('[]')) {
      forceArray = true
      rawKey = rawKey.slice(0, -2).trim()
      if (rawKey === '') throw new Error(`line ${i + 1}: missing key before "[]"`)
    }
    const value = parseValue(line.slice(eq + 1), typed)
    const keyPath = nested ? rawKey.split('.').map((p) => p.trim()).filter(Boolean) : [rawKey]
    if (keyPath.length === 0) throw new Error(`line ${i + 1}: missing key before "="`)
    const leaf = keyPath[keyPath.length - 1]
    const target = containerFor(root, [...sectionPath, ...keyPath.slice(0, -1)], `key "${rawKey}"`)
    assign(target, leaf, value, forceArray)
  }
  return root
}

const util: Utility = {
  id: 'ini_to_json',
  name: 'ini to json',
  category: 'Data Formats',
  description:
    'Parse INI/config text into JSON, with optional dot-path nesting and typed values for numbers, booleans and null.',
  accepts: 'string',
  produces: 'string',
  tags: ['ini', 'config', 'conf', 'json', 'parse', 'sections', 'windows config'],
  examples: [
    {
      title: 'globals and a section',
      input: 'app=belt\n\n[server]\nhost=localhost\nport=8080\ndebug=true',
      output: '{\n  "app": "belt",\n  "server": {\n    "host": "localhost",\n    "port": "8080",\n    "debug": "true"\n  }\n}'
    },
    {
      title: 'typed values',
      input: 'app=belt\n\n[server]\nport=8080\nenabled=yes',
      params: { typed: true },
      output: '{\n  "app": "belt",\n  "server": {\n    "port": 8080,\n    "enabled": true\n  }\n}'
    },
    {
      title: 'dotted section nesting',
      input: '[db.primary]\nhost=localhost',
      params: { nested: true },
      output: '{\n  "db": {\n    "primary": {\n      "host": "localhost"\n    }\n  }\n}'
    }
  ],
  params: {
    nested: { kind: 'boolean', label: 'nest dotted names', default: false },
    typed: { kind: 'boolean', label: 'coerce value types', default: false },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, integer: true, max: 10 }
  },
  apply: (input: any, { nested, typed, indent }: any): any => {
    const text = String(input ?? '')
    const spaces = Math.max(0, Number(indent ?? 2) || 0)
    if (text.trim() === '') return JSON.stringify({}, null, spaces)
    const parsed = parseIni(text, Boolean(nested), Boolean(typed))
    return JSON.stringify(parsed, null, spaces)
  }
}

export default util
