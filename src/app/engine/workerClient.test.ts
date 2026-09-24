import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createWorkerClient, type WorkerLike } from './workerClient'
import { WorkerCrashedError } from './crash'

/** A controllable stand-in for the DOM Worker the client would otherwise construct. */
class FakeWorker implements WorkerLike {
  onmessage: WorkerLike['onmessage'] = null
  onerror: WorkerLike['onerror'] = null
  onmessageerror: WorkerLike['onmessageerror'] = null
  posted: any[] = []
  terminated = false
  postMessage(msg: any) { this.posted.push(msg) }
  terminate() { this.terminated = true }
  /** Test helper: deliver a worker -> client message. */
  emit(data: any) { this.onmessage?.({ data }) }
}

describe('workerClient', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('delivers a result to the matching run()', async () => {
    const w = new FakeWorker()
    const client = createWorkerClient({ createWorker: () => w })
    const { id, promise } = client.run('hi', [], false)
    expect(w.posted).toEqual([{ type: 'run', id, input: 'hi', steps: [], previews: false }])
    w.emit({ type: 'result', id, result: { out: 'HI' } })
    await expect(promise).resolves.toEqual({ out: 'HI' })
  })

  it('rejects the run on a worker error message', async () => {
    const w = new FakeWorker()
    const client = createWorkerClient({ createWorker: () => w })
    const { id, promise } = client.run('x', [], false)
    w.emit({ type: 'error', id, message: 'boom' })
    await expect(promise).rejects.toThrow('boom')
  })

  it('reuses one worker across runs', () => {
    const factory = vi.fn(() => new FakeWorker())
    const client = createWorkerClient({ createWorker: factory })
    client.run('a', [], false)
    client.run('b', [], false)
    expect(factory).toHaveBeenCalledTimes(1)
  })

  it('posts a cancel message for the given run id', () => {
    const w = new FakeWorker()
    const client = createWorkerClient({ createWorker: () => w })
    const { id } = client.run('x', [], false)
    client.cancel(id)
    expect(w.posted).toContainEqual({ type: 'cancel', id })
  })

  it('resolves normally when the worker responds to a cancel within the grace period', async () => {
    const w = new FakeWorker()
    const client = createWorkerClient({ createWorker: () => w })
    const { id, promise } = client.run('x', [], false)
    client.cancel(id)
    w.emit({ type: 'result', id, result: { out: '', aborted: true } })
    vi.advanceTimersByTime(1000)
    await expect(promise).resolves.toEqual({ out: '', aborted: true })
    expect(w.terminated).toBe(false)
  })

  it('terminates the worker and rejects when it does not settle within the grace period', async () => {
    const w = new FakeWorker()
    const client = createWorkerClient({ createWorker: () => w })
    const { id, promise } = client.run('x', [], false)
    const assertion = expect(promise).rejects.toThrow(/did not respond/)
    client.cancel(id)
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
    expect(w.terminated).toBe(true)
  })

  it('builds a fresh worker on the run after a timeout-forced termination', async () => {
    const factory = vi.fn(() => new FakeWorker())
    const client = createWorkerClient({ createWorker: factory })
    const { id, promise } = client.run('x', [], false)
    const assertion = expect(promise).rejects.toThrow()
    client.cancel(id)
    await vi.advanceTimersByTimeAsync(1000)
    await assertion
    client.run('y', [], false)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(client.isAvailable()).toBe(true)
  })

  it('falls back to main thread (rejects, stays disabled) when the worker fails to construct', async () => {
    const client = createWorkerClient({ createWorker: () => { throw new Error('no module workers here') } })
    const { promise } = client.run('x', [], false)
    await expect(promise).rejects.toThrow()
    expect(client.isAvailable()).toBe(false)
    // every later run rejects immediately too, without trying to construct again
    const second = client.run('y', [], false)
    await expect(second.promise).rejects.toThrow('worker unavailable')
  })

  it('disables the worker for the session on onerror, rejecting in-flight runs', async () => {
    const w = new FakeWorker()
    const client = createWorkerClient({ createWorker: () => w })
    const { promise } = client.run('x', [], false)
    w.onerror?.(new Event('error'))
    await expect(promise).rejects.toThrow()
    expect(client.isAvailable()).toBe(false)
    expect(w.terminated).toBe(true)
  })

  it('treats an error after the worker booted as a crash: rejects the run, keeps workers on, starts fresh', async () => {
    const workers: FakeWorker[] = []
    const client = createWorkerClient({ createWorker: () => { const w = new FakeWorker(); workers.push(w); return w } })
    const first = client.run('x', [], false)
    workers[0].emit({ type: 'ready' })
    workers[0].onerror?.(new Event('error')) // e.g. out of memory mid-run
    await expect(first.promise).rejects.toBeInstanceOf(WorkerCrashedError)
    expect(client.isAvailable()).toBe(true)
    expect(workers[0].terminated).toBe(true)
    const next = client.run('y', [], false)
    expect(workers).toHaveLength(2)
    workers[1].emit({ type: 'result', id: next.id, result: { out: 'Y' } })
    await expect(next.promise).resolves.toEqual({ out: 'Y' })
  })

  it('re-dispatches runs queued behind a runaway to the fresh worker instead of orphaning them', async () => {
    const workers: FakeWorker[] = []
    const client = createWorkerClient({ createWorker: () => { const w = new FakeWorker(); workers.push(w); return w } })
    const runaway = client.run('slow', [], false)
    const runawayRejected = expect(runaway.promise).rejects.toThrow(/did not respond/)
    // the user typed again: the old run is cancelled and a new one queues behind it
    client.cancel(runaway.id)
    const next = client.run('next', [], true)
    await vi.advanceTimersByTimeAsync(1000)
    await runawayRejected
    expect(workers).toHaveLength(2)
    expect(workers[0].terminated).toBe(true)
    // the queued run was sent again to the replacement worker, and its answer is delivered
    expect(workers[1].posted).toEqual([{ type: 'run', id: next.id, input: 'next', steps: [], previews: true }])
    workers[1].emit({ type: 'result', id: next.id, result: { out: 'NEXT' } })
    await expect(next.promise).resolves.toEqual({ out: 'NEXT' })
  })

  it('drops (rather than re-sends) queued runs that were themselves cancelled when the runaway is killed', async () => {
    const workers: FakeWorker[] = []
    const client = createWorkerClient({ createWorker: () => { const w = new FakeWorker(); workers.push(w); return w } })
    const runaway = client.run('slow', [], false)
    const stale = client.run('stale', [], false)
    const live = client.run('live', [], false)
    const r1 = expect(runaway.promise).rejects.toThrow(/did not respond/)
    const r2 = expect(stale.promise).rejects.toThrow(/cancelled/)
    client.cancel(runaway.id)
    client.cancel(stale.id)
    await vi.advanceTimersByTimeAsync(1000)
    await r1
    await r2
    expect(workers[1].posted.map(m => m.id)).toEqual([live.id])
  })

  it('rejects (never throws) when the message cannot be posted, and keeps the worker', async () => {
    const w = new FakeWorker()
    let fail = true
    w.postMessage = (msg: any) => {
      if (fail && msg.type === 'run') throw new DOMException('could not be cloned', 'DataCloneError')
      w.posted.push(msg)
    }
    const client = createWorkerClient({ createWorker: () => w })
    let handle: ReturnType<typeof client.run> | undefined
    expect(() => { handle = client.run({ f: () => 1 } as any, [], false) }).not.toThrow()
    await expect(handle!.promise).rejects.toThrow(/cloned/)
    // an input-specific failure: the worker stays usable for the next run
    expect(client.isAvailable()).toBe(true)
    fail = false
    const ok = client.run('fine', [], false)
    w.emit({ type: 'result', id: ok.id, result: { out: 'FINE' } })
    await expect(ok.promise).resolves.toEqual({ out: 'FINE' })
  })

  it('ignores an error event from a worker it already replaced', async () => {
    const workers: FakeWorker[] = []
    const client = createWorkerClient({ createWorker: () => { const w = new FakeWorker(); workers.push(w); return w } })
    const first = client.run('x', [], false)
    const rejected = expect(first.promise).rejects.toThrow()
    client.cancel(first.id)
    await vi.advanceTimersByTimeAsync(1000)
    await rejected
    const second = client.run('y', [], false)
    workers[0].onerror?.(new Event('error'))
    expect(client.isAvailable()).toBe(true)
    workers[1].emit({ type: 'result', id: second.id, result: { out: 'Y' } })
    await expect(second.promise).resolves.toEqual({ out: 'Y' })
  })

  it('disables the worker for the session on onmessageerror', async () => {
    const w = new FakeWorker()
    const client = createWorkerClient({ createWorker: () => w })
    const { promise } = client.run('x', [], false)
    w.onmessageerror?.(new Event('messageerror'))
    await expect(promise).rejects.toThrow()
    expect(client.isAvailable()).toBe(false)
  })
})
