/**
 * The pipeline worker died mid-run (typically out of memory on a pathological input).
 * Distinct from "workers are unavailable": the executor must NOT retry such a run on
 * the main thread, where the same input would take the whole tab down with it.
 */
export class WorkerCrashedError extends Error {
  constructor() {
    super('This pipeline crashed the background worker (probably out of memory) — try a smaller input.')
    this.name = 'WorkerCrashedError'
  }
}
