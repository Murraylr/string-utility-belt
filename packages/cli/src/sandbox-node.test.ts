// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createNodeSandbox } from './sandbox-node'

describe('createNodeSandbox', () => {
  it('runs a function body with `input` in scope and returns its value', async () => {
    const sandbox = createNodeSandbox()
    const out = await sandbox.run({ code: 'return String(input).toUpperCase()', input: 'hi', timeoutMs: 2000 })
    expect(out).toBe('HI')
  })

  it('supports await inside the function body', async () => {
    const sandbox = createNodeSandbox()
    const out = await sandbox.run({
      code: 'const x = await Promise.resolve(String(input) + "!"); return x',
      input: 'hi', timeoutMs: 2000,
    })
    expect(out).toBe('hi!')
  })

  it('can await host async APIs such as crypto.subtle', async () => {
    const sandbox = createNodeSandbox()
    const out = await sandbox.run({
      code: 'const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input)); return String(d.byteLength)',
      input: 'hi', timeoutMs: 2000,
    })
    expect(out).toBe('32')
  })

  it('round-trips bytes and JSON as host-realm values', async () => {
    const sandbox = createNodeSandbox()
    const bytes = await sandbox.run({ code: 'return new Uint8Array([input[0] + 1])', input: new Uint8Array([1]), timeoutMs: 2000 })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(Array.from(bytes as Uint8Array)).toEqual([2])
    const json = await sandbox.run({ code: 'return { n: input.n * 2, list: [1, 2] }', input: { n: 21 }, timeoutMs: 2000 })
    expect(json).toEqual({ n: 42, list: [1, 2] })
  })

  it('has no access to require/process/import', async () => {
    const sandbox = createNodeSandbox()
    await expect(sandbox.run({ code: 'return typeof require', input: '', timeoutMs: 2000 }))
      .resolves.toBe('undefined')
    await expect(sandbox.run({ code: 'return typeof process', input: '', timeoutMs: 2000 }))
      .resolves.toBe('undefined')
    await expect(sandbox.run({ code: 'return await import("node:fs")', input: '', timeoutMs: 2000 }))
      .rejects.toThrow()
  })

  it('times out a synchronous infinite loop', async () => {
    const sandbox = createNodeSandbox()
    await expect(sandbox.run({ code: 'while (true) {}', input: '', timeoutMs: 200 }))
      .rejects.toThrow(/timed out/)
  }, 10000)

  it('times out an async busy loop that never yields to the event loop', async () => {
    const sandbox = createNodeSandbox()
    const t0 = Date.now()
    await expect(sandbox.run({ code: 'for (;;) await 0', input: '', timeoutMs: 200 }))
      .rejects.toThrow(/timed out/)
    expect(Date.now() - t0).toBeLessThan(5000)
  }, 10000)

  it('reports an await that can never settle without waiting out the timeout', async () => {
    const sandbox = createNodeSandbox()
    const t0 = Date.now()
    await expect(sandbox.run({
      code: 'return await new Promise(() => {})',
      input: '', timeoutMs: 20000,
    })).rejects.toThrow(/never finished/)
    expect(Date.now() - t0).toBeLessThan(10000)
  }, 15000)

  it('rejects immediately for an already-aborted signal', async () => {
    const sandbox = createNodeSandbox()
    const controller = new AbortController()
    controller.abort()
    await expect(sandbox.run({ code: 'return input', input: '', timeoutMs: 2000, signal: controller.signal }))
      .rejects.toThrow(/cancelled/)
  })

  it('stops a running job when the signal aborts', async () => {
    const sandbox = createNodeSandbox()
    const controller = new AbortController()
    const run = sandbox.run({ code: 'for (;;) await 0', input: '', timeoutMs: 30000, signal: controller.signal })
    setTimeout(() => controller.abort(), 300)
    await expect(run).rejects.toMatchObject({ name: 'AbortError' })
  }, 10000)

  it('propagates a thrown error from the code', async () => {
    const sandbox = createNodeSandbox()
    await expect(sandbox.run({ code: 'throw new Error("boom")', input: '', timeoutMs: 2000 }))
      .rejects.toThrow(/boom/)
  })

  it('reports a result that cannot leave the sandbox (a function) as an error', async () => {
    const sandbox = createNodeSandbox()
    await expect(sandbox.run({ code: 'return () => 1', input: '', timeoutMs: 2000 }))
      .rejects.toThrow(/cannot be copied/)
  })

  it('sends console output to the log callback', async () => {
    const lines: string[] = []
    const sandbox = createNodeSandbox({ log: s => lines.push(s) })
    await sandbox.run({ code: 'console.log("a", 1); console.error({ b: 2 }); return input', input: 'x', timeoutMs: 2000 })
    expect(lines).toEqual(['a 1', '{ b: 2 }'])
  })
})
