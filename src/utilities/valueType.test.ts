import { describe, it, expect } from 'vitest'
import { valueType, formatForDisplay, runPipeline } from '@/utilities'

describe('valueType / formatForDisplay', () => {
  it('classifies a top-level array as json', () => {
    // detect_format and protobuf_decode both produce a list; treating arrays as
    // 'string' rendered them as "[object Object],[object Object]"
    expect(valueType([{ a: 1 }] as any)).toBe('json')
    expect(valueType([] as any)).toBe('json')
  })

  it('still classifies objects, bytes and strings', () => {
    expect(valueType({ a: 1 })).toBe('json')
    expect(valueType(new Uint8Array([1, 2]))).toBe('bytes')
    expect(valueType('hi')).toBe('string')
    expect(valueType('')).toBe('string')
  })

  it('pretty-prints an array instead of stringifying it', () => {
    expect(formatForDisplay([{ a: 1 }] as any)).toBe('[\n  {\n    "a": 1\n  }\n]')
    expect(formatForDisplay([1, 2] as any)).toBe('[\n  1,\n  2\n]')
  })

  it('renders a real array-producing utility as JSON', async () => {
    const { out, err } = await runPipeline('SGVsbG8gd29ybGQ=', [
      { id: 's1', utilityId: 'detect_format', enabled: true, params: {} },
    ])
    expect(err).toEqual({})
    expect(Array.isArray(out)).toBe(true)
    const shown = formatForDisplay(out)
    expect(shown.startsWith('[')).toBe(true)
    expect(shown).not.toContain('[object Object]')
  })

  it('coerces an array to a JSON string for a following string step', async () => {
    const { out, err } = await runPipeline('SGVsbG8gd29ybGQ=', [
      { id: 's1', utilityId: 'detect_format', enabled: true, params: {} },
      { id: 's2', utilityId: 'length', enabled: true, params: {} },
    ])
    expect(err).toEqual({})
    // length sees JSON.stringify(array), not "[object Object]"
    expect(Number(out)).toBeGreaterThan(10)
  })
})
