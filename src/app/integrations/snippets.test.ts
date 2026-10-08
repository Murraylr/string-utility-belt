import { describe, expect, it } from 'vitest'
import type { UtilityMeta } from '@/core/registry'
import type { ParamSpec } from '@/types/utility'
import {
  INPUT_FILE, MAX_INLINE_INPUT, changedParams, cliCommand, cliStep, mcpArguments, runsOffBrowser, shellQuote,
} from './snippets'

type Meta = Pick<UtilityMeta, 'id' | 'params' | 'env'>

const meta = (params: Record<string, ParamSpec> = {}, env: UtilityMeta['env'] = []): Meta => ({ id: 'demo', params, env })

const PARAMS: Record<string, ParamSpec> = {
  width: { kind: 'number', label: 'x', default: 2, max: 10 },
  upper: { kind: 'boolean', label: 'x', default: false },
  sep: { kind: 'string', label: 'x', default: '' },
  kinds: { kind: 'multiselect', label: 'x', options: ['a', 'b', 'c'], default: ['a'] },
  rules: { kind: 'keyvalue', label: 'x', default: [] },
}

describe('runsOffBrowser', () => {
  it('excludes utilities that need the DOM, the main thread or user code', () => {
    expect(runsOffBrowser(meta())).toBe(true)
    expect(runsOffBrowser(meta({}, ['wasm']))).toBe(true)
    for (const env of ['dom', 'main', 'eval'] as const) expect(runsOffBrowser(meta({}, [env]))).toBe(false)
  })
})

describe('changedParams', () => {
  it('keeps only values that differ from the defaults, in spec order', () => {
    expect(changedParams(meta(PARAMS), { upper: false, width: 2 })).toEqual({})
    expect(Object.keys(changedParams(meta(PARAMS), { sep: '-', width: 4, kinds: ['a'] }))).toEqual(['width', 'sep'])
  })

  it('ignores keys the utility does not have', () => {
    expect(changedParams(meta(PARAMS), { nope: 1 })).toEqual({})
  })
})

describe('cliStep', () => {
  it('is the bare id with default params', () => {
    expect(cliStep(meta(PARAMS), {})).toBe('demo')
  })

  it('spells scalars as text and lists as JSON', () => {
    expect(cliStep(meta(PARAMS), { width: 4, upper: true, kinds: ['b', 'c'], rules: [['x', 'y,z']] }))
      .toBe('demo:width=4,upper=true,kinds=["b","c"],rules=[["x","y,z"]]')
  })

  it('escapes commas in text values', () => {
    expect(cliStep(meta(PARAMS), { sep: 'a,b' })).toBe('demo:sep=a\\,b')
  })

  it('moves a value ending in a backslash last, where it cannot swallow a separator', () => {
    expect(cliStep(meta(PARAMS), { sep: 'x\\', width: 3 })).toBe('demo:width=3,sep=x\\')
  })

  it('gives up on values the CLI cannot spell', () => {
    const two = meta({ a: { kind: 'string', label: 'x', default: '' }, b: { kind: 'string', label: 'x', default: '' } })
    expect(cliStep(two, { a: 'x\\', b: 'y\\' })).toBeUndefined()
    expect(cliStep(meta(PARAMS), { width: Number.NaN })).toBeUndefined()
  })
})

describe('shellQuote', () => {
  it('leaves plain words bare', () => {
    expect(shellQuote('base64_encode:width=4')).toBe('base64_encode:width=4')
  })

  it('single-quotes anything a shell would interpret', () => {
    expect(shellQuote('hello world')).toBe("'hello world'")
    expect(shellQuote('$HOME `x` "y"')).toBe('\'$HOME `x` "y"\'')
    expect(shellQuote("don't")).toBe("'don'\\''t'")
    expect(shellQuote('')).toBe("''")
  })
})

describe('cliCommand', () => {
  it('inlines short single-line input with -t', () => {
    expect(cliCommand(meta(PARAMS), 'hi there', { width: 4 })).toBe("npx subelt -t 'hi there' demo:width=4")
  })

  it('reads empty, long or multi-line input from a file', () => {
    const file = `npx subelt -i ${INPUT_FILE} demo`
    expect(cliCommand(meta(), '', {})).toBe(file)
    expect(cliCommand(meta(), 'a\nb', {})).toBe(file)
    expect(cliCommand(meta(), 'x'.repeat(MAX_INLINE_INPUT + 1), {})).toBe(file)
    expect(cliCommand(meta(), 'x'.repeat(MAX_INLINE_INPUT), {})).toContain(' -t ')
  })

  it('quotes a step whose values hold shell syntax', () => {
    expect(cliCommand(meta(PARAMS), '', { sep: '; rm -rf /' })).toBe("npx subelt -i input.txt 'demo:sep=; rm -rf /'")
  })

  it('has nothing for a utility the CLI cannot run', () => {
    expect(cliCommand(meta({}, ['dom']), 'x', {})).toBeUndefined()
  })
})

describe('mcpArguments', () => {
  it('names the utility, and the params only when they differ from the defaults', () => {
    expect(mcpArguments(meta(PARAMS), { width: 2 })).toBe('{"id":"demo"}')
    expect(mcpArguments(meta(PARAMS), { width: 5, kinds: ['c'] })).toBe('{"id":"demo","params":{"width":5,"kinds":["c"]}}')
  })
})
