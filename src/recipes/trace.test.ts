import { describe, expect, it } from 'vitest'
import { runPipeline } from '../core/runner'
import { staticRegistry } from '../utilities/static-registry'
import { branch, laneStep, step } from './define'
import { firstError, preview, PREVIEW_BYTES, PREVIEW_MAX_CHARS, PREVIEW_MAX_LINES, stepTraces, traceRecipe, type PipelineRunner } from './trace'
import { toPipelineSteps, type Recipe } from './types'

const run: PipelineRunner = (input, steps, previews) => runPipeline(input, steps, { load: staticRegistry.load, previews, env: 'node' })

const recipe: Recipe = {
  slug: 'demo',
  name: 'Demo',
  summary: 'A demo recipe for the trace tests, long enough to be a summary of something useful.',
  category: 'Frontend',
  primaryQuery: 'demo',
  published: '2026-10-07',
  steps: [
    step('unquote', 'replace', { pattern: '^"|"$', replacement: '', regex: true, flags: 'g' }, 'Drops surrounding quotes when there are any.',
      { condition: { kind: 'regex', pattern: '^"' } }),
    step('pretty', 'json_pretty', { indent: 2 }, 'Formats the JSON with two-space indentation.'),
    branch('both', [[laneStep('k', 'json_sort_keys', {})], [laneStep('m', 'json_minify', {})]], { mode: 'concat', separator: '\n---\n' },
      'Shows the sorted and the minified form one above the other.'),
  ],
  samples: [{ id: 'obj', title: 'Object', input: '{"b":1,"a":2}', output: '' }],
}

describe('preview', () => {
  it('keeps short text whole and marks JSON', () => {
    expect(preview('hello')).toEqual({ kind: 'text', text: 'hello', size: 5, truncated: false })
    expect(preview({ a: 1 })).toEqual({ kind: 'json', text: '{\n  "a": 1\n}', size: 12, truncated: false })
  })

  it('cuts long text at the line and character limits', () => {
    const lines = Array.from({ length: PREVIEW_MAX_LINES + 10 }, (_, i) => `line ${i}`).join('\n')
    const byLines = preview(lines)
    expect(byLines.truncated).toBe(true)
    expect(byLines.text.split('\n')).toHaveLength(PREVIEW_MAX_LINES)
    const byChars = preview('x'.repeat(PREVIEW_MAX_CHARS + 1))
    expect(byChars).toMatchObject({ truncated: true, size: PREVIEW_MAX_CHARS + 1 })
    expect(byChars.text).toHaveLength(PREVIEW_MAX_CHARS)
  })

  it('shows bytes as hex, the first PREVIEW_BYTES of them', () => {
    expect(preview(new Uint8Array([0x1f, 0x8b, 0x08]))).toEqual({ kind: 'bytes', text: '1f 8b 08', size: 3, truncated: false })
    const many = preview(new Uint8Array(PREVIEW_BYTES + 2))
    expect(many).toMatchObject({ kind: 'bytes', size: PREVIEW_BYTES + 2, truncated: true })
    expect(many.text.split(' ')).toHaveLength(PREVIEW_BYTES)
  })
})

describe('traceRecipe', () => {
  it("records every top-level step's output, a skipped condition, and what leaving each step out does", async () => {
    const trace = await traceRecipe(recipe, run)
    expect(trace.slug).toBe('demo')
    expect(trace.sampleId).toBe('obj')
    expect(trace.output).toBe('{\n  "a": 2,\n  "b": 1\n}\n---\n{"b":1,"a":2}')
    expect(trace.steps.map(s => s.id)).toEqual(['unquote', 'pretty', 'both'])
    expect(trace.steps[0]).toMatchObject({ skipped: true, output: { text: '{"b":1,"a":2}' } })
    expect(trace.steps[1].output?.text).toBe('{\n  "b": 1,\n  "a": 2\n}')
    expect(trace.steps[2].output?.text).toBe(trace.output)

    const skip = Object.fromEntries(trace.skip.map(s => [s.id, s]))
    // the condition did not match this input, so leaving the step out changes nothing
    expect(skip.unquote).toMatchObject({ unchanged: true })
    expect(skip.pretty).toMatchObject({ unchanged: true })
    expect(skip.both).toMatchObject({ unchanged: false, output: { text: '{\n  "b": 1,\n  "a": 2\n}' } })
  })

  it('traces another sample when asked, and reports the step a skip breaks', async () => {
    const encoded = { id: 'encoded', title: 'Base64', input: 'eyJhIjoxfQ==', output: '' }
    const r: Recipe = {
      ...recipe,
      steps: [
        step('decode', 'base64_decode', {}, 'Turns the Base64 text back into the JSON it encodes.'),
        step('pretty', 'json_pretty', { indent: 2 }, 'Formats the JSON with two-space indentation.'),
      ],
    }
    const trace = await traceRecipe(r, run, encoded)
    expect(trace.sampleId).toBe('encoded')
    expect(trace.output).toBe('{\n  "a": 1\n}')
    // without the decode, json_pretty gets Base64 text and fails
    expect(trace.skip[0]).toMatchObject({ unchanged: false, error: { stepId: 'pretty' } })
    expect(trace.skip[0].output).toBeUndefined()
    expect(trace.skip[1]).toMatchObject({ unchanged: false, output: { text: '{"a":1}' } })
  })
})

describe('stepTraces / firstError', () => {
  it('reports an error inside a branch lane on the branch, in pipeline order', async () => {
    const steps = toPipelineSteps([
      branch('b', [[laneStep('ok', 'case', { mode: 'upper' })], [laneStep('bad', 'json_pretty', {})]], { mode: 'concat' },
        'One lane works, the other fails on text that is not JSON.'),
    ])
    const result = await run('not json', steps, true)
    expect(firstError(result, steps)?.stepId).toBe('bad')
    const [trace] = stepTraces(steps, result)
    expect(trace.error).toBe(result.err.bad)
    expect(trace.output).toBeUndefined()
  })
})
