import { describe, it, expect } from 'vitest'
import util from './index'

const summary = async (input: string, other: string) =>
  (await util.apply(input, { other, format: 'summary' })) as Record<string, any>

const patch = async (input: string, other: string) =>
  JSON.parse(String(await util.apply(input, { other, format: 'json-patch' })))

/** A minimal RFC 6902 applier, so the emitted patch is checked by using it. */
function applyPatch(doc: unknown, ops: Array<Record<string, any>>): unknown {
  let root = doc
  for (const op of ops) {
    const parts: string[] =
      op.path === ''
        ? []
        : op.path
            .split('/')
            .slice(1)
            .map((t: string) => t.replace(/~1/g, '/').replace(/~0/g, '~'))
    if (parts.length === 0) {
      root = op.op === 'remove' ? undefined : op.value
      continue
    }
    let cur: any = root
    for (let k = 0; k < parts.length - 1; k++) {
      cur = Array.isArray(cur) ? cur[Number(parts[k])] : cur[parts[k]]
    }
    const last = parts[parts.length - 1]
    if (Array.isArray(cur)) {
      const idx = Number(last)
      if (op.op === 'remove') cur.splice(idx, 1)
      else if (op.op === 'add') cur.splice(idx, 0, op.value)
      else cur[idx] = op.value
    } else if (op.op === 'remove') {
      delete cur[last]
    } else {
      cur[last] = op.value
    }
  }
  return root
}

describe('json_diff', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_diff')
    expect(util.name).toBe('json diff')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['json', 'string'])
    expect(Object.keys(util.params).sort()).toEqual(['format', 'other'])
  })

  it('summarises added, removed and changed values as a real object', async () => {
    const out = await summary('{"a":1,"b":2,"d":{"x":1}}', '{"a":1,"b":3,"c":4,"d":{"x":2}}')
    expect(typeof out).toBe('object')
    expect(out.equal).toBe(false)
    expect(out.counts).toEqual({ added: 1, removed: 0, changed: 2, total: 3 })
    expect(out.added).toEqual([{ path: '$.c', value: 4 }])
    expect(out.changed).toEqual([
      { path: '$.b', from: 2, to: 3 },
      { path: '$.d.x', from: 1, to: 2 }
    ])
  })

  it('reports equal documents, ignoring key order and formatting', async () => {
    const out = await summary('{"a":1,"b":[1,2]}', '{ "b" : [1, 2],\n "a": 1 }')
    expect(out.equal).toBe(true)
    expect(out.counts).toEqual({ added: 0, removed: 0, changed: 0, total: 0 })
    expect(out.added).toEqual([])
    expect(out.removed).toEqual([])
    expect(out.changed).toEqual([])
  })

  it('diffs arrays element-wise, including removals', async () => {
    const out = await summary('[1,2,3]', '[1,5]')
    expect(out.changed).toEqual([{ path: '$[1]', from: 2, to: 5 }])
    expect(out.removed).toEqual([{ path: '$[2]', value: 3 }])
    expect(await patch('[1,2,3]', '[1,5]')).toEqual([
      { op: 'replace', path: '/1', value: 5 },
      { op: 'remove', path: '/2' }
    ])
    expect(await patch('[1]', '[1,2,3]')).toEqual([
      { op: 'add', path: '/1', value: 2 },
      { op: 'add', path: '/2', value: 3 }
    ])
  })

  it('emits an RFC 6902 patch with escaped JSON pointers', async () => {
    expect(await patch('{"a":1,"b":2,"d":{"x":1}}', '{"a":1,"b":3,"c":4,"d":{"x":2}}')).toEqual([
      { op: 'replace', path: '/b', value: 3 },
      { op: 'replace', path: '/d/x', value: 2 },
      { op: 'add', path: '/c', value: 4 }
    ])
    expect(await patch('{"a/b":1,"~x":2}', '{"a/b":9,"~x":2}')).toEqual([
      { op: 'replace', path: '/a~1b', value: 9 }
    ])
    expect(await patch('{"a":1}', '{"a":1}')).toEqual([])
    // odd keys stay readable in the summary format too
    const out = await summary('{"a/b":1}', '{"a/b":9}')
    expect(out.changed[0].path).toBe("$['a/b']")
  })

  it('emits a patch that actually transforms the input into the other document', async () => {
    const cases: Array<[string, string]> = [
      ['{"a":1,"b":[1,2,3],"c":{"d":1}}', '{"a":2,"b":[1],"e":true}'],
      // array removals must come out in descending index order to stay in bounds
      ['[1,2,3,4]', '[1,9]'],
      ['[1]', '[1,2,3]'],
      ['{"a":{"b":[{"c":1},{"c":2}]}}', '{"a":{"b":[{"c":1}]}}'],
      ['{"x/y":1,"z~w":[1,2]}', '{"x/y":2,"z~w":[1,2,3]}'],
      ['{"k":"café 😀"}', '{"k":"café 🙃","n":null}'],
      ['{"a":1}', '[1,2]']
    ]
    for (const [a, b] of cases) {
      expect(applyPatch(JSON.parse(a), await patch(a, b))).toEqual(JSON.parse(b))
    }
  })

  it('produces a unified diff of the pretty-printed documents', async () => {
    expect(await util.apply('{"a":1,"b":2}', { other: '{"a":1,"b":3}', format: 'unified' })).toBe(
      ['--- input', '+++ compare-with', '@@ -1,4 +1,4 @@', ' {', '   "a": 1,', '-  "b": 2', '+  "b": 3', ' }'].join('\n')
    )
    // identical documents produce no diff, even if their formatting differs
    expect(await util.apply('{"a":1}', { other: '{ "a":   1 }', format: 'unified' })).toBe('')
  })

  it('preserves unicode, including astral characters, in both directions', async () => {
    const out = await summary('{"k":"café 😀"}', '{"k":"café 🙃"}')
    expect(out.changed).toEqual([{ path: '$.k', from: 'café 😀', to: 'café 🙃' }])
    const uni = await summary('{"日本":1}', '{"日本":1,"🚀":2}')
    expect(uni.added).toEqual([{ path: "$['🚀']", value: 2 }])
    expect(String(await util.apply('["😀"]', { other: '["🙃"]', format: 'unified' })))
      .toContain('+  "🙃"')
  })

  it('does not throw on empty input', async () => {
    const out = await summary('', '{}')
    expect(out.equal).toBe(false)
    expect(out.changed).toEqual([{ path: '$', from: null, to: {} }])
    const both = await summary('', '')
    expect(both.equal).toBe(true)
    expect(await util.apply('', { other: '', format: 'unified' })).toBe('')
  })

  it('falls back to the declared "{}" default when "compare with" is omitted', async () => {
    const out = (await util.apply('{"a":1}', {})) as Record<string, any>
    expect(out.equal).toBe(false)
    expect(out.counts).toEqual({ added: 0, removed: 1, changed: 0, total: 1 })
    expect(out.removed).toEqual([{ path: '$.a', value: 1 }])
    // an explicitly cleared field still means "an empty document", not "{}"
    const cleared = (await util.apply('{"a":1}', { other: '' })) as Record<string, any>
    expect(cleared.changed).toEqual([{ path: '$', from: { a: 1 }, to: null }])
    // and the declared default matches what apply() falls back to
    expect((util.params.other as { default: string }).default).toBe('{}')
  })

  it('declares "compare with" as a file param, still a plain string value', async () => {
    expect(util.params.other.kind).toBe('file')
    expect((util.params.other as { as?: string }).as).toBe('text')
    // whether the value came from typing or from a loaded file, it is a string
    const out = (await util.apply('{"a":1}', { other: '{"a":2}' })) as Record<string, any>
    expect(out.counts.changed).toBe(1)
  })

  it('defaults to the summary format and ignores unknown format values', async () => {
    const plain = (await util.apply('{"a":1}', { other: '{"a":2}' })) as Record<string, any>
    expect(plain.counts.changed).toBe(1)
    const weird = (await util.apply('{"a":1}', { other: '{"a":2}', format: 'nope' })) as Record<
      string,
      any
    >
    expect(weird.counts.changed).toBe(1)
  })

  it('throws a clear error for either invalid document', () => {
    expect(() => util.apply('{oops}', { other: '{}' })).toThrow(/the input is not valid JSON/)
    expect(() => util.apply('{}', { other: 'nope' })).toThrow(/compare with/)
    expect(() => util.apply('{}', { other: '{}' })).not.toThrow()
  })

  it('detects type changes and nested structure changes', async () => {
    const out = await summary('{"a":{"b":1}}', '{"a":[1]}')
    expect(out.changed).toEqual([{ path: '$.a', from: { b: 1 }, to: [1] }])
    const nested = await summary('{"a":{"b":{"c":1}}}', '{"a":{"b":{}}}')
    expect(nested.removed).toEqual([{ path: '$.a.b.c', value: 1 }])
    expect(nested.counts.removed).toBe(1)
  })
})
