import type { Utility } from '@/types/utility'

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }

const isPlainObject = (v: unknown): v is JsonObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/** Render a scalar as INI text, quoting + escaping only when it would not survive a round trip. */
function formatScalar(value: JsonValue, delimiter: string): string {
  let s: string
  if (value === null) s = 'null'
  else if (typeof value === 'boolean') s = value ? 'true' : 'false'
  else if (typeof value === 'number') s = Number.isFinite(value) ? String(value) : 'null'
  else if (typeof value === 'string') s = value
  else s = JSON.stringify(value) // nested object/array inside an array: keep it as compact JSON

  const needsQuote =
    s === '' ? false
      : /[\n\r]/.test(s) ||
        s !== s.trim() ||
        s.includes(delimiter) ||
        /^["']/.test(s) ||
        /^[;#]/.test(s) ||
        /\s[;#]/.test(s)

  if (!needsQuote) return s
  const escaped = Array.from(s)
    .map((c) => {
      if (c === '\\') return '\\\\'
      if (c === '"') return '\\"'
      if (c === '\n') return '\\n'
      if (c === '\r') return '\\r'
      if (c === '\t') return '\\t'
      return c
    })
    .join('')
  return `"${escaped}"`
}

function checkKey(key: string, delimiter: string) {
  if (key === '') throw new Error('cannot write an empty key name to INI')
  if (/[\n\r]/.test(key)) throw new Error(`key contains a line break: ${JSON.stringify(key)}`)
  if (key.includes(delimiter)) {
    throw new Error(`key ${JSON.stringify(key)} contains the delimiter "${delimiter}"`)
  }
  if (key.trimStart().startsWith('[')) {
    throw new Error(`key ${JSON.stringify(key)} would be read back as a section header`)
  }
}

function checkSection(name: string) {
  if (/[\n\r\]]/.test(name)) {
    throw new Error(`section name contains a line break or "]": ${JSON.stringify(name)}`)
  }
}

/**
 * Emit one object level: scalar/array keys become `key=value` lines, nested
 * objects become `[dotted.section]` blocks written depth-first after them.
 */
function emit(obj: JsonObject, path: string[], sep: string, delimiter: string, lines: string[]) {
  const sections: [string, JsonObject][] = []
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    if (isPlainObject(value)) {
      sections.push([key, value])
      continue
    }
    checkKey(key, delimiter)
    if (Array.isArray(value)) {
      // `key[]=` marks every element so single-element arrays round-trip as arrays
      for (const item of value) lines.push(`${key}[]${sep}${formatScalar(item, delimiter)}`)
    } else {
      lines.push(`${key}${sep}${formatScalar(value, delimiter)}`)
    }
  }
  for (const [key, value] of sections) {
    checkKey(key, delimiter)
    const next = [...path, key]
    const name = next.join('.')
    checkSection(name)
    if (lines.length) lines.push('')
    lines.push(`[${name}]`)
    emit(value, next, sep, delimiter, lines)
  }
}

const util: Utility = {
  id: 'json_to_ini',
  name: 'json to ini',
  category: 'Data Formats',
  description:
    'Serialize a JSON object as INI text, turning nested objects into dotted [sections] and arrays into repeated key[] lines.',
  accepts: 'json',
  produces: 'string',
  tags: ['ini', 'json', 'config', 'conf', 'sections', 'serialize'],
  examples: [
    {
      title: 'globals then a section',
      input: '{"app":"belt","debug":false,"server":{"host":"localhost","port":8080}}',
      inputEncoding: 'json',
      output: 'app=belt\ndebug=false\n\n[server]\nhost=localhost\nport=8080'
    }
  ],
  params: {
    delimiter: { kind: 'string', label: 'delimiter', default: '=' },
    spacing: { kind: 'boolean', label: 'spaces around delimiter', default: false }
  },
  apply: (input: any, { delimiter, spacing }: any): any => {
    const delim = delimiter === undefined || delimiter === null || delimiter === '' ? '=' : String(delimiter)
    const sep = spacing ? ` ${delim} ` : delim

    let value: unknown = input
    if (typeof value === 'string') {
      if (value.trim() === '') return ''
      try {
        value = JSON.parse(value)
      } catch {
        throw new Error('input is not valid JSON')
      }
    }
    if (value instanceof Uint8Array) throw new Error('json to ini expects JSON, not raw bytes')
    if (!isPlainObject(value)) {
      throw new Error('json to ini expects a JSON object at the top level')
    }

    const lines: string[] = []
    emit(value, [], sep, delim, lines)
    return lines.join('\n')
  }
}

export default util
