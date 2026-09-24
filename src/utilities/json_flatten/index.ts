import type { Utility } from '@/types/utility'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

const isPlainObject = (v: Json): v is { [key: string]: Json } =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const INDEX_LIKE = /^(?:0|[1-9][0-9]*)$/

const quoteKey = (key: string) => `['${key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`

type Options = { delimiter: string; bracket: boolean }

/**
 * Bracket notation quotes any key that would otherwise be ambiguous (empty,
 * index-like, or containing the delimiter/brackets) so json_unflatten can
 * rebuild the exact original document. Dot notation stays deliberately plain.
 */
function joinKey(prefix: string, key: string, atRoot: boolean, opts: Options): string {
  if (opts.bracket) {
    const ambiguous =
      key === '' ||
      INDEX_LIKE.test(key) ||
      key.indexOf(opts.delimiter) !== -1 ||
      key.indexOf('[') !== -1 ||
      key.indexOf(']') !== -1
    if (ambiguous) return prefix + quoteKey(key)
  }
  return atRoot ? key : prefix + opts.delimiter + key
}

const joinIndex = (prefix: string, index: number, atRoot: boolean, opts: Options): string =>
  opts.bracket
    ? `${prefix}[${index}]`
    : atRoot
      ? String(index)
      : prefix + opts.delimiter + index

/**
 * A `Map`, not a plain object: object keys would be re-ordered whenever a path
 * happens to look like an array index (`"1"` before `"0.a"` for a root array in
 * dot notation) and a `"__proto__"` path would hit the prototype setter instead
 * of being stored as data.
 */
function flatten(root: Json, opts: Options): Map<string, Json> {
  const out = new Map<string, Json>()

  const put = (path: string, value: Json) => {
    if (out.has(path)) {
      throw new Error(`path collision on "${path}" — pick a delimiter the keys do not contain`)
    }
    out.set(path, value)
  }

  const walk = (node: Json, path: string, atRoot: boolean): void => {
    if (Array.isArray(node)) {
      if (node.length === 0) {
        if (!atRoot) put(path, [])
        return
      }
      node.forEach((child, index) => walk(child, joinIndex(path, index, atRoot, opts), false))
      return
    }
    if (isPlainObject(node)) {
      const keys = Object.keys(node)
      if (keys.length === 0) {
        if (!atRoot) put(path, {})
        return
      }
      for (const key of keys) walk(node[key], joinKey(path, key, atRoot, opts), false)
      return
    }
    put(path, node)
  }

  walk(root, '', true)
  return out
}

/**
 * Print the flat map in insertion order. Every value is a scalar or an empty
 * container (anything else was walked into), so no nested indenting is needed.
 */
function render(entries: Map<string, Json>, spaces: number): string {
  if (entries.size === 0) return '{}'
  const open = spaces > 0 ? `\n${' '.repeat(spaces)}` : ''
  const close = spaces > 0 ? '\n' : ''
  const colon = spaces > 0 ? ': ' : ':'
  const parts: string[] = []
  for (const [path, value] of entries) parts.push(JSON.stringify(path) + colon + JSON.stringify(value))
  return `{${open}${parts.join(`,${open}`)}${close}}`
}

const util: Utility = {
  id: 'json_flatten',
  name: 'json flatten',
  category: 'Data Formats',
  description:
    'Flatten nested JSON into a single-level object keyed by path, using bracket or dot notation for array indices and a configurable delimiter.',
  accepts: 'string',
  produces: 'string',
  tags: ['json', 'flatten', 'dot notation', 'path', 'unflatten', 'nested keys'],
  examples: [
    {
      title: 'nested object and array',
      input: '{"user":{"name":"Ada","tags":["core","dev"]},"active":true}',
      output:
        '{\n  "user.name": "Ada",\n  "user.tags[0]": "core",\n  "user.tags[1]": "dev",\n  "active": true\n}'
    },
    {
      title: 'dot notation for array indices',
      input: '{"user":{"tags":["x","y"]}}',
      params: { arrayNotation: 'dot', indent: 0 },
      output: '{"user.tags.0":"x","user.tags.1":"y"}'
    }
  ],
  params: {
    delimiter: { kind: 'string', label: 'delimiter', default: '.' },
    arrayNotation: { kind: 'select', label: 'array notation', options: ['bracket', 'dot'], default: 'bracket' },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, { delimiter, arrayNotation, indent }: any) => {
    const src = String(input ?? '')
    if (src.trim() === '') return ''

    let parsed: Json
    try {
      parsed = JSON.parse(src)
    } catch (e) {
      throw new Error(`invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (!isPlainObject(parsed) && !Array.isArray(parsed)) {
      throw new Error('json flatten needs an object or array at the root')
    }

    const delim = delimiter === undefined || delimiter === null ? '.' : String(delimiter)
    if (delim === '') throw new Error('delimiter must not be empty')

    const opts: Options = { delimiter: delim, bracket: arrayNotation !== 'dot' }
    const spaces = Math.max(0, Math.min(10, Math.floor(Number(indent ?? 2) || 0)))
    return render(flatten(parsed, opts), spaces)
  }
}

export default util
