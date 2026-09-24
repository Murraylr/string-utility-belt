/**
 * Where tool jobs run. `inProcessExecutor` runs them on the calling thread with a
 * cooperative timeout — fine for tests, but synchronous work (a catastrophic
 * regex, bcrypt at cost 31) blocks the event loop past any timer, and a runaway
 * allocation (`repeat` with a huge count) aborts the process: either would take a
 * stdio server down for good. `createProcessExecutor` runs each job in a pooled
 * child process that is killed when the budget runs out or the client cancels, so
 * the limit is real and a crash is contained. (Worker threads are not enough: a
 * V8 fatal OOM inside a worker still aborts the whole process.)
 *
 * IPC protocol (see `serveJobs`): the parent sends `{ job, timeoutMs }`; the child
 * replies `{ ok: true, value }` or `{ ok: false, error, retire? }`.
 */
import { fork } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { TimeoutError, errorMessage, withTimeout } from './format'

export interface RunOptions {
  timeoutMs: number
  /** The client's cancellation signal for this request. */
  signal?: AbortSignal
}

export interface Executor {
  run<T>(job: unknown, opts: RunOptions): Promise<T>
  /** Stops every runner; later calls reject. */
  close(): Promise<void>
}

type Handler = (job: any, signal: AbortSignal) => Promise<unknown>

/** Runs jobs on this thread. The timeout only interrupts work that yields. */
export function inProcessExecutor(handler: Handler): Executor {
  return {
    run: <T>(job: unknown, { timeoutMs, signal }: RunOptions) =>
      withTimeout(s => handler(job, s), timeoutMs, signal) as Promise<T>,
    close: async () => {},
  }
}

type Reply = { ok: true; value: unknown } | { ok: false; error: string; retire?: boolean }

/** The IPC side of a forked child (`process` in a job runner). */
export interface JobEndpoint {
  on(event: 'message', listener: (message: any) => void): unknown
  on(event: 'disconnect', listener: () => void): unknown
  send?(message: unknown): unknown
}

/**
 * Runs on its own thread in a job runner, so it still fires while the main thread
 * is stuck in synchronous work: if the parent server is gone (killed without a
 * chance to clean up), the runner kills itself instead of spinning on as an orphan.
 */
const WATCHDOG = `
const { workerData } = require('node:worker_threads')
setInterval(() => {
  try { process.kill(workerData.parentPid, 0) }
  catch (e) { if (e.code === 'ESRCH') process.kill(process.pid, 'SIGKILL') }
}, workerData.intervalMs)
`

/** Job-runner side of the protocol: answer each job with `handler`'s result; die with the parent. */
export function serveJobs(endpoint: JobEndpoint, handler: Handler,
  { parentPid = process.ppid, watchdogMs = 1000 }: { parentPid?: number; watchdogMs?: number } = {}): void {
  new Worker(WATCHDOG, { eval: true, workerData: { parentPid, intervalMs: watchdogMs } }).unref()
  endpoint.on('message', async ({ job, timeoutMs }: { job: unknown; timeoutMs: number }) => {
    let reply: Reply
    try {
      reply = { ok: true, value: await withTimeout(s => handler(job, s), timeoutMs) }
    } catch (e) {
      // work that ignored the abort may still be running in this runner: never reuse it
      reply = { ok: false, error: errorMessage(e), retire: e instanceof TimeoutError }
    }
    endpoint.send?.(reply)
  })
  endpoint.on('disconnect', () => process.exit(0))
}

export interface ProcessExecutorOptions {
  /** Arguments that make `entry` act as a job runner. */
  args?: string[]
  /** Concurrent jobs (one runner each); further calls queue. Default 4. */
  maxRunners?: number
  /** Warm runners kept for reuse between calls. Default 2. */
  maxIdle?: number
  /** V8 old-space cap per runner (MB), so a runaway allocation fails fast. Default 512. */
  maxOldSpaceMb?: number
  /** Extra time a runner gets to report its own cooperative timeout before it is killed. */
  graceMs?: number
}

/**
 * Pooled child-process executor. `entry` is a script that calls `serveJobs(process, …)`
 * when started with `args` (for the built server: the server file itself).
 * Runner stdout/stderr go to this process's stderr: stdout carries the JSON-RPC stream.
 */
export function createProcessExecutor(entry: string | URL, opts: ProcessExecutorOptions = {}): Executor {
  const { args = [], maxRunners = 4, maxIdle = 2, maxOldSpaceMb = 512, graceMs = 250 } = opts
  const modulePath = entry instanceof URL ? fileURLToPath(entry) : entry
  const idle: ChildProcess[] = []
  const alive = new Set<ChildProcess>()
  const waiting: Array<() => void> = []
  const stderrTail = new WeakMap<ChildProcess, string>()
  const outOfMemory = new WeakSet<ChildProcess>()
  let closed = false

  const spawn = () => {
    const child = fork(modulePath, args, {
      execArgv: [`--max-old-space-size=${maxOldSpaceMb}`], // never inherit the parent's loaders/flags
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      serialization: 'advanced',
    })
    child.stdout!.on('data', chunk => process.stderr.write(chunk))
    child.stderr!.on('data', chunk => {
      process.stderr.write(chunk)
      // V8's fatal OOM line is followed by a long native stack: remember it, don't buffer it
      const text = (stderrTail.get(child) ?? '') + String(chunk)
      if (/heap out of memory/i.test(text)) outOfMemory.add(child)
      stderrTail.set(child, text.slice(-64))
    })
    // no runner handle (process, IPC channel, stdio pipes) may keep a disconnected server alive
    for (const handle of [child, child.channel, child.stdout, child.stderr] as Array<{ unref?: () => void } | null>) {
      handle?.unref?.()
    }
    alive.add(child)
    child.once('exit', () => {
      alive.delete(child)
      if (idle.includes(child)) idle.splice(idle.indexOf(child), 1)
    })
    return child
  }

  const kill = (child: ChildProcess) => { if (alive.delete(child)) child.kill('SIGKILL') }

  async function acquire(): Promise<ChildProcess> {
    for (;;) {
      if (closed) throw new Error('executor is closed')
      const child = idle.pop()
      if (child) return child
      if (alive.size < maxRunners) return spawn()
      await new Promise<void>(resolve => waiting.push(resolve))
    }
  }

  function release(child: ChildProcess, reusable: boolean) {
    if (reusable && !closed && idle.length < maxIdle && child.connected) idle.push(child)
    else kill(child)
    waiting.shift()?.()
  }

  const crashMessage = (child: ChildProcess, code: number | null, signal: NodeJS.Signals | null) =>
    outOfMemory.has(child)
      ? 'ran out of memory'
      : `job runner exited unexpectedly (${signal ? `signal ${signal}` : `code ${code}`})`

  return {
    async run<T>(job: unknown, { timeoutMs, signal }: RunOptions): Promise<T> {
      if (signal?.aborted) throw new Error('cancelled')
      const child = await acquire()
      if (signal?.aborted) { release(child, true); throw new Error('cancelled') } // cancelled while queued
      return new Promise<T>((resolve, reject) => {
        let settled = false
        const finish = (reusable: boolean, settle: () => void) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          signal?.removeEventListener('abort', onAbort)
          child.off('message', onMessage).off('error', onError).off('close', onClose)
          release(child, reusable)
          settle()
        }
        const onMessage = (m: Reply) => finish(m.ok || !m.retire,
          () => (m.ok ? resolve(m.value as T) : reject(new Error(m.error))))
        const onError = (e: Error) => finish(false, () => reject(e))
        // 'close' (not 'exit'): it fires once stderr is drained, so the OOM report is readable
        const onClose = (code: number | null, sig: NodeJS.Signals | null) =>
          finish(false, () => reject(new Error(crashMessage(child, code, sig))))
        const onAbort = () => finish(false, () => reject(new Error('cancelled')))
        const timer = setTimeout(() => finish(false, () => reject(new TimeoutError(timeoutMs))), timeoutMs + graceMs)
        child.on('message', onMessage).on('error', onError).on('close', onClose)
        signal?.addEventListener('abort', onAbort, { once: true })
        child.send({ job, timeoutMs }, err => { if (err) onError(err) })
      })
    },
    /** Kills every runner — busy ones too, whose calls then reject. */
    async close() {
      closed = true
      waiting.splice(0).forEach(wake => wake())
      idle.length = 0
      ;[...alive].forEach(kill)
    },
  }
}
