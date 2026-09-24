// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProcessExecutor, inProcessExecutor } from './executor'
import type { Executor } from './executor'

const fixture = new URL('./__fixtures__/job-runner.mjs', import.meta.url)

type Echo = { echo: unknown; pid: number }

describe('createProcessExecutor', () => {
  let exec: Executor
  afterEach(async () => { await exec?.close() })

  it('runs a job in a child process and reuses the warm runner for the next one', async () => {
    exec = createProcessExecutor(fixture)
    const a = await exec.run<Echo>({ kind: 'echo', value: 1 }, { timeoutMs: 5000 })
    const b = await exec.run<Echo>({ kind: 'echo', value: new Uint8Array([1, 2]) }, { timeoutMs: 5000 })
    expect(a.echo).toBe(1)
    expect(b.echo).toEqual(new Uint8Array([1, 2])) // structured clone, not JSON
    expect(a.pid).not.toBe(process.pid)
    expect(b.pid).toBe(a.pid)
  })

  it('kills synchronous work at the deadline and serves the next call from a fresh runner', async () => {
    exec = createProcessExecutor(fixture, { graceMs: 50 })
    const first = await exec.run<Echo>({ kind: 'echo' }, { timeoutMs: 5000 })
    const t0 = Date.now()
    await expect(exec.run({ kind: 'spin' }, { timeoutMs: 200 })).rejects.toThrow(/timed out after 200ms/)
    expect(Date.now() - t0).toBeLessThan(3000)
    const next = await exec.run<Echo>({ kind: 'echo', value: 'alive' }, { timeoutMs: 5000 })
    expect(next.echo).toBe('alive')
    expect(next.pid).not.toBe(first.pid)
  }, 15_000)

  it('kills the runner when the client cancels mid-job', async () => {
    exec = createProcessExecutor(fixture)
    const controller = new AbortController()
    const run = exec.run({ kind: 'spin' }, { timeoutMs: 10_000, signal: controller.signal })
    setTimeout(() => controller.abort(), 300)
    await expect(run).rejects.toThrow(/cancelled/)
    await expect(exec.run<Echo>({ kind: 'echo', value: 'ok' }, { timeoutMs: 5000 })).resolves.toMatchObject({ echo: 'ok' })
  }, 15_000)

  it('rejects immediately for an already-cancelled request', async () => {
    exec = createProcessExecutor(fixture)
    const controller = new AbortController()
    controller.abort()
    await expect(exec.run({ kind: 'echo' }, { timeoutMs: 5000, signal: controller.signal })).rejects.toThrow(/cancelled/)
  })

  it('passes a job error through and keeps the (healthy) runner', async () => {
    exec = createProcessExecutor(fixture)
    const before = await exec.run<Echo>({ kind: 'echo' }, { timeoutMs: 5000 })
    await expect(exec.run({ kind: 'fail' }, { timeoutMs: 5000 })).rejects.toThrow('boom')
    const after = await exec.run<Echo>({ kind: 'echo' }, { timeoutMs: 5000 })
    expect(after.pid).toBe(before.pid)
  })

  it('retires a runner that reports its own cooperative timeout', async () => {
    exec = createProcessExecutor(fixture)
    const before = await exec.run<Echo>({ kind: 'echo' }, { timeoutMs: 5000 })
    await expect(exec.run({ kind: 'retire' }, { timeoutMs: 5000 })).rejects.toThrow(/timed out/)
    const after = await exec.run<Echo>({ kind: 'echo' }, { timeoutMs: 5000 })
    expect(after.pid).not.toBe(before.pid)
  })

  it('contains a fatal out-of-memory in the runner instead of aborting this process', async () => {
    exec = createProcessExecutor(fixture, { maxOldSpaceMb: 64 })
    await expect(exec.run({ kind: 'oom' }, { timeoutMs: 20_000 })).rejects.toThrow(/out of memory/)
    await expect(exec.run<Echo>({ kind: 'echo', value: 1 }, { timeoutMs: 5000 })).resolves.toMatchObject({ echo: 1 })
  }, 30_000)

  it('reports a runner that exits mid-job', async () => {
    exec = createProcessExecutor(fixture)
    await expect(exec.run({ kind: 'exit' }, { timeoutMs: 5000 })).rejects.toThrow(/exited unexpectedly \(code 3\)/)
  })

  it('queues calls beyond maxRunners instead of spawning more', async () => {
    exec = createProcessExecutor(fixture, { maxRunners: 1 })
    const results = await Promise.all([1, 2, 3].map(v => exec.run<Echo>({ kind: 'echo', value: v }, { timeoutMs: 5000 })))
    expect(results.map(r => r.echo)).toEqual([1, 2, 3])
    expect(new Set(results.map(r => r.pid)).size).toBe(1)
  })

  it('diverts runner stdout to stderr so it cannot corrupt the JSON-RPC stream', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const stdout = vi.spyOn(process.stdout, 'write')
    try {
      exec = createProcessExecutor(fixture)
      await expect(exec.run({ kind: 'log' }, { timeoutMs: 5000 })).resolves.toBe('logged')
      expect(stderr.mock.calls.some(([chunk]) => String(chunk).includes('fixture-noise-on-stdout'))).toBe(true)
      expect(stdout.mock.calls.some(([chunk]) => String(chunk).includes('fixture-noise-on-stdout'))).toBe(false)
    } finally {
      stderr.mockRestore()
      stdout.mockRestore()
    }
  })

  it('refuses work after close()', async () => {
    exec = createProcessExecutor(fixture)
    await exec.close()
    await expect(exec.run({ kind: 'echo' }, { timeoutMs: 5000 })).rejects.toThrow(/closed/)
  })
})

describe('inProcessExecutor', () => {
  it('times out work that yields, aborting its signal', async () => {
    let aborted = false
    const exec = inProcessExecutor((_job, signal) => new Promise(() => {
      signal.addEventListener('abort', () => { aborted = true })
    }))
    await expect(exec.run({}, { timeoutMs: 30 })).rejects.toThrow(/timed out after 30ms/)
    expect(aborted).toBe(true)
  })

  it('stops on client cancellation', async () => {
    const exec = inProcessExecutor(() => new Promise(() => {}))
    const controller = new AbortController()
    const run = exec.run({}, { timeoutMs: 10_000, signal: controller.signal })
    controller.abort()
    await expect(run).rejects.toThrow(/cancelled/)
  })
})
