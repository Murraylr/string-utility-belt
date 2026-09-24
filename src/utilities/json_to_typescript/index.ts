import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/* ------------------------------------------------------------------ *
 * Inferred shape tree
 * ------------------------------------------------------------------ */

type PropNode = { node: Node; optional: boolean }

type Node =
  | { k: 'prim'; t: string }
  | { k: 'arr'; item: Node | null }
  | { k: 'obj'; props: Map<string, PropNode> }
  | { k: 'union'; of: Node[] }

type ObjNode = Extract<Node, { k: 'obj' }>
type ArrNode = Extract<Node, { k: 'arr' }>

const UNKNOWN: Node = { k: 'prim', t: 'unknown' }

const primOf = (v: unknown): Node => {
  if (v === null) return { k: 'prim', t: 'null' }
  switch (typeof v) {
    case 'string': return { k: 'prim', t: 'string' }
    case 'number': return { k: 'prim', t: 'number' }
    case 'boolean': return { k: 'prim', t: 'boolean' }
    default: return UNKNOWN
  }
}

/** Grouping key: two nodes collapse into one type only when these match. */
const kindKey = (n: Node): string => (n.k === 'prim' ? `prim:${n.t}` : n.k)

function infer(v: unknown, arrayUnion: boolean): Node {
  if (Array.isArray(v)) {
    const members = v.map((m) => infer(m, arrayUnion))
    if (members.length === 0) return { k: 'arr', item: null }
    return { k: 'arr', item: mergeAll(members, arrayUnion) }
  }
  if (v !== null && typeof v === 'object') {
    const props = new Map<string, PropNode>()
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      props.set(key, { node: infer(val, arrayUnion), optional: false })
    }
    return { k: 'obj', props }
  }
  return primOf(v)
}

function mergeObjs(objs: ObjNode[], union: boolean): Node {
  const keys: string[] = []
  for (const o of objs) for (const k of o.props.keys()) if (!keys.includes(k)) keys.push(k)
  const props = new Map<string, PropNode>()
  for (const key of keys) {
    const present = objs.filter((o) => o.props.has(key))
    const nodes = present.map((o) => (o.props.get(key) as PropNode).node)
    const optional =
      present.length < objs.length || present.some((o) => (o.props.get(key) as PropNode).optional)
    props.set(key, { node: mergeAll(nodes, union), optional })
  }
  return { k: 'obj', props }
}

function mergeArrs(arrs: ArrNode[], union: boolean): Node {
  const items = arrs.map((a) => a.item).filter((x): x is Node => x !== null)
  return { k: 'arr', item: items.length ? mergeAll(items, union) : null }
}

/**
 * `union` off means no `a | b` is ever emitted. Genuinely mixed values then widen
 * to `unknown` — narrowing to the first member seen would emit a type that lies
 * about the sample.
 */
function mergeAll(nodes: Node[], union: boolean): Node {
  const flat: Node[] = []
  const push = (n: Node) => {
    if (n.k === 'union') n.of.forEach(push)
    else flat.push(n)
  }
  nodes.forEach(push)
  if (flat.length === 0) return UNKNOWN

  const objs = flat.filter((n): n is ObjNode => n.k === 'obj')
  const arrs = flat.filter((n): n is ArrNode => n.k === 'arr')

  const out: Node[] = []
  const seen = new Set<string>()
  for (const n of flat) {
    const g = kindKey(n)
    if (seen.has(g)) continue
    seen.add(g)
    if (n.k === 'obj') out.push(mergeObjs(objs, union))
    else if (n.k === 'arr') out.push(mergeArrs(arrs, union))
    else out.push(n)
  }
  if (out.length === 1) return out[0]
  return union ? { k: 'union', of: out } : UNKNOWN
}

const hasNull = (n: Node): boolean =>
  (n.k === 'prim' && n.t === 'null') ||
  (n.k === 'union' && n.of.some((x) => x.k === 'prim' && x.t === 'null'))

function stripNull(n: Node): Node {
  if (n.k !== 'union') return n
  const of = n.of.filter((x) => !(x.k === 'prim' && x.t === 'null'))
  if (of.length === 0) return { k: 'prim', t: 'null' }
  return of.length === 1 ? of[0] : { k: 'union', of }
}

/* ------------------------------------------------------------------ *
 * Naming / identifier helpers (code-point safe)
 * ------------------------------------------------------------------ */

const IDENT_RE = /^[$_\p{ID_Start}][$\p{ID_Continue}]*$/u

const escapeKey = (k: string) =>
  Array.from(k)
    .map((c) => {
      if (c === '\\') return '\\\\'
      if (c === "'") return "\\'"
      if (c === '\n') return '\\n'
      if (c === '\r') return '\\r'
      if (c === '\t') return '\\t'
      const code = c.codePointAt(0) as number
      if (code < 0x20 || code === 0x7f) return `\\u${code.toString(16).padStart(4, '0')}`
      return c
    })
    .join('')

const propKey = (k: string) => (IDENT_RE.test(k) ? k : `'${escapeKey(k)}'`)

function pascal(s: string): string {
  const words = String(s ?? '').split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  const name = words
    .map((w) => {
      const cps = Array.from(w)
      return cps[0].toUpperCase() + cps.slice(1).join('')
    })
    .join('')
  if (!name) return ''
  return /^\p{Nd}/u.test(name) ? `_${name}` : name
}

function singularize(s: string): string {
  const t = String(s ?? '').trim()
  if (/[^aeiou]ies$/i.test(t)) return `${t.slice(0, -3)}y`
  if (/(ch|sh|ss|x|z|s)es$/i.test(t)) return t.slice(0, -2)
  if (/[^su]s$/i.test(t)) return t.slice(0, -1)
  return t
}

/* ------------------------------------------------------------------ *
 * Declaration emitter
 * ------------------------------------------------------------------ */

type Options = {
  rootName: string
  style: 'interface' | 'type'
  optionalNulls: boolean
  readonlyProps: boolean
}

type Decl = { name: string; body: string; alias?: string; dropped?: boolean }

/** Bodies are either '' or a run of two-space indented lines, so this can never collide. */
const ROOT_PLACEHOLDER = '@@root-placeholder@@'

function generate(root: Node, opts: Options): string {
  const decls: Decl[] = []
  const reserved = new Map<string, string>()

  function buildBody(node: ObjNode): string {
    const lines: string[] = []
    for (const [key, prop] of node.props) {
      let t = prop.node
      let optional = prop.optional
      if (opts.optionalNulls && hasNull(t)) {
        optional = true
        t = stripNull(t)
      }
      const ro = opts.readonlyProps ? 'readonly ' : ''
      lines.push(`  ${ro}${propKey(key)}${optional ? '?' : ''}: ${render(t, key)};`)
    }
    return lines.join('\n')
  }

  function declareObj(node: ObjNode, hint: string): string {
    const slot = decls.length
    decls.push({ name: '', body: '' })
    const body = buildBody(node)
    const base = pascal(hint) || 'Item'
    let name = base
    let n = 1
    for (;;) {
      const prev = reserved.get(name)
      if (prev === undefined) break
      if (prev === body) {
        decls[slot].dropped = true
        return name
      }
      n += 1
      name = `${base}${n}`
    }
    reserved.set(name, body)
    decls[slot] = { name, body }
    return name
  }

  function render(node: Node, hint: string): string {
    if (node.k === 'prim') return node.t
    if (node.k === 'obj') return declareObj(node, hint)
    if (node.k === 'arr') {
      if (!node.item) return 'unknown[]'
      const item = node.item
      const inner = render(item, singularize(hint))
      // Only a *top-level* union needs parentheses — `(a | b)[][]`, not `((a | b)[])[]`.
      const isTopLevelUnion = item.k === 'union' && inner.includes(' | ')
      return isTopLevelUnion ? `(${inner})[]` : `${inner}[]`
    }
    const parts: string[] = []
    for (const member of node.of) {
      const s = render(member, hint)
      if (!parts.includes(s)) parts.push(s)
    }
    return parts.join(' | ')
  }

  const rootBase = pascal(opts.rootName) || 'Root'
  reserved.set(rootBase, ROOT_PLACEHOLDER)
  const slot = decls.length
  decls.push({ name: rootBase, body: '' })

  if (root.k === 'obj') {
    const body = buildBody(root)
    reserved.set(rootBase, body)
    decls[slot].body = body
  } else {
    let hint = opts.rootName
    if (root.k === 'arr') {
      const singular = singularize(opts.rootName)
      hint = pascal(singular) === rootBase ? `${opts.rootName} item` : singular
    }
    decls[slot].alias = render(root, hint)
  }

  return decls
    .filter((d) => !d.dropped)
    .map((d) => {
      if (d.alias !== undefined) return `export type ${d.name} = ${d.alias};`
      if (!d.body) {
        return opts.style === 'type' ? `export type ${d.name} = {};` : `export interface ${d.name} {}`
      }
      return opts.style === 'type'
        ? `export type ${d.name} = {\n${d.body}\n};`
        : `export interface ${d.name} {\n${d.body}\n}`
    })
    .join('\n\n')
}

/* ------------------------------------------------------------------ *
 * Input handling
 * ------------------------------------------------------------------ */

function readJson(input: unknown): { empty: boolean; value: unknown } {
  if (input === null || input === undefined) return { empty: true, value: undefined }
  let text: string
  if (isBytes(input)) text = new TextDecoder().decode(input as Uint8Array)
  else if (typeof input === 'object') return { empty: false, value: input }
  else text = String(input)
  if (text.trim() === '') return { empty: true, value: undefined }
  try {
    return { empty: false, value: JSON.parse(text) }
  } catch (e) {
    throw new Error(`invalid JSON: ${(e as Error).message}`)
  }
}

const util: Utility = {
  id: 'json_to_typescript',
  name: 'json to typescript',
  category: 'Data Formats',
  description:
    'Infer TypeScript declarations from a JSON sample, with a custom root name, interface or type style, nullable properties made optional, readonly properties, and unions for mixed arrays.',
  accepts: ['string', 'json'],
  produces: 'string',
  tags: ['typescript', 'interface', 'type', 'infer types', 'codegen', 'json to types'],
  examples: [
    {
      title: 'infer an interface from a sample',
      input: '{"id":1,"name":"Ada","tags":["core","dev"],"active":true}',
      output:
        'export interface Root {\n  id: number;\n  name: string;\n  tags: string[];\n  active: boolean;\n}',
    },
  ],
  params: {
    rootName: { kind: 'string', label: 'root name', default: 'Root' },
    style: { kind: 'select', label: 'style', options: ['interface', 'type'], default: 'interface' },
    optionalNulls: { kind: 'boolean', label: 'nulls optional', default: true },
    readonlyProps: { kind: 'boolean', label: 'readonly props', default: false },
    arrayUnion: { kind: 'boolean', label: 'union mixed arrays', default: true },
  },
  apply: (input: any, params: any) => {
    const { empty, value } = readJson(input)
    if (empty) return ''

    return generate(infer(value, params?.arrayUnion !== false), {
      rootName: String(params?.rootName ?? 'Root').trim() || 'Root',
      style: params?.style === 'type' ? 'type' : 'interface',
      optionalNulls: params?.optionalNulls !== false,
      readonlyProps: params?.readonlyProps === true,
    })
  },
}

export default util
