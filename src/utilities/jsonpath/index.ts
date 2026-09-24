import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * A hand-rolled JSONPath subset:
 *   $              root
 *   .key  ['key']  child
 *   [0] [-1]       index (negative counts from the end)
 *   [*]  .*        wildcard
 *   ..key  ..[*]   recursive descent
 *   [a:b:c]        python-style slice
 *   [0,2] ['a','b'] union
 *   [?(@.k=="v")]  filter — == != > >= < <= =~ with && || ! and ( )
 * ------------------------------------------------------------------ */

type Seg =
  | { t: 'child'; name: string }
  | { t: 'index'; index: number }
  | { t: 'wildcard' }
  | { t: 'slice'; start: number | null; end: number | null; step: number }
  | { t: 'filter'; expr: Expr }
  | { t: 'union'; items: Seg[] }
  | { t: 'descend'; sel: Seg }

type Operand =
  | { t: 'cur'; segs: Seg[] }
  | { t: 'root'; segs: Seg[] }
  | { t: 'lit'; v: unknown }
  | { t: 'regex'; re: RegExp }

type Expr =
  | { t: 'or'; a: Expr; b: Expr }
  | { t: 'and'; a: Expr; b: Expr }
  | { t: 'not'; a: Expr }
  | { t: 'cmp'; op: string; a: Operand; b: Operand }
  | { t: 'exists'; a: Operand }

type NodeRef = { path: (string | number)[]; value: unknown }

const CMP_OPS = new Set(['==', '!=', '>', '>=', '<', '<=', '=~'])

function bad(msg: string): never {
  throw new Error(`jsonpath: ${msg}`)
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const clampIndent = (v: unknown, fallback = 2): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(10, Math.max(0, Math.floor(n)))
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const ak = Object.keys(ao)
  if (ak.length !== Object.keys(bo).length) return false
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false
    if (!deepEqual(ao[k], bo[k])) return false
  }
  return true
}

/* ------------------------------ lexing helpers ------------------------------ */

function splitTopLevel(s: string, sep: string): string[] {
  const out: string[] = []
  let br = 0
  let par = 0
  let quote: string | null = null
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      cur += c
      if (c === '\\' && i + 1 < s.length) {
        cur += s[i + 1]
        i++
        continue
      }
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      cur += c
      continue
    }
    if (c === '[') br++
    else if (c === ']') br--
    else if (c === '(') par++
    else if (c === ')') par--
    if (c === sep && br === 0 && par === 0) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur)
  return out
}

function unquote(raw: string): string {
  const body = raw.slice(1, -1)
  let out = ''
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c !== '\\' || i + 1 >= body.length) {
      out += c
      continue
    }
    const nx = body[i + 1]
    i++
    switch (nx) {
      case 'n':
        out += '\n'
        break
      case 't':
        out += '\t'
        break
      case 'r':
        out += '\r'
        break
      case 'u': {
        const hex = body.slice(i + 1, i + 5)
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          out += String.fromCharCode(parseInt(hex, 16))
          i += 4
        } else {
          out += 'u'
        }
        break
      }
      default:
        out += nx
    }
  }
  return out
}

/* ------------------------------ path parsing ------------------------------ */

function parseSlice(t: string): Seg {
  const parts = t.split(':')
  if (parts.length > 3) bad(`invalid slice "${t}"`)
  const num = (raw: string | undefined, dflt: number | null): number | null => {
    const s = (raw ?? '').trim()
    if (s === '') return dflt
    if (!/^[+-]?\d+$/.test(s)) bad(`invalid slice bound "${s}"`)
    return parseInt(s, 10)
  }
  const step = num(parts[2], 1) ?? 1
  if (step === 0) bad('slice step cannot be 0')
  return { t: 'slice', start: num(parts[0], null), end: num(parts[1], null), step }
}

function parseSingleSelector(t: string): Seg {
  if (t === '*') return { t: 'wildcard' }
  const q = t[0]
  if ((q === "'" || q === '"') && t.length >= 2 && t[t.length - 1] === q) {
    return { t: 'child', name: unquote(t) }
  }
  if (t.includes(':')) return parseSlice(t)
  if (/^[+-]?\d+$/.test(t)) return { t: 'index', index: parseInt(t, 10) }
  return { t: 'child', name: t }
}

function parseBracketContent(content: string): Seg {
  const c = content.trim()
  if (c === '') bad('empty [] selector')
  if (c === '*') return { t: 'wildcard' }
  if (c[0] === '?') return { t: 'filter', expr: parseFilter(c.slice(1)) }
  const parts = splitTopLevel(c, ',')
    .map((x) => x.trim())
    .filter((x) => x !== '')
  if (parts.length === 0) bad('empty [] selector')
  if (parts.length === 1) return parseSingleSelector(parts[0])
  return { t: 'union', items: parts.map(parseSingleSelector) }
}

export function parsePath(path: string): Seg[] {
  const p = path.trim()
  if (p === '') bad('the path is empty')
  const segs: Seg[] = []
  let i = 0
  let hadRoot = false
  if (p[0] === '$' || p[0] === '@') {
    hadRoot = true
    i = 1
  }

  const readName = (): string => {
    const start = i
    while (i < p.length && p[i] !== '.' && p[i] !== '[' && p[i] !== ']') i++
    const name = p.slice(start, i).trim()
    if (name === '') bad(`expected a property name at position ${start}`)
    return name
  }

  const readBracket = (): Seg => {
    const open = i
    i++
    let br = 1
    let par = 0
    let quote: string | null = null
    const contentStart = i
    while (i < p.length) {
      const c = p[i]
      if (quote) {
        if (c === '\\') {
          i += 2
          continue
        }
        if (c === quote) quote = null
        i++
        continue
      }
      if (c === '"' || c === "'") {
        quote = c
        i++
        continue
      }
      if (c === '(') par++
      else if (c === ')') par--
      else if (c === '[') br++
      else if (c === ']') {
        br--
        if (br === 0 && par === 0) break
      }
      i++
    }
    if (i >= p.length) bad(`unterminated "[" at position ${open}`)
    const content = p.slice(contentStart, i)
    i++
    return parseBracketContent(content)
  }

  while (i < p.length) {
    if (p[i] === '.' && p[i + 1] === '.') {
      i += 2
      let sel: Seg
      if (p[i] === '[') sel = readBracket()
      else if (p[i] === '*') {
        i++
        sel = { t: 'wildcard' }
      } else sel = { t: 'child', name: readName() }
      segs.push({ t: 'descend', sel })
      continue
    }
    if (p[i] === '.') {
      i++
      if (p[i] === '*') {
        i++
        segs.push({ t: 'wildcard' })
        continue
      }
      segs.push({ t: 'child', name: readName() })
      continue
    }
    if (p[i] === '[') {
      segs.push(readBracket())
      continue
    }
    if (!hadRoot && segs.length === 0) {
      segs.push({ t: 'child', name: readName() })
      continue
    }
    bad(`unexpected "${p[i]}" at position ${i}`)
  }
  return segs
}

/* ------------------------------ filter parsing ------------------------------ */

type Tok =
  // `bare` marks an unquoted word (`fiction`), which is usable as the right-hand
  // side of a comparison but is never a valid test on its own.
  | { k: 'path'; root: boolean; segs: Seg[] }
  | { k: 'lit'; v: unknown; bare?: boolean }
  | { k: 'regex'; re: RegExp }
  | { k: 'op'; v: string }
  | { k: 'lparen' }
  | { k: 'rparen' }

const NAME_STOP = /[\s.[\]()=!<>&|,~]/
const NUM_TOK = /-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/y
const WORD_TOK = /[^\s()&|=!<>,]+/y
const MULTI_OPS = ['===', '!==', '==', '!=', '>=', '<=', '=~', '&&', '||']

function tokenizeFilter(s: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  while (i < s.length) {
    const c = s[i]
    if (/\s/.test(c)) {
      i++
      continue
    }
    if (c === '(') {
      toks.push({ k: 'lparen' })
      i++
      continue
    }
    if (c === ')') {
      toks.push({ k: 'rparen' })
      i++
      continue
    }
    if (c === '@' || c === '$') {
      const start = i
      i++
      for (;;) {
        if (s[i] === '.') {
          i++
          if (s[i] === '.') i++
          if (s[i] === '*') {
            i++
            continue
          }
          while (i < s.length && !NAME_STOP.test(s[i])) i++
          continue
        }
        if (s[i] === '[') {
          let br = 0
          let quote: string | null = null
          for (; i < s.length; i++) {
            const ch = s[i]
            if (quote) {
              if (ch === '\\') i++
              else if (ch === quote) quote = null
              continue
            }
            if (ch === '"' || ch === "'") {
              quote = ch
              continue
            }
            if (ch === '[') br++
            else if (ch === ']') {
              br--
              if (br === 0) {
                i++
                break
              }
            }
          }
          continue
        }
        break
      }
      const raw = s.slice(start, i)
      toks.push({ k: 'path', root: raw[0] === '$', segs: parsePath(raw) })
      continue
    }
    if (c === "'" || c === '"') {
      const start = i
      i++
      while (i < s.length && s[i] !== c) {
        if (s[i] === '\\') i++
        i++
      }
      if (i >= s.length) bad('unterminated string in filter expression')
      i++
      toks.push({ k: 'lit', v: unquote(s.slice(start, i)) })
      continue
    }
    if (c === '/') {
      const start = i
      i++
      while (i < s.length && s[i] !== '/') {
        if (s[i] === '\\') i++
        i++
      }
      if (i >= s.length) bad('unterminated regular expression in filter expression')
      const body = s.slice(start + 1, i)
      i++
      let flags = ''
      while (i < s.length && /[dgimsuvy]/.test(s[i])) {
        flags += s[i]
        i++
      }
      try {
        toks.push({ k: 'regex', re: new RegExp(body, flags) })
      } catch {
        bad(`invalid regular expression /${body}/${flags}`)
      }
      continue
    }
    const next = s[i + 1] ?? ''
    if (/\d/.test(c) || ((c === '-' || c === '.') && /\d/.test(next))) {
      NUM_TOK.lastIndex = i
      const m = NUM_TOK.exec(s)
      if (m && m[0].length > 0) {
        i += m[0].length
        toks.push({ k: 'lit', v: Number(m[0]) })
        continue
      }
    }
    let matched = ''
    for (const op of MULTI_OPS) {
      if (s.startsWith(op, i)) {
        matched = op
        break
      }
    }
    if (matched !== '') {
      i += matched.length
      const v = matched === '===' ? '==' : matched === '!==' ? '!=' : matched
      toks.push({ k: 'op', v })
      continue
    }
    if (c === '>' || c === '<' || c === '!') {
      toks.push({ k: 'op', v: c })
      i++
      continue
    }
    WORD_TOK.lastIndex = i
    const wm = WORD_TOK.exec(s)
    if (!wm || wm[0].length === 0) bad(`unexpected "${c}" in filter expression`)
    i += wm[0].length
    const word = wm[0]
    if (word === 'true') toks.push({ k: 'lit', v: true })
    else if (word === 'false') toks.push({ k: 'lit', v: false })
    else if (word === 'null') toks.push({ k: 'lit', v: null })
    else toks.push({ k: 'lit', v: word, bare: true })
  }
  return toks
}

function parseFilter(src: string): Expr {
  const toks = tokenizeFilter(src)
  if (toks.length === 0) bad('empty filter expression')
  let pos = 0

  const peek = (): Tok | undefined => toks[pos]

  function parseOperand(): Operand {
    const t = toks[pos]
    if (!t) bad('unexpected end of filter expression')
    pos++
    if (t.k === 'path') return t.root ? { t: 'root', segs: t.segs } : { t: 'cur', segs: t.segs }
    if (t.k === 'lit') return { t: 'lit', v: t.v }
    if (t.k === 'regex') return { t: 'regex', re: t.re }
    bad('expected a value in filter expression')
  }

  function parseCmp(): Expr {
    const tok = toks[pos]
    const a = parseOperand()
    const nx = peek()
    if (nx && nx.k === 'op' && CMP_OPS.has(nx.v)) {
      pos++
      return { t: 'cmp', op: nx.v, a, b: parseOperand() }
    }
    // A standalone value is not a test: `[?(price)]` used to match every node
    // silently, which hides the missing `@.`. Only `true`/`false` are meaningful.
    if (tok && tok.k === 'lit' && tok.bare) {
      bad(`"${String(tok.v)}" is not a filter test — write "@.${String(tok.v)}" to test a property`)
    }
    if (a.t === 'lit' && typeof a.v !== 'boolean') {
      bad('a filter test must be a path or a comparison, not a bare value')
    }
    if (a.t === 'regex') bad('a regular expression must be used with the "=~" operator')
    return { t: 'exists', a }
  }

  function parseUnary(): Expr {
    const nx = peek()
    if (nx && nx.k === 'op' && nx.v === '!') {
      pos++
      return { t: 'not', a: parseUnary() }
    }
    if (nx && nx.k === 'lparen') {
      pos++
      const inner = parseOr()
      const close = peek()
      if (!close || close.k !== 'rparen') bad('missing ")" in filter expression')
      pos++
      return inner
    }
    return parseCmp()
  }

  function parseAnd(): Expr {
    let left = parseUnary()
    for (;;) {
      const nx = peek()
      if (nx && nx.k === 'op' && nx.v === '&&') {
        pos++
        left = { t: 'and', a: left, b: parseUnary() }
      } else return left
    }
  }

  function parseOr(): Expr {
    let left = parseAnd()
    for (;;) {
      const nx = peek()
      if (nx && nx.k === 'op' && nx.v === '||') {
        pos++
        left = { t: 'or', a: left, b: parseAnd() }
      } else return left
    }
  }

  const expr = parseOr()
  if (pos < toks.length) bad('unexpected trailing tokens in filter expression')
  return expr
}

/* ------------------------------ evaluation ------------------------------ */

const pathKey = (p: (string | number)[]): string => JSON.stringify(p)

const normIndex = (i: number, len: number): number | null => {
  const k = i < 0 ? len + i : i
  return k >= 0 && k < len ? k : null
}

function childrenOf(node: NodeRef): NodeRef[] {
  const v = node.value
  if (Array.isArray(v)) return v.map((c, k) => ({ path: [...node.path, k], value: c }))
  if (isObj(v)) return Object.keys(v).map((k) => ({ path: [...node.path, k], value: v[k] }))
  return []
}

function childOf(node: NodeRef, name: string): NodeRef[] {
  const v = node.value
  if (Array.isArray(v)) {
    if (name === 'length') return [{ path: [...node.path, 'length'], value: v.length }]
    if (/^-?\d+$/.test(name)) {
      const idx = normIndex(parseInt(name, 10), v.length)
      if (idx !== null) return [{ path: [...node.path, idx], value: v[idx] }]
    }
    return []
  }
  if (isObj(v)) {
    return Object.prototype.hasOwnProperty.call(v, name)
      ? [{ path: [...node.path, name], value: v[name] }]
      : []
  }
  // code-point length, so an emoji counts as one character
  if (typeof v === 'string' && name === 'length') {
    return [{ path: [...node.path, 'length'], value: Array.from(v).length }]
  }
  return []
}

function sliceIndices(len: number, seg: { start: number | null; end: number | null; step: number }) {
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
  const out: number[] = []
  const abs = (x: number) => (x < 0 ? len + x : x)
  if (seg.step > 0) {
    const start = clamp(seg.start === null ? 0 : abs(seg.start), 0, len)
    const end = clamp(seg.end === null ? len : abs(seg.end), 0, len)
    for (let k = start; k < end; k += seg.step) out.push(k)
  } else {
    const start = clamp(seg.start === null ? len - 1 : abs(seg.start), -1, len - 1)
    const end = clamp(seg.end === null ? -1 : abs(seg.end), -1, len - 1)
    for (let k = start; k > end; k += seg.step) out.push(k)
  }
  return out
}

function gather(node: NodeRef, out: NodeRef[]): void {
  out.push(node)
  for (const c of childrenOf(node)) gather(c, out)
}

function dedupe(nodes: NodeRef[]): NodeRef[] {
  const seen = new Set<string>()
  const out: NodeRef[] = []
  for (const n of nodes) {
    const key = pathKey(n.path)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(n)
  }
  return out
}

function selectFrom(node: NodeRef, seg: Seg, root: unknown): NodeRef[] {
  switch (seg.t) {
    case 'child':
      return childOf(node, seg.name)
    case 'index': {
      const v = node.value
      if (!Array.isArray(v)) return []
      const idx = normIndex(seg.index, v.length)
      return idx === null ? [] : [{ path: [...node.path, idx], value: v[idx] }]
    }
    case 'wildcard':
      return childrenOf(node)
    case 'slice': {
      const v = node.value
      if (!Array.isArray(v)) return []
      return sliceIndices(v.length, seg).map((k) => ({ path: [...node.path, k], value: v[k] }))
    }
    case 'filter':
      return childrenOf(node).filter((k) => evalExpr(seg.expr, k.value, root))
    case 'union': {
      const acc: NodeRef[] = []
      for (const item of seg.items) acc.push(...selectFrom(node, item, root))
      return dedupe(acc)
    }
    case 'descend': {
      const all: NodeRef[] = []
      gather(node, all)
      const acc: NodeRef[] = []
      for (const d of all) acc.push(...selectFrom(d, seg.sel, root))
      return dedupe(acc)
    }
  }
}

type Resolved = { found: boolean; value: unknown; re?: RegExp }

function resolveOperand(op: Operand, cur: unknown, root: unknown): Resolved {
  if (op.t === 'lit') return { found: true, value: op.v }
  if (op.t === 'regex') return { found: true, value: op.re.source, re: op.re }
  let nodes: NodeRef[] = [{ path: [], value: op.t === 'root' ? root : cur }]
  for (const seg of op.segs) {
    const next: NodeRef[] = []
    for (const n of nodes) next.push(...selectFrom(n, seg, root))
    nodes = next
  }
  if (nodes.length === 0) return { found: false, value: undefined }
  return { found: true, value: nodes[0].value }
}

function toRegExp(v: unknown): RegExp | null {
  if (v instanceof RegExp) return v
  if (typeof v !== 'string') return null
  try {
    return new RegExp(v)
  } catch {
    return null
  }
}

function compare(op: string, a: Resolved, b: Resolved): boolean {
  if (op === '=~') {
    if (!a.found || typeof a.value !== 'string') return false
    const re = b.re ?? toRegExp(b.value)
    return re ? re.test(a.value) : false
  }
  if (!a.found || !b.found) return op === '!=' ? a.found !== b.found : false
  if (op === '==') return deepEqual(a.value, b.value)
  if (op === '!=') return !deepEqual(a.value, b.value)
  const av = a.value
  const bv = b.value
  let c: number
  if (typeof av === 'number' && typeof bv === 'number') c = av < bv ? -1 : av > bv ? 1 : 0
  else if (typeof av === 'string' && typeof bv === 'string') c = av < bv ? -1 : av > bv ? 1 : 0
  else return false
  if (op === '>') return c > 0
  if (op === '>=') return c >= 0
  if (op === '<') return c < 0
  return c <= 0
}

function evalExpr(e: Expr, cur: unknown, root: unknown): boolean {
  switch (e.t) {
    case 'or':
      return evalExpr(e.a, cur, root) || evalExpr(e.b, cur, root)
    case 'and':
      return evalExpr(e.a, cur, root) && evalExpr(e.b, cur, root)
    case 'not':
      return !evalExpr(e.a, cur, root)
    case 'exists': {
      const r = resolveOperand(e.a, cur, root)
      if (e.a.t === 'lit') return Boolean(r.value)
      // existence semantics: the key is present and not null
      return r.found && r.value !== undefined && r.value !== null
    }
    case 'cmp':
      return compare(e.op, resolveOperand(e.a, cur, root), resolveOperand(e.b, cur, root))
  }
}

export function jsonQuery(doc: unknown, path: string): NodeRef[] {
  let nodes: NodeRef[] = [{ path: [], value: doc }]
  for (const seg of parsePath(path)) {
    const next: NodeRef[] = []
    for (const n of nodes) next.push(...selectFrom(n, seg, doc))
    nodes = next
  }
  return nodes
}

export const formatNodePath = (p: (string | number)[]): string =>
  '$' +
  p
    .map((k) =>
      typeof k === 'number'
        ? `[${k}]`
        : `['${k.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
    )
    .join('')

const util: Utility = {
  id: 'jsonpath',
  name: 'jsonpath query',
  category: 'Data Formats',
  description:
    'Query JSON with a JSONPath subset — wildcards, recursive descent, slices, unions and filters — returning the matching values, their paths, the first match, or a count.',
  accepts: 'string',
  produces: 'string',
  tags: ['jsonpath', 'query', 'jq', 'filter json', 'json query', 'jmespath'],
  aliases: ['jq'],
  examples: [
    {
      title: 'filter expression on nested array',
      input: '{"store":{"book":[{"title":"A","price":8},{"title":"B","price":22}]}}',
      params: { path: '$..book[?(@.price < 10)].title' },
      output: '[\n  "A"\n]'
    },
    {
      title: 'count matches',
      input: '{"store":{"book":[{"title":"A","price":8},{"title":"B","price":22}]}}',
      params: { path: '$.store.book[*].price', mode: 'count' },
      output: '2'
    }
  ],
  params: {
    path: { kind: 'string', label: 'path', default: '$', placeholder: '$..book[?(@.price < 10)]' },
    mode: {
      kind: 'select',
      label: 'result',
      options: ['values', 'paths', 'first', 'count'],
      default: 'values'
    },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, { path, mode, indent }: any) => {
    // a leading BOM is invisible but would make JSON.parse reject the document
    const src = (typeof input === 'string' ? input : String(input ?? '')).replace(/^\uFEFF/, '')
    const raw = String(mode ?? 'values')
    const m = ['values', 'paths', 'first', 'count'].includes(raw) ? raw : 'values'
    const ind = clampIndent(indent)

    if (src.trim() === '') return m === 'count' ? '0' : m === 'first' ? '' : '[]'

    let doc: unknown
    try {
      doc = JSON.parse(src)
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      throw new Error(`jsonpath: input is not valid JSON — ${reason}`)
    }

    const expr = String(path ?? '').trim() || '$'
    const nodes = jsonQuery(doc, expr)

    if (m === 'count') return String(nodes.length)
    if (m === 'first') {
      if (nodes.length === 0) return ''
      const v = nodes[0].value
      if (typeof v === 'string') return v
      return JSON.stringify(v, null, ind) ?? 'null'
    }
    const payload =
      m === 'paths' ? nodes.map((n) => formatNodePath(n.path)) : nodes.map((n) => n.value)
    return JSON.stringify(payload, null, ind) ?? '[]'
  }
}

export default util
