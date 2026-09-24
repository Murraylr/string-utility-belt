/**
 * Runs a pipeline for the UI. One entry point, so the choice of *where* it runs
 * (main thread vs Web Worker, whole input vs chunks) lives in one place.
 *
 * Order of decisions:
 *  1. Chunked mode, when the pref is on, the input is a big string, and every step
 *     is line-local (`canChunk`). Chunking always runs on the main thread — it
 *     already yields a macrotask between chunks (see `core/streaming.ts`), so a
 *     second thread would only add postMessage overhead for a multi-MB payload.
 *  2. The Web Worker, when it's enabled, available, and every step can run there.
 *  3. The main thread otherwise (also the fallback when the worker is unavailable).
 *     A run that CRASHED the worker is never replayed here: the input that ran it out
 *     of memory would take the tab down (a share link opens straight into a run).
 */
import { runPipeline, type RunResult } from '@/core/runner'
import { canChunk, runChunked } from '@/core/streaming'
import { canRunInWorker } from '@/core/registry'
import type { PipelineStep, Value } from '@/types/utility'
import { registry } from '@/app/registry'
import { readPref } from '@/app/prefs'
import { workerClient } from './workerClient'
import { WorkerCrashedError } from './crash'

export interface ExecOptions {
  previews: boolean
  signal?: AbortSignal
}

export type ExecWhere = 'main' | 'worker' | 'chunked'

export type ExecResult = RunResult & { where: ExecWhere; partial?: boolean }

export type { RunResult }

/** Input large enough that the whole-input worker/main-thread run is skipped for chunking. */
export const CHUNK_THRESHOLD = 1_000_000

const abortedResult = (input: Value, where: ExecWhere): ExecResult => ({
  out: input, previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: true, where,
})

export async function execute(input: Value, steps: PipelineStep[], opts: ExecOptions): Promise<ExecResult> {
  const lookup = (id: string) => registry.get(id)
  // an 'abort' listener added below would never fire for an already-aborted signal
  if (opts.signal?.aborted) return abortedResult(input, 'main')

  const chunkedPref = readPref('chunked', true)
  if (chunkedPref && typeof input === 'string' && input.length > CHUNK_THRESHOLD && canChunk(steps, lookup)) {
    const result = await runChunked(input, steps, {
      load: registry.load, previews: false, signal: opts.signal, env: 'browser-main',
    })
    return { ...result, where: 'chunked' }
  }

  const useWorkerPref = readPref('useWorker', true)
  const workerEligible =
    typeof Worker !== 'undefined' && useWorkerPref && workerClient.isAvailable() && canRunInWorker(steps, lookup)

  if (workerEligible) {
    const { id, promise } = workerClient.run(input, steps, opts.previews)
    const onAbort = () => workerClient.cancel(id)
    opts.signal?.addEventListener('abort', onAbort)
    try {
      const result = await promise
      return { ...result, where: 'worker' }
    } catch (e) {
      // the caller's own abort raced the worker's response: report aborted rather
      // than starting the whole pipeline over on the main thread.
      if (opts.signal?.aborted) return abortedResult(input, 'worker')
      if (e instanceof WorkerCrashedError) throw e
      // any other failure (protocol error, forced termination) falls back below;
      // workerClient itself decides whether workers stay disabled for the session.
    } finally {
      opts.signal?.removeEventListener('abort', onAbort)
    }
  }

  const result = await runPipeline(input, steps, {
    load: registry.load, previews: opts.previews, signal: opts.signal, env: 'browser-main',
  })
  return { ...result, where: 'main' }
}
