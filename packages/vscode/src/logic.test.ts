// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  describeMarkdown, extractSharePayload, formatResult, fromDisplay, inertLinks, isLibraryExport, isUsableInNode,
  libraryEntries, orderByRecent, quarantine, targetSelections, toDisplay, unsupportedInNode, withRecent,
} from './logic'
import type { PipelineStep, Utility, UtilityMeta } from '../../../src/core'

const meta = (id: string, env: UtilityMeta['env'] = []): UtilityMeta => ({
  id, name: id, category: 'Test', description: '', accepts: 'string', produces: 'string',
  params: {}, tags: [], aliases: [], env, streamable: false, exampleCount: 0,
})

describe('isUsableInNode', () => {
  it('accepts a utility with no special requirements', () => {
    expect(isUsableInNode(meta('trim'))).toBe(true)
  })
  it('accepts wasm (Node can run WebAssembly)', () => {
    expect(isUsableInNode(meta('sha3', ['wasm']))).toBe(true)
  })
  it.each([['dom'], ['main'], ['eval']] as const)('rejects %s', (env) => {
    expect(isUsableInNode(meta('x', [env]))).toBe(false)
  })
})

describe('orderByRecent', () => {
  it('puts recent ids first, in MRU order, then the rest unchanged', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]
    expect(orderByRecent(items, ['c', 'a'])).toEqual([{ id: 'c' }, { id: 'a' }, { id: 'b' }, { id: 'd' }])
  })
  it('ignores recent ids no longer in the list', () => {
    const items = [{ id: 'a' }, { id: 'b' }]
    expect(orderByRecent(items, ['gone', 'b'])).toEqual([{ id: 'b' }, { id: 'a' }])
  })
})

describe('withRecent', () => {
  it('moves the id to the front and caps the length', () => {
    expect(withRecent(['a', 'b', 'c'], 'c', 3)).toEqual(['c', 'a', 'b'])
    expect(withRecent(['a', 'b', 'c'], 'd', 3)).toEqual(['d', 'a', 'b'])
  })
})

describe('formatResult', () => {
  it('encodes bytes as base64 and flags them binary', () => {
    const result = formatResult(new TextEncoder().encode('hi'))
    expect(result).toEqual({ text: 'aGk=', binary: true })
  })
  it('pretty-prints json', () => {
    const result = formatResult({ a: 1 })
    expect(result.binary).toBe(false)
    expect(result.text).toBe(JSON.stringify({ a: 1 }, null, 2))
  })
  it('pretty-prints a top-level JSON array', () => {
    expect(formatResult([1, { b: 2 }]).text).toBe('[\n  1,\n  {\n    "b": 2\n  }\n]')
  })
  it('passes strings through', () => {
    expect(formatResult('plain text')).toEqual({ text: 'plain text', binary: false })
  })
})

describe('extractSharePayload', () => {
  it('pulls the payload out of a #/p/ share URL', () => {
    expect(extractSharePayload('https://sub.example.com/app/#/p/N4IgLg9g')).toBe('N4IgLg9g')
  })
  it('pulls the payload out of a #/embed/ URL', () => {
    expect(extractSharePayload('https://sub.example.com/#/embed/abc123')).toBe('abc123')
  })
  it('returns a bare payload unchanged, trimmed', () => {
    expect(extractSharePayload('  N4IgLg9g\n')).toBe('N4IgLg9g')
  })
  it('drops a query string after the payload, as the app router does', () => {
    expect(extractSharePayload('https://x.dev/#/p/N4Ig+Lg9g$?utm=chat')).toBe('N4Ig+Lg9g$')
  })
  it('undoes percent-encoding a chat client may have applied', () => {
    expect(extractSharePayload('https://x.dev/#/p/N4Ig%2BLg9g%24')).toBe('N4Ig+Lg9g$')
    expect(extractSharePayload('%%%')).toBe('%%%') // malformed escapes: left as-is
  })
})

describe('unsupportedInNode', () => {
  const metas = new Map([
    ['trim', meta('trim')], ['sha3', meta('sha3', ['wasm'])], ['xml_to_json', meta('xml_to_json', ['dom'])],
    ['custom_js', meta('custom_js', ['eval', 'main'])],
  ])
  const lookup = (id: string) => metas.get(id)

  it('accepts Node-runnable steps, wasm included', () => {
    expect(unsupportedInNode([{ id: 'a', utilityId: 'trim' }, { id: 'b', utilityId: 'sha3' }], lookup)).toEqual([])
  })
  it('flags dom, eval/main and unknown utilities, nested ones included', () => {
    const steps: PipelineStep[] = [
      { id: 'm', type: 'macro', name: 'm', steps: [{ id: 'x', utilityId: 'xml_to_json' }] },
      { id: 'b', type: 'branch', merge: { mode: 'concat' }, branches: [[{ id: 'c', utilityId: 'custom_js', enabled: false }]] },
      { id: 'u', utilityId: 'nope' },
    ]
    expect(unsupportedInNode(steps, lookup)).toEqual([
      { stepId: 'x', utilityId: 'xml_to_json', reason: 'needs dom' },
      { stepId: 'c', utilityId: 'custom_js', reason: 'needs eval, main' },
      { stepId: 'u', utilityId: 'nope', reason: 'unknown utility' },
    ])
  })
})

describe('targetSelections', () => {
  const s = (isEmpty: boolean, n: number) => ({ isEmpty, n })
  it('keeps only non-empty selections when there are any', () => {
    expect(targetSelections([s(false, 1), s(true, 2), s(false, 3)]).map(x => x.n)).toEqual([1, 3])
  })
  it('returns nothing (= whole document) when every selection is a bare cursor', () => {
    expect(targetSelections([s(true, 1), s(true, 2)])).toEqual([])
  })
})

describe('toDisplay / fromDisplay', () => {
  it('shows line breaks and tabs as escapes a single-line box can hold', () => {
    expect(toDisplay('a\nb\tc\r\n')).toBe('a\\nb\\tc\\r\\n')
  })
  it('leaves ordinary text (backslashes included) alone', () => {
    expect(toDisplay('\\d+ | x')).toBe('\\d+ | x')
  })
  it('maps an untouched display value back to the original, and keeps edits verbatim', () => {
    expect(fromDisplay('\\n', '\n')).toBe('\n')
    expect(fromDisplay('; ', '\n')).toBe('; ')
    expect(fromDisplay('x', undefined)).toBe('x')
  })
})

describe('inertLinks', () => {
  it('breaks the [label](target) syntax notifications turn into links, keeping the text', () => {
    expect(inertLinks('see [docs](https://x.dev) or [run](command:foo)')).toBe('see [docs] (https://x.dev) or [run] (command:foo)')
    expect(inertLinks('plain [brackets] (spaced)')).toBe('plain [brackets] (spaced)')
  })
})

describe('libraryEntries', () => {
  it('keeps entries with a steps array, with printable names', () => {
    const out = libraryEntries({
      entries: [null, 'x', { name: 'no steps' }, { name: 'ok', kind: 'macro', steps: [] }, { name: 42, steps: [1] }, { steps: [] }],
    })
    expect(out.map(e => [e.name, e.kind])).toEqual([['ok', 'macro'], ['42', 'pipeline'], ['untitled', 'pipeline']])
  })
})

describe('quarantine', () => {
  it('disables a top-level custom_js step and reports it', () => {
    const steps: PipelineStep[] = [
      { id: 's1', utilityId: 'trim' },
      { id: 's2', utilityId: 'custom_js', params: { code: 'return input' } },
    ]
    const { steps: out, quarantined } = quarantine(steps)
    expect(quarantined).toEqual(['s2'])
    expect(out[0]).toEqual(steps[0])
    expect(out[1]).toMatchObject({ id: 's2', enabled: false })
  })

  it('reaches into branches and macros', () => {
    const steps: PipelineStep[] = [
      {
        id: 'b1', type: 'branch', merge: { mode: 'concat' },
        branches: [[{ id: 's2', utilityId: 'custom_js' }], [{ id: 's3', utilityId: 'trim' }]],
      },
      { id: 'm1', type: 'macro', name: 'm', steps: [{ id: 's4', utilityId: 'custom_js' }] },
    ]
    const { quarantined } = quarantine(steps)
    expect(quarantined.sort()).toEqual(['s2', 's4'])
  })

  it('reaches into "run on each" bodies, nested ones too', () => {
    const steps: PipelineStep[] = [{
      id: 'e1', type: 'each', split: { mode: 'lines' },
      steps: [{ id: 'e2', type: 'each', split: { mode: 'json-array' }, steps: [{ id: 's5', utilityId: 'custom_js' }] }],
    }]
    const { steps: out, quarantined } = quarantine(steps)
    expect(quarantined).toEqual(['s5'])
    expect((out[0] as any).steps[0].steps[0]).toMatchObject({ id: 's5', enabled: false })
  })

  it('is a no-op when there is nothing to quarantine', () => {
    const steps: PipelineStep[] = [{ id: 's1', utilityId: 'trim' }]
    const { steps: out, quarantined } = quarantine(steps)
    expect(out).toBe(steps) // same reference: nothing rewritten
    expect(quarantined).toEqual([])
  })
})

describe('isLibraryExport', () => {
  it('recognises a library export', () => {
    expect(isLibraryExport({ v: 2, entries: [] })).toBe(true)
  })
  it('rejects a plain pipeline doc', () => {
    expect(isLibraryExport({ v: 2, steps: [] })).toBe(false)
  })
  it('rejects non-objects', () => {
    expect(isLibraryExport(null)).toBe(false)
    expect(isLibraryExport('entries')).toBe(false)
  })
})

describe('describeMarkdown', () => {
  const util: Utility = {
    id: 'case', name: 'change case', category: 'Formatting', description: 'Change letter casing.',
    accepts: 'string', produces: 'string',
    params: { mode: { kind: 'select', label: 'Mode', options: ['upper', 'lower'], default: 'upper' } },
    tags: ['uppercase'], aliases: ['toUpperCase'],
    examples: [{ title: 'upper', input: 'hi', params: { mode: 'upper' }, output: 'HI' }],
    apply: (v) => v,
  }

  it('includes the name, params table and examples', () => {
    const md = describeMarkdown(util)
    expect(md).toContain('# change case')
    expect(md).toContain('| mode | Mode | select | "upper" |')
    expect(md).toContain('options: upper, lower')
    expect(md).toContain('## Examples')
    expect(md).toContain('input:  hi')
    expect(md).toContain('output: HI')
    expect(md).toContain('**tags:** uppercase')
    expect(md).toContain('**aliases:** toUpperCase')
  })

  it('escapes table-breaking characters and notes non-text example inputs', () => {
    const md = describeMarkdown({
      ...util,
      params: { sep: { kind: 'string', label: 'a | b', default: '|' } },
      examples: [{ input: '6869', inputEncoding: 'hex', output: 'hi' }],
    })
    expect(md).toContain('| sep | a \\| b | string | "\\|" |')
    expect(md).toContain('input (hex): 6869')
  })

  it('says when a utility cannot run inside VS Code', () => {
    expect(describeMarkdown(util, ['dom'])).toMatch(/browser only.*dom/i)
    expect(describeMarkdown(util, [])).not.toMatch(/browser only/i)
  })
})
