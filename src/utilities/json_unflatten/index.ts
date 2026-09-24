import type { Utility } from '@/types/utility'

const INDEX_LIKE = /^(?:0|[1-9][0-9]*)$/
const MAX_INDEX = 1000000

type Segment = string | number

/**
 * Split a flattened path into segments. Numeric segments (`a.0` or `a[0]`)
 * rebuild arrays; quoted bracket segments (`a['0.1']`) always stay object keys.
 * Iterates code points so astral characters in keys survive intact.
 */
export function parsePath(path: string, delimiter: string): Segment[] {
  const cps = Array.from(path)
  const delim = Array.from(delimiter)
  const segs: Segment[] = []
  let buf = ''
  let bufActive = false
  let i = 0

  const matchesDelim = (at: number): boolean => {
    if (delim.length === 0) return false
    for (let k = 0; k < delim.length; k++) if (cps[at + k] !== delim[k]) return false
    return true
  }
  const plain = (text: string): Segment => (INDEX_LIKE.test(text) ? Number(text) : text)

  while (i < cps.length) {
    const c = cps[i]

    if (c === '[') {
      if (bufActive) { segs.push(plain(buf)); buf = ''; bufActive = false }
      i++
      const quote = cps[i]
      if (quote === "'" || quote === '"') {
        i++
        let key = ''
        for (;;) {
          if (i >= cps.length) throw new Error(`unterminated quoted segment in path "${path}"`)
          const ch = cps[i]
          if (ch === '\\') {
            if (i + 1 >= cps.length) throw new Error(`unterminated escape in path "${path}"`)
            key += cps[i + 1]
            i += 2
            continue
          }
          if (ch === quote) { i++; break }
          key += ch
          i++
        }
        if (cps[i] !== ']') throw new Error(`expected "]" after a quoted segment in path "${path}"`)
        i++
        segs.push(key)
      } else {
        let text = ''
        while (i < cps.length && cps[i] !== ']') { text += cps[i]; i++ }
        if (i >= cps.length) throw new Error(`unterminated "[" in path "${path}"`)
        i++
        segs.push(plain(text))
      }
      if (matchesDelim(i)) { i += delim.length; bufActive = true }
      continue
    }

    if (matchesDelim(i)) {
      segs.push(plain(buf))
      buf = ''
      bufActive = true
      i += delim.length
      continue
    }

    buf += c
    bufActive = true
    i++
  }

  if (bufActive) segs.push(plain(buf))
  if (segs.length === 0) segs.push('')
  return segs
}

/**
 * Rebuilt objects are `Map`s, not plain objects: a plain object re-orders
 * integer-like keys (a quoted `['0']` segment would jump to the front) and a
 * `"__proto__"` segment would hit the prototype setter instead of being stored
 * as data.
 */
const getAt = (container: any, key: Segment): unknown =>
  Array.isArray(container) ? container[key as number] : (container as Map<string, unknown>).get(String(key))

// Array holes stay holes (they are rendered as null), so paths may arrive in
// any order without a gap-filling null being mistaken for a value.
const hasAt = (container: any, key: Segment): boolean =>
  Array.isArray(container)
    ? (key as number) in container
    : (container as Map<string, unknown>).has(String(key))

function setAt(container: any, key: Segment, value: unknown, path: string): void {
  if (Array.isArray(container)) {
    const index = key as number
    if (index > MAX_INDEX) throw new Error(`array index ${index} in path "${path}" is too large`)
    container[index] = value
  } else {
    ;(container as Map<string, unknown>).set(String(key), value)
  }
}

/** JSON.stringify-compatible printer that emits `Map` keys in insertion order. */
function render(node: unknown, spaces: number, level: number): string {
  if (node === undefined) return 'null' // an array hole left by an out-of-order index
  if (node === null || typeof node !== 'object') return JSON.stringify(node) as string

  const open = spaces > 0 ? `\n${' '.repeat(spaces * (level + 1))}` : ''
  const close = spaces > 0 ? `\n${' '.repeat(spaces * level)}` : ''
  const colon = spaces > 0 ? ': ' : ':'

  if (Array.isArray(node)) {
    if (node.length === 0) return '[]'
    const parts: string[] = []
    for (let i = 0; i < node.length; i++) parts.push(render(node[i], spaces, level + 1))
    return `[${open}${parts.join(`,${open}`)}${close}]`
  }

  // Maps are containers we built; plain objects are leaf values from the input.
  const entries: [string, unknown][] =
    node instanceof Map
      ? Array.from(node as Map<string, unknown>)
      : Object.keys(node).map((key) => [key, (node as Record<string, unknown>)[key]])
  if (entries.length === 0) return '{}'
  const parts = entries.map(([key, value]) => JSON.stringify(key) + colon + render(value, spaces, level + 1))
  return `{${open}${parts.join(`,${open}`)}${close}}`
}

function unflatten(flat: Record<string, unknown>, delimiter: string): unknown {
  const holder = new Map<string, unknown>()
  const created = new WeakSet<object>()

  const ensure = (parent: any, key: Segment, wantArray: boolean, path: string): any => {
    const existing = hasAt(parent, key) ? getAt(parent, key) : undefined
    if (existing === undefined) {
      const made: any = wantArray ? [] : new Map<string, unknown>()
      setAt(parent, key, made, path)
      created.add(made)
      return made
    }
    if (typeof existing !== 'object' || existing === null || !created.has(existing)) {
      throw new Error(`conflicting paths at "${path}" — "${String(key)}" already holds a value`)
    }
    if (Array.isArray(existing) !== wantArray) {
      throw new Error(`conflicting paths at "${path}" — cannot mix array indices and object keys`)
    }
    return existing
  }

  for (const path of Object.keys(flat)) {
    const segs = parsePath(path, delimiter)
    let parent: any = holder
    let parentKey: Segment = 'root'
    for (let k = 0; k < segs.length; k++) {
      const seg = segs[k]
      const container = ensure(parent, parentKey, typeof seg === 'number', path)
      if (k === segs.length - 1) {
        if (hasAt(container, seg)) {
          throw new Error(`conflicting paths at "${path}" — that location is already filled`)
        }
        setAt(container, seg, flat[path], path)
      } else {
        parent = container
        parentKey = seg
      }
    }
  }

  return holder.has('root') ? holder.get('root') : new Map<string, unknown>()
}

const util: Utility = {
  id: 'json_unflatten',
  name: 'json unflatten',
  category: 'Data Formats',
  description:
    'Rebuild nested JSON from a flat object of path keys, splitting on the given delimiter and turning numeric segments such as a.0 or a[0] back into arrays.',
  accepts: 'string',
  produces: 'string',
  tags: ['json', 'unflatten', 'nest', 'dot notation', 'path', 'rebuild object'],
  examples: [
    {
      title: 'rebuild nested object and array',
      input: '{"user.name":"ada","user.tags[0]":"x","user.tags[1]":"y","ok":true}',
      output: '{\n  "user": {\n    "name": "ada",\n    "tags": [\n      "x",\n      "y"\n    ]\n  },\n  "ok": true\n}'
    }
  ],
  params: {
    delimiter: { kind: 'string', label: 'delimiter', default: '.' },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, { delimiter, indent }: any) => {
    const src = String(input ?? '')
    if (src.trim() === '') return ''

    let parsed: unknown
    try {
      parsed = JSON.parse(src)
    } catch (e) {
      throw new Error(`invalid JSON: ${e instanceof Error ? e.message : String(e)}`)
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('json unflatten needs a flat object of path → value pairs')
    }

    const delim = delimiter === undefined || delimiter === null ? '.' : String(delimiter)
    if (delim === '') throw new Error('delimiter must not be empty')

    const spaces = Math.max(0, Math.min(10, Math.floor(Number(indent ?? 2) || 0)))
    return render(unflatten(parsed as Record<string, unknown>, delim), spaces, 0)
  }
}

export default util
