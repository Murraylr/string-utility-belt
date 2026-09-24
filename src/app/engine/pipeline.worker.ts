/**
 * Runs the pipeline off the main thread. Loaded as a Vite module worker (see
 * `workerClient.ts`) — no React, no DOM. `self` is typed loosely (cast to
 * `WorkerScope` below) rather than pulling in `lib.webworker.d.ts`, which would
 * conflict with the app's `lib: ["DOM", …]` (both declare a global `self`).
 */
import { runPipeline } from '@/core/runner'
import type { PipelineStep, Utility, Value } from '@/types/utility'
// code loaders only: the worker never needs the ~230 KB metadata manifest that
// '@/utilities/lazy' bundles, and it would dominate the worker's boot download
import { LOADERS } from '@/utilities/_generated/loaders'

interface RunMsg { type: 'run'; id: string; input: Value; steps: PipelineStep[]; previews: boolean }
interface CancelMsg { type: 'cancel'; id: string }
type InMsg = RunMsg | CancelMsg

export type OutMsg =
  | { type: 'result'; id: string; result: Awaited<ReturnType<typeof runPipeline>> }
  | { type: 'error'; id: string; message: string }
  | { type: 'ready' }

interface WorkerScope {
  onmessage: ((ev: { data: InMsg }) => void) | null
  postMessage: (msg: OutMsg) => void
}

const ctx = self as unknown as WorkerScope
const controllers = new Map<string, AbortController>()

/** Thrown from `load` when a cancel arrives before a step runs; never a real step error. */
const CANCELLED = '\u0000cancelled before this step ran'

const loaded = new Map<string, Promise<Utility>>()

/** A utility's code, cached; a failed chunk load is retried next time. Rejects unknown ids. */
function loadUtility(id: string): Promise<Utility> {
  // own-property check: step ids arrive from share links ('constructor' is not a loader)
  if (!Object.prototype.hasOwnProperty.call(LOADERS, id)) return Promise.reject(new Error(`unknown utility: ${id}`))
  let p = loaded.get(id)
  if (!p) {
    p = LOADERS[id]().then(m => m.default)
    p.catch(() => loaded.delete(id))
    loaded.set(id, p)
  }
  return p
}

/**
 * A zero-delay macrotask, so a queued 'cancel' message gets handled. Without it a
 * pipeline whose utilities are already loaded runs start to finish on microtasks
 * alone and the worker never sees the cancel until the run is over. MessageChannel
 * rather than setTimeout(0), which browsers clamp to 4ms once nested.
 */
function yieldToMessages(): Promise<void> {
  if (typeof MessageChannel === 'undefined') return new Promise(resolve => setTimeout(resolve, 0))
  return new Promise(resolve => {
    const { port1, port2 } = new MessageChannel()
    port1.onmessage = () => { port1.close(); resolve() }
    port2.postMessage(null)
  })
}

async function run(msg: RunMsg) {
  const ac = new AbortController()
  controllers.set(msg.id, ac)
  try {
    const result = await runPipeline(msg.input, msg.steps, {
      // yield before every utility step; a cancel seen here skips this step's apply
      // too (the runner then marks the rest 'aborted') — the caller discards the result
      load: async id => {
        await yieldToMessages()
        if (ac.signal.aborted) throw new Error(CANCELLED)
        return loadUtility(id)
      },
      previews: msg.previews,
      signal: ac.signal,
      env: 'browser-worker',
    })
    if (ac.signal.aborted) {
      // the runner records a throw from `load` as that step's error, and only notices
      // the signal before the NEXT step — so a cancel landing on the last step would
      // otherwise come back as a finished run with a bogus error
      result.aborted = true
      for (const [stepId, message] of Object.entries(result.err)) {
        if (message === CANCELLED) { delete result.err[stepId]; result.skipped[stepId] = 'aborted' }
      }
    }
    ctx.postMessage({ type: 'result', id: msg.id, result })
  } catch (e: any) {
    ctx.postMessage({ type: 'error', id: msg.id, message: e?.message || String(e) })
  } finally {
    controllers.delete(msg.id)
  }
}

ctx.onmessage = ev => {
  const msg = ev.data
  if (msg.type === 'cancel') { controllers.get(msg.id)?.abort(); return }
  if (msg.type === 'run') void run(msg)
}

// lets the client tell a worker that never loaded (no module-worker support: disable
// workers) from one that booted and later died (a crash: fail the run, not the session)
ctx.postMessage({ type: 'ready' })
