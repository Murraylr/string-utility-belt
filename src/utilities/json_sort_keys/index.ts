import type { Utility } from '@/types/utility'

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/**
 * Sorted objects are carried as `Map`s rather than plain objects. A plain
 * object is unusable here for two reasons: it re-orders integer-like keys
 * ("2" always lands before "10", whatever the sort said) and assigning
 * `__proto__` hits the prototype setter instead of creating a key, silently
 * dropping it from the output.
 */
type Node = null | boolean | number | string | Node[] | Map<string, Node>

const isPlainObject = (v: Json): v is { [key: string]: Json } =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Compare by code point rather than UTF-16 code unit, so astral characters
 * (emoji, rare CJK) sort after the BMP instead of in the middle of it.
 */
export const compareCodePoints = (a: string, b: string): number => {
  const left = Array.from(a)
  const right = Array.from(b)
  const shared = Math.min(left.length, right.length)
  for (let i = 0; i < shared; i++) {
    const x = left[i].codePointAt(0) as number
    const y = right[i].codePointAt(0) as number
    if (x !== y) return x < y ? -1 : 1
  }
  if (left.length === right.length) return 0
  return left.length < right.length ? -1 : 1
}

/** JSON.stringify-compatible printer that emits `Map` keys in insertion order. */
function render(node: Node, spaces: number, level: number): string {
  if (node === null || typeof node !== 'object') return JSON.stringify(node) as string

  const open = spaces > 0 ? `\n${' '.repeat(spaces * (level + 1))}` : ''
  const close = spaces > 0 ? `\n${' '.repeat(spaces * level)}` : ''
  const colon = spaces > 0 ? ': ' : ':'

  if (Array.isArray(node)) {
    if (node.length === 0) return '[]'
    const parts = node.map((item) => render(item, spaces, level + 1))
    return `[${open}${parts.join(`,${open}`)}${close}]`
  }

  if (node.size === 0) return '{}'
  const parts: string[] = []
  for (const [key, value] of node) parts.push(JSON.stringify(key) + colon + render(value, spaces, level + 1))
  return `{${open}${parts.join(`,${open}`)}${close}}`
}

const typeRank = (v: Node): number => {
  if (v === null) return 0
  if (typeof v === 'boolean') return 1
  if (typeof v === 'number') return 2
  if (typeof v === 'string') return 3
  return Array.isArray(v) ? 4 : 5
}

/** Total order over JSON values: null < boolean < number < string < array < object. */
const compareValues = (a: Node, b: Node): number => {
  const ra = typeRank(a)
  const rb = typeRank(b)
  if (ra !== rb) return ra < rb ? -1 : 1
  if (ra === 1) return (a ? 1 : 0) - (b ? 1 : 0)
  if (ra === 2) {
    const x = a as number
    const y = b as number
    return x === y ? 0 : x < y ? -1 : 1
  }
  if (ra === 3) return compareCodePoints(a as string, b as string)
  return compareCodePoints(render(a, 0, 0), render(b, 0, 0))
}

type Options = { sign: number; deep: boolean; sortArrays: boolean }

/**
 * `active` says whether this node's own order may be rearranged. The root is
 * always active; deeper nodes only when `deep` is on. Children are still
 * converted either way so their original order is reproduced verbatim.
 */
function sortNode(node: Json, opts: Options, active: boolean): Node {
  if (Array.isArray(node)) {
    const items = node.map((child) => sortNode(child, opts, opts.deep))
    if (opts.sortArrays && active) items.sort((a, b) => opts.sign * compareValues(a, b))
    return items
  }

  if (isPlainObject(node)) {
    const keys = Object.keys(node)
    if (active) keys.sort((a, b) => opts.sign * compareCodePoints(a, b))
    const out = new Map<string, Node>()
    for (const key of keys) out.set(key, sortNode(node[key], opts, opts.deep))
    return out
  }

  return node
}

const util: Utility = {
  id: 'json_sort_keys',
  name: 'json sort keys',
  category: 'Data Formats',
  description:
    'Reorder JSON object keys alphabetically (asc or desc), optionally at every depth and optionally sorting array elements too, re-printed with the given indent.',
  accepts: 'string',
  produces: 'string',
  tags: ['json', 'sort keys', 'alphabetize', 'order', 'normalize', 'diff friendly'],
  examples: [
    {
      title: 'sorts every depth (the default)',
      input: '{"banana":1,"apple":2,"cherry":{"z":1,"a":2}}',
      output: '{\n  "apple": 2,\n  "banana": 1,\n  "cherry": {\n    "a": 2,\n    "z": 1\n  }\n}'
    },
    {
      title: 'descending order, compact',
      input: '{"banana":1,"apple":2}',
      params: { direction: 'desc', indent: 0 },
      output: '{"banana":1,"apple":2}'
    }
  ],
  params: {
    direction: { kind: 'select', label: 'direction', options: ['asc', 'desc'], default: 'asc' },
    deep: { kind: 'boolean', label: 'sort nested values (off = root only)', default: true },
    sortArrays: { kind: 'boolean', label: 'sort array elements', default: false },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, { direction, deep, sortArrays, indent }: any) => {
    const src = String(input ?? '')
    if (src.trim() === '') return ''

    let parsed: Json
    try {
      parsed = JSON.parse(src)
    } catch (e) {
      throw new Error(`invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
    }

    const opts: Options = {
      sign: direction === 'desc' ? -1 : 1,
      deep: deep !== false,
      sortArrays: sortArrays === true
    }
    const spaces = Math.max(0, Math.min(10, Math.floor(Number(indent ?? 2) || 0)))
    return render(sortNode(parsed, opts, true), spaces, 0)
  }
}

export default util
