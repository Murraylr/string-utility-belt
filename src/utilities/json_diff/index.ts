import type { Utility } from '@/types/utility'

/* ------------------------------------------------------------------ *
 * Structural diff of two JSON documents.
 *   summary     → a JSON object describing added / removed / changed
 *   json-patch  → an RFC 6902 patch that turns the input into `other`
 *   unified     → a unified line diff of the two pretty-printed docs
 * ------------------------------------------------------------------ */

type Key = string | number

type Change =
  | { op: 'add'; path: Key[]; value: unknown }
  | { op: 'remove'; path: Key[]; value: unknown }
  | { op: 'replace'; path: Key[]; from: unknown; to: unknown }

const FORMATS = ['summary', 'json-patch', 'unified']
const OTHER_DEFAULT = '{}'

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)

const hasOwn = (o: object, k: string): boolean =>
  Object.prototype.hasOwnProperty.call(o, k)

export function deepEqual(a: unknown, b: unknown): boolean {
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
    if (!hasOwn(bo, k)) return false
    if (!deepEqual(ao[k], bo[k])) return false
  }
  return true
}

/** `$.a.b[0]` — human-readable, used by the summary format. */
export const jsonPath = (p: Key[]): string =>
  '$' +
  p
    .map((k) => {
      if (typeof k === 'number') return `[${k}]`
      if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k)) return `.${k}`
      return `['${k.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
    })
    .join('')

/** RFC 6901 JSON Pointer — used by the json-patch format. */
export const jsonPointer = (p: Key[]): string =>
  p.length === 0
    ? ''
    : '/' + p.map((k) => String(k).replace(/~/g, '~0').replace(/\//g, '~1')).join('/')

export function diffValues(a: unknown, b: unknown, path: Key[], out: Change[]): void {
  if (deepEqual(a, b)) return

  if (isObj(a) && isObj(b)) {
    for (const k of Object.keys(a)) {
      if (!hasOwn(b, k)) out.push({ op: 'remove', path: [...path, k], value: a[k] })
      else diffValues(a[k], b[k], [...path, k], out)
    }
    for (const k of Object.keys(b)) {
      if (!hasOwn(a, k)) out.push({ op: 'add', path: [...path, k], value: b[k] })
    }
    return
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const shared = Math.min(a.length, b.length)
    for (let k = 0; k < shared; k++) diffValues(a[k], b[k], [...path, k], out)
    // descending, so applying the patch sequentially stays in bounds
    for (let k = a.length - 1; k >= b.length; k--) {
      out.push({ op: 'remove', path: [...path, k], value: a[k] })
    }
    for (let k = a.length; k < b.length; k++) {
      out.push({ op: 'add', path: [...path, k], value: b[k] })
    }
    return
  }

  out.push({ op: 'replace', path: [...path], from: a, to: b })
}

/* ------------------------------ unified diff ------------------------------ */

type LineOp = { t: ' ' | '-' | '+'; line: string }

function lineOps(a: string[], b: string[]): LineOp[] {
  const ops: LineOp[] = []
  let s = 0
  while (s < a.length && s < b.length && a[s] === b[s]) s++
  let ea = a.length
  let eb = b.length
  while (ea > s && eb > s && a[ea - 1] === b[eb - 1]) {
    ea--
    eb--
  }
  for (let i = 0; i < s; i++) ops.push({ t: ' ', line: a[i] })

  const ma = a.slice(s, ea)
  const mb = b.slice(s, eb)
  const m = ma.length
  const n = mb.length

  if (m === 0 || n === 0 || m * n > 1000000) {
    for (const l of ma) ops.push({ t: '-', line: l })
    for (const l of mb) ops.push({ t: '+', line: l })
  } else {
    const w = n + 1
    const dp = new Uint32Array((m + 1) * w)
    for (let i = m - 1; i >= 0; i--) {
      for (let j = n - 1; j >= 0; j--) {
        dp[i * w + j] =
          ma[i] === mb[j]
            ? dp[(i + 1) * w + (j + 1)] + 1
            : Math.max(dp[(i + 1) * w + j], dp[i * w + (j + 1)])
      }
    }
    let i = 0
    let j = 0
    while (i < m && j < n) {
      if (ma[i] === mb[j]) {
        ops.push({ t: ' ', line: ma[i] })
        i++
        j++
      } else if (dp[(i + 1) * w + j] >= dp[i * w + (j + 1)]) {
        ops.push({ t: '-', line: ma[i] })
        i++
      } else {
        ops.push({ t: '+', line: mb[j] })
        j++
      }
    }
    while (i < m) {
      ops.push({ t: '-', line: ma[i] })
      i++
    }
    while (j < n) {
      ops.push({ t: '+', line: mb[j] })
      j++
    }
  }

  for (let i = ea; i < a.length; i++) ops.push({ t: ' ', line: a[i] })
  return ops
}

export function unifiedDiff(
  aText: string,
  bText: string,
  aLabel: string,
  bLabel: string,
  context = 3
): string {
  const ops = lineOps(aText.split('\n'), bText.split('\n'))
  if (!ops.some((o) => o.t !== ' ')) return ''

  const aNo: number[] = []
  const bNo: number[] = []
  let al = 1
  let bl = 1
  for (const o of ops) {
    aNo.push(al)
    bNo.push(bl)
    if (o.t === ' ') {
      al++
      bl++
    } else if (o.t === '-') al++
    else bl++
  }

  const ranges: Array<[number, number]> = []
  for (let i = 0; i < ops.length; i++) {
    if (ops[i].t === ' ') continue
    const s = Math.max(0, i - context)
    const e = Math.min(ops.length - 1, i + context)
    const last = ranges[ranges.length - 1]
    if (last && s <= last[1] + 1) last[1] = Math.max(last[1], e)
    else ranges.push([s, e])
  }

  const out: string[] = [`--- ${aLabel}`, `+++ ${bLabel}`]
  for (const [s, e] of ranges) {
    let aCount = 0
    let bCount = 0
    for (let i = s; i <= e; i++) {
      if (ops[i].t !== '+') aCount++
      if (ops[i].t !== '-') bCount++
    }
    const aStart = aCount === 0 ? aNo[s] - 1 : aNo[s]
    const bStart = bCount === 0 ? bNo[s] - 1 : bNo[s]
    out.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`)
    for (let i = s; i <= e; i++) out.push(ops[i].t + ops[i].line)
  }
  return out.join('\n')
}

/* ------------------------------ utility ------------------------------ */

const pretty = (v: unknown): string => JSON.stringify(v, null, 2) ?? 'null'

function parseDoc(text: string, label: string): unknown {
  const t = text.replace(/^\uFEFF/, '').trim()
  if (t === '') return null
  try {
    return JSON.parse(t)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    throw new Error(`json diff: ${label} is not valid JSON — ${reason}`)
  }
}

const util: Utility = {
  id: 'json_diff',
  name: 'json diff',
  category: 'Analysis',
  description:
    'Structurally compare the input JSON with a second document, reporting an added/removed/changed summary, an RFC 6902 JSON Patch, or a unified diff.',
  accepts: 'string',
  produces: ['json', 'string'],
  tags: ['compare json', 'json patch', 'rfc 6902', 'diff objects', 'deep diff', 'structural diff'],
  aliases: ['jsondiff'],
  params: {
    other: {
      kind: 'file',
      label: 'compare with',
      default: OTHER_DEFAULT,
      accept: '.json',
      as: 'text'
    },
    format: {
      kind: 'select',
      label: 'format',
      options: ['summary', 'json-patch', 'unified'],
      default: 'summary'
    }
  },
  examples: [
    {
      title: 'a changed and an added key',
      input: '{"a":1,"b":2}',
      params: { other: '{"a":1,"b":3,"c":4}', format: 'summary' },
      output: JSON.stringify(
        {
          equal: false,
          counts: { added: 1, removed: 0, changed: 1, total: 2 },
          added: [{ path: '$.c', value: 4 }],
          removed: [],
          changed: [{ path: '$.b', from: 2, to: 3 }]
        },
        null,
        2
      )
    }
  ],
  apply: (input: any, { other, format }: any) => {
    const leftText = typeof input === 'string' ? input : String(input ?? '')
    // An absent param must behave like the declared default (`{}`); only an
    // explicitly cleared field means "an empty document".
    const rightText =
      other === undefined || other === null
        ? OTHER_DEFAULT
        : typeof other === 'string'
          ? other
          : String(other)
    const rawFmt = String(format ?? 'summary')
    const fmt = FORMATS.includes(rawFmt) ? rawFmt : 'summary'

    const left = parseDoc(leftText, 'the input')
    const right = parseDoc(rightText, 'the "compare with" document')

    if (fmt === 'unified') {
      return unifiedDiff(pretty(left), pretty(right), 'input', 'compare-with', 3)
    }

    const changes: Change[] = []
    diffValues(left, right, [], changes)

    if (fmt === 'json-patch') {
      const patch = changes.map((c) => {
        if (c.op === 'remove') return { op: 'remove', path: jsonPointer(c.path) }
        if (c.op === 'add') return { op: 'add', path: jsonPointer(c.path), value: c.value }
        return { op: 'replace', path: jsonPointer(c.path), value: c.to }
      })
      return JSON.stringify(patch, null, 2)
    }

    const added = changes
      .filter((c) => c.op === 'add')
      .map((c) => ({ path: jsonPath(c.path), value: (c as { value: unknown }).value }))
    const removed = changes
      .filter((c) => c.op === 'remove')
      .map((c) => ({ path: jsonPath(c.path), value: (c as { value: unknown }).value }))
    const changed = changes
      .filter((c) => c.op === 'replace')
      .map((c) => {
        const r = c as { from: unknown; to: unknown }
        return { path: jsonPath(c.path), from: r.from, to: r.to }
      })

    return {
      equal: changes.length === 0,
      counts: {
        added: added.length,
        removed: removed.length,
        changed: changed.length,
        total: changes.length
      },
      added,
      removed,
      changed
    }
  }
}

export default util
