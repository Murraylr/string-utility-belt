import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

const DRAFT_07 = 'http://json-schema.org/draft-07/schema#'

/* ------------------------------------------------------------------ *
 * Inferred shape tree
 * ------------------------------------------------------------------ */

type PrimType = 'string' | 'number' | 'integer' | 'boolean' | 'null'
type PropNode = { node: Node; optional: boolean }

type Node =
  | { k: 'prim'; t: PrimType; ex: unknown }
  | { k: 'arr'; item: Node | null }
  | { k: 'obj'; props: Map<string, PropNode> }
  | { k: 'union'; of: Node[] }

type PrimNode = Extract<Node, { k: 'prim' }>
type ObjNode = Extract<Node, { k: 'obj' }>
type ArrNode = Extract<Node, { k: 'arr' }>

function infer(v: unknown): Node {
  if (Array.isArray(v)) {
    const members = v.map(infer)
    return { k: 'arr', item: members.length ? mergeAll(members) : null }
  }
  if (v !== null && typeof v === 'object') {
    const props = new Map<string, PropNode>()
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      props.set(key, { node: infer(val), optional: false })
    }
    return { k: 'obj', props }
  }
  if (v === null) return { k: 'prim', t: 'null', ex: null }
  if (typeof v === 'number') {
    return { k: 'prim', t: Number.isInteger(v) ? 'integer' : 'number', ex: v }
  }
  if (typeof v === 'boolean') return { k: 'prim', t: 'boolean', ex: v }
  return { k: 'prim', t: 'string', ex: typeof v === 'string' ? v : String(v) }
}

function mergeObjs(objs: ObjNode[]): Node {
  const keys: string[] = []
  for (const o of objs) for (const k of o.props.keys()) if (!keys.includes(k)) keys.push(k)
  const props = new Map<string, PropNode>()
  for (const key of keys) {
    const present = objs.filter((o) => o.props.has(key))
    const nodes = present.map((o) => (o.props.get(key) as PropNode).node)
    const optional =
      present.length < objs.length || present.some((o) => (o.props.get(key) as PropNode).optional)
    props.set(key, { node: mergeAll(nodes), optional })
  }
  return { k: 'obj', props }
}

function mergeArrs(arrs: ArrNode[]): Node {
  const items = arrs.map((a) => a.item).filter((x): x is Node => x !== null)
  return { k: 'arr', item: items.length ? mergeAll(items) : null }
}

/** integer is a subset of number, so a mixed sample widens to number. */
function mergePrims(prims: PrimNode[]): PrimNode[] {
  const out: PrimNode[] = []
  for (const p of prims) {
    const numeric = p.t === 'integer' || p.t === 'number'
    const twin = out.find((o) =>
      numeric ? o.t === 'integer' || o.t === 'number' : o.t === p.t
    )
    if (!twin) {
      out.push({ ...p })
      continue
    }
    if (numeric && twin.t === 'integer' && p.t === 'number') twin.t = 'number'
  }
  return out
}

function mergeAll(nodes: Node[]): Node {
  const flat: Node[] = []
  const push = (n: Node) => {
    if (n.k === 'union') n.of.forEach(push)
    else flat.push(n)
  }
  nodes.forEach(push)
  if (flat.length === 0) return { k: 'prim', t: 'null', ex: null }

  const objs = flat.filter((n): n is ObjNode => n.k === 'obj')
  const arrs = flat.filter((n): n is ArrNode => n.k === 'arr')
  const prims = mergePrims(flat.filter((n): n is PrimNode => n.k === 'prim'))

  const out: Node[] = []
  const seen = new Set<string>()
  for (const n of flat) {
    if (n.k === 'obj') {
      if (seen.has('obj')) continue
      seen.add('obj')
      out.push(mergeObjs(objs))
    } else if (n.k === 'arr') {
      if (seen.has('arr')) continue
      seen.add('arr')
      out.push(mergeArrs(arrs))
    } else if (n.k === 'prim') {
      const numeric = n.t === 'integer' || n.t === 'number'
      const slot = numeric ? 'prim:number' : `prim:${n.t}`
      if (seen.has(slot)) continue
      seen.add(slot)
      const merged = prims.find((p) =>
        numeric ? p.t === 'integer' || p.t === 'number' : p.t === n.t
      )
      out.push(merged ?? n)
    }
  }
  return out.length === 1 ? out[0] : { k: 'union', of: out }
}

/* ------------------------------------------------------------------ *
 * draft-07 rendering
 * ------------------------------------------------------------------ */

type Options = { requireAll: boolean; includeExamples: boolean }

function toSchema(node: Node, opts: Options): Record<string, unknown> {
  if (node.k === 'prim') {
    const schema: Record<string, unknown> = { type: node.t }
    if (opts.includeExamples) schema.examples = [node.ex]
    return schema
  }
  if (node.k === 'arr') {
    return { type: 'array', items: node.item ? toSchema(node.item, opts) : {} }
  }
  if (node.k === 'obj') {
    const properties: Record<string, unknown> = {}
    for (const [key, prop] of node.props) {
      // Plain assignment would hit Object.prototype's `__proto__` setter: the
      // property would vanish from the schema and re-point the object's
      // prototype instead. defineProperty always creates a real own property.
      Object.defineProperty(properties, key, {
        value: toSchema(prop.node, opts),
        enumerable: true,
        writable: true,
        configurable: true,
      })
    }
    const schema: Record<string, unknown> = { type: 'object', properties }
    if (opts.requireAll) {
      const required: string[] = []
      for (const [key, prop] of node.props) if (!prop.optional) required.push(key)
      if (required.length) schema.required = required
    }
    return schema
  }
  // union
  if (node.of.every((n) => n.k === 'prim')) {
    const prims = node.of as PrimNode[]
    const schema: Record<string, unknown> = { type: prims.map((p) => p.t) }
    if (opts.includeExamples) schema.examples = prims.map((p) => p.ex)
    return schema
  }
  return { anyOf: node.of.map((n) => toSchema(n, opts)) }
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
  id: 'json_to_schema',
  name: 'json to json schema',
  category: 'Data Formats',
  description:
    'Generate a JSON Schema (draft-07) from a JSON sample, with an optional title, every property marked required, and sample values kept as examples.',
  accepts: ['string', 'json'],
  produces: 'json',
  tags: ['json schema', 'infer schema', 'draft-07', 'generate schema', 'sample to schema'],
  examples: [
    {
      title: 'infer a schema from a sample',
      input: '{"id":1,"name":"Ada","tags":["core"],"active":true}',
      output:
        '{\n  "$schema": "http://json-schema.org/draft-07/schema#",\n  "title": "Root",\n  "type": "object",\n  "properties": {\n    "id": {\n      "type": "integer"\n    },\n    "name": {\n      "type": "string"\n    },\n    "tags": {\n      "type": "array",\n      "items": {\n        "type": "string"\n      }\n    },\n    "active": {\n      "type": "boolean"\n    }\n  },\n  "required": [\n    "id",\n    "name",\n    "tags",\n    "active"\n  ]\n}',
    },
  ],
  params: {
    title: { kind: 'string', label: 'title', default: 'Root' },
    requireAll: { kind: 'boolean', label: 'require all properties', default: true },
    includeExamples: { kind: 'boolean', label: 'include examples', default: false },
  },
  apply: (input: any, params: any) => {
    const { empty, value } = readJson(input)
    if (empty) return {}

    const title = String(params?.title ?? 'Root').trim()
    const body = toSchema(infer(value), {
      requireAll: params?.requireAll !== false,
      includeExamples: params?.includeExamples === true,
    })

    const out: Record<string, unknown> = { $schema: DRAFT_07 }
    if (title) out.title = title
    return Object.assign(out, body)
  },
}

export default util
