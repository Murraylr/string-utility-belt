import { afterEach, describe, expect, it, vi } from 'vitest'
import util, { isBlankCode } from './index'
import { SANDBOX_TIMEOUT, setSandbox, type SandboxRequest } from '@/core/sandbox'
import { runPipeline } from '@/utilities'
import type { Value } from '@/types/utility'

const defaults = () => Object.fromEntries(Object.entries(util.params).map(([k, s]) => [k, (s as any).default]))

/** A stand-in host that records requests and answers with `reply(req)`. */
function fakeSandbox(reply: (req: SandboxRequest) => unknown) {
  const run = vi.fn(async (req: SandboxRequest) => reply(req) as Value)
  setSandbox({ run })
  return run
}

afterEach(() => setSandbox(null))

describe('custom_js metadata', () => {
  it('declares what it needs and what it handles', () => {
    expect(util.id).toBe('custom_js')
    expect(util.name).toBe('custom javascript')
    expect(util.category).toBe('String Ops')
    expect(util.env).toEqual(['eval', 'main'])
    expect(util.accepts).toEqual(['string', 'bytes', 'json'])
    expect(util.produces).toEqual(['string', 'bytes', 'json'])
  })

  it('has a JavaScript code param and a bounded integer timeout', () => {
    expect(util.params.code).toMatchObject({ kind: 'code', language: 'javascript', label: 'code' })
    expect((util.params.code as any).description).toMatch(/`input`/)
    expect((util.params.code as any).description).toMatch(/`return`/)
    expect(util.params.timeoutMs).toMatchObject({
      kind: 'number', label: 'timeout (ms)', default: 2000, min: 100, max: 30000, integer: true,
    })
  })

  it('ships an uppercase example that is commented out, so a new step runs nothing', () => {
    const code = (util.params.code as any).default as string
    expect(code).toMatch(/\/\/ return String\(input\)\.toUpperCase\(\)/)
    expect(isBlankCode(code)).toBe(true)
  })
})

describe('custom_js apply', () => {
  it('sends the code, input, timeout and abort signal to the sandbox', async () => {
    const run = fakeSandbox(() => 'OUT')
    const signal = new AbortController().signal
    const out = await util.apply('in', { code: 'return input', timeoutMs: 750 }, { signal })
    expect(out).toBe('OUT')
    expect(run).toHaveBeenCalledTimes(1)
    expect(run.mock.calls[0][0]).toEqual({ code: 'return input', input: 'in', timeoutMs: 750, signal })
  })

  it('passes bytes and JSON through untouched (no coercion to text)', async () => {
    const run = fakeSandbox(req => req.input)
    const bytes = new Uint8Array([0, 255])
    expect(await util.apply(bytes, { code: 'return input' })).toBe(bytes)
    const json = { a: [1] }
    expect(await util.apply(json, { code: 'return input' })).toBe(json)
    expect(run.mock.calls.map(c => c[0].input)).toEqual([bytes, json])
  })

  it('clamps the timeout it forwards', async () => {
    const run = fakeSandbox(() => '')
    await util.apply('', { code: 'return ""', timeoutMs: 5 })
    await util.apply('', { code: 'return ""', timeoutMs: 999999 })
    await util.apply('', { code: 'return ""', timeoutMs: '' })
    expect(run.mock.calls.map(c => c[0].timeoutMs)).toEqual([SANDBOX_TIMEOUT.min, SANDBOX_TIMEOUT.max, SANDBOX_TIMEOUT.default])
  })

  it('returns the input unchanged for empty or comment-only code, without touching the sandbox', async () => {
    const run = fakeSandbox(() => 'never')
    for (const code of ['', '   \n\t', '// nothing yet', '/* a\nblock */ // and a line', undefined]) {
      expect(await util.apply('keep me', { code })).toBe('keep me')
    }
    expect(run).not.toHaveBeenCalled()
  })

  it('rejects results that are not a string, bytes or plain JSON', async () => {
    fakeSandbox(() => 42)
    await expect(util.apply('x', { code: 'return 42' })).rejects.toThrow(/returned a number/)
    fakeSandbox(() => undefined)
    await expect(util.apply('x', { code: 'input' })).rejects.toThrow(/must `return` a value/)
    fakeSandbox(() => ({ when: new Date(0) }))
    await expect(util.apply('x', { code: 'return {when: new Date()}' })).rejects.toThrow(/a Date at \$\.when/)
    fakeSandbox(() => ({ f: () => 1 }))
    await expect(util.apply('x', { code: '…' })).rejects.toThrow(/a function at \$\.f/)
  })

  it('accepts bytes and JSON results', async () => {
    fakeSandbox(() => new Uint8Array([1, 2]))
    expect(await util.apply('x', { code: 'return new Uint8Array([1, 2])' })).toEqual(new Uint8Array([1, 2]))
    fakeSandbox(() => [{ a: 1 }, null])
    expect(await util.apply('x', { code: 'return [{a: 1}, null]' })).toEqual([{ a: 1 }, null])
  })

  it('surfaces the sandbox error', async () => {
    fakeSandbox(() => { throw new Error('ReferenceError: nope is not defined') })
    await expect(util.apply('x', { code: 'return nope' })).rejects.toThrow('ReferenceError: nope is not defined')
  })

  it('refuses to run with a clear message when no sandbox is installed', async () => {
    await expect(util.apply('x', { code: 'return input' })).rejects.toThrow(
      'Custom JavaScript is not available here — it only runs in the web app.',
    )
  })

  it('runs as a pipeline step, the failure landing on the step rather than crashing the run', async () => {
    const res = await runPipeline('abc', [{ id: 's1', utilityId: 'custom_js', params: { code: 'return input' } }])
    expect(res.err.s1).toMatch(/only runs in the web app/)
    fakeSandbox(req => String(req.input).toUpperCase())
    const ok = await runPipeline('abc', [{ id: 's1', utilityId: 'custom_js', params: { code: 'return input.toUpperCase()' } }])
    expect(ok.out).toBe('ABC')
  })
})

describe('isBlankCode', () => {
  it('sees only whitespace and comments as blank', () => {
    expect(isBlankCode('')).toBe(true)
    expect(isBlankCode('// a\n// b\r\n/* c */')).toBe(true)
    expect(isBlankCode('// only a line comment, no newline')).toBe(true)
  })

  it('sees any statement as code', () => {
    expect(isBlankCode('return 1')).toBe(false)
    expect(isBlankCode('// note\nreturn 1')).toBe(false)
    expect(isBlankCode('// note\rreturn 1')).toBe(false)
    expect(isBlankCode('// note\u2028return 1')).toBe(false)
    expect(isBlankCode('/* x */ return 1')).toBe(false)
    expect(isBlankCode('/* unterminated')).toBe(false)
    expect(isBlankCode('return "// not a comment"')).toBe(false)
  })

  it('stays linear on adversarial input', () => {
    const t0 = Date.now()
    expect(isBlankCode('// '.repeat(20000) + '\nx')).toBe(false)
    expect(isBlankCode(' '.repeat(200000) + 'x')).toBe(false)
    expect(isBlankCode('/*'.repeat(20000))).toBe(false)
    expect(Date.now() - t0).toBeLessThan(2000)
  })
})

describe('custom_js defaults', () => {
  it('passes input through with default params and no sandbox (registry invariant)', async () => {
    expect(await util.apply('', defaults())).toBe('')
    expect(await util.apply('abc', defaults())).toBe('abc')
  })
})
