/**
 * Talks to `pipeline.worker.ts` over postMessage. Constructs the worker lazily (on
 * the first `run()`), tears it down and starts fresh after a run that never
 * responds to cancellation, and stops using workers for the session the first time
 * one fails to construct or errors before it has booted — from then on every `run()`
 * rejects so the caller (executor.ts) falls back to the main thread. A worker that
 * dies AFTER booting (out of memory on a hostile input) is a crash, not a missing
 * capability: its runs reject with `WorkerCrashedError`, and the next run gets a fresh
 * worker, so the executor never replays the crashing run on the main thread.
 */
import type { PipelineStep, Value } from '@/types/utility'
import type { RunResult } from '@/core/runner'
import { WorkerCrashedError } from './crash'

type RunMsg = { type: 'run'; id: string; input: Value; steps: PipelineStep[]; previews: boolean }
type InMsg = RunMsg | { type: 'cancel'; id: string }
type OutMsg =
  | { type: 'result'; id: string; result: RunResult }
  | { type: 'error'; id: string; message: string }
  | { type: 'ready' }

/** The slice of the DOM `Worker` interface the client needs — a fake can implement just this. */
export interface WorkerLike {
  postMessage(msg: InMsg): void
  terminate(): void
  onmessage: ((ev: { data: OutMsg }) => void) | null
  onerror: ((ev: unknown) => void) | null
  onmessageerror: ((ev: unknown) => void) | null
}

export interface WorkerClientOptions {
  /** Builds a fresh worker. Defaults to the real `pipeline.worker.ts` module worker. */
  createWorker?: () => WorkerLike
  /** How long to wait after `cancel()` before giving up on the worker and killing it. */
  cancelTimeoutMs?: number
}

interface Pending {
  msg: RunMsg
  resolve: (r: RunResult) => void
  reject: (e: Error) => void
  /** cancel() was called: after a worker kill it is dropped, not re-sent. */
  cancelled?: boolean
}

const defaultFactory = (): WorkerLike =>
  new Worker(new URL('./pipeline.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike

export interface WorkerClient {
  /** True while workers are still worth trying this session (not yet failed). */
  isAvailable(): boolean
  /** Never throws: every failure (including an uncloneable input) rejects the promise. */
  run(input: Value, steps: PipelineStep[], previews: boolean): { id: string; promise: Promise<RunResult> }
  cancel(id: string): void
}

const errorOf = (e: unknown, fallback: string) => new Error((e as any)?.message || fallback)

export function createWorkerClient(opts: WorkerClientOptions = {}): WorkerClient {
  const factory = opts.createWorker ?? defaultFactory
  const cancelTimeoutMs = opts.cancelTimeoutMs ?? 1000
  const pending = new Map<string, Pending>()
  let worker: WorkerLike | null = null
  let disabled = false
  let nextId = 0

  function settle(id: string, fn: (p: Pending) => void) {
    const p = pending.get(id)
    if (!p) return
    pending.delete(id)
    fn(p)
  }

  /** A hard failure: every in-flight run rejects, and workers are off for the session. */
  function disable(reason: string) {
    disabled = true
    for (const id of [...pending.keys()]) settle(id, p => p.reject(new Error(reason)))
    teardown()
  }

  /** The worker booted and then died: fail its runs, keep workers on, start fresh next time. */
  function crashed() {
    for (const id of [...pending.keys()]) settle(id, p => p.reject(new WorkerCrashedError()))
    teardown()
  }

  function teardown() {
    try { worker?.terminate() } catch { /* already gone */ }
    worker = null
  }

  function ensureWorker(): WorkerLike | null {
    if (disabled) return null
    if (worker) return worker
    let w: WorkerLike
    try {
      w = factory()
    } catch (e) {
      disable(errorOf(e, 'worker failed to construct').message)
      return null
    }
    worker = w
    let booted = false
    // events from a worker already replaced (killed after a runaway) are ignored:
    // they must not settle or disable anything belonging to its successor
    w.onmessage = ev => {
      if (w !== worker) return
      const msg = ev.data
      booted = true
      if (msg.type === 'ready') return
      settle(msg.id, p => (msg.type === 'result' ? p.resolve(msg.result) : p.reject(new Error(msg.message))))
    }
    w.onerror = () => { if (w === worker) { if (booted) crashed(); else disable('worker error') } }
    w.onmessageerror = () => { if (w === worker) disable('worker message error') }
    return w
  }

  /** Posts a run; a failure to post (e.g. DataCloneError) rejects just that run. */
  function dispatch(p: Pending) {
    const w = ensureWorker()
    if (!w) { settle(p.msg.id, e => e.reject(new Error('worker unavailable'))); return }
    try {
      w.postMessage(p.msg)
    } catch (e) {
      settle(p.msg.id, entry => entry.reject(errorOf(e, 'could not send the run to the worker')))
    }
  }

  return {
    isAvailable: () => !disabled,

    run(input, steps, previews) {
      const id = String(nextId++)
      const msg: RunMsg = { type: 'run', id, input, steps, previews }
      let entry!: Pending
      const promise = new Promise<RunResult>((resolve, reject) => { entry = { msg, resolve, reject } })
      pending.set(id, entry)
      dispatch(entry)
      return { id, promise }
    },

    cancel(id) {
      const p = pending.get(id)
      if (!p) return
      p.cancelled = true
      try { worker?.postMessage({ type: 'cancel', id }) } catch { /* the timeout below still applies */ }
      setTimeout(() => {
        // already resolved/rejected during the grace period: nothing to clean up
        if (!pending.has(id)) return
        // still running: a runaway utility ignored the abort signal. Kill the worker
        // (not the whole session); live runs queued behind the runaway never
        // started, so they are sent again to a fresh worker rather than left hanging.
        settle(id, entry => entry.reject(new Error('cancelled (worker did not respond in time)')))
        teardown()
        for (const other of [...pending.values()]) {
          if (other.cancelled) settle(other.msg.id, e => e.reject(new Error('cancelled')))
          else dispatch(other)
        }
      }, cancelTimeoutMs)
    },
  }
}

/** One shared client for the app; executor.ts uses this instead of constructing its own. */
export const workerClient = createWorkerClient()
