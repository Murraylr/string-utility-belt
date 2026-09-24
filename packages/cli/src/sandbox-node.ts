/**
 * The `custom_js` sandbox contract (`src/core/sandbox.ts`) for Node, so
 * `--allow-custom-js` can run it from the CLI.
 *
 * Each run gets a fresh worker thread, and inside it a `node:vm` context that
 * exposes only `input` and a few safe globals (no require/process/import). The
 * host kills the worker when the step's `timeoutMs` runs out or the run is
 * cancelled — the only way to stop code that never yields, including an
 * `await` loop that starves the event loop (vm's own `timeout` bounds just the
 * synchronous part).
 *
 * IMPORTANT — node:vm is NOT a security boundary. Any host object reachable from
 * the context (the console bridge, `crypto`, `input` itself) leads back to the
 * worker's `Function` and from there to `process`, with this process's full
 * rights. This only keeps *accidental* missteps (typos, infinite loops, reaching
 * for `require`) from doing damage, on the assumption you trust the code you're
 * running. Never point `--allow-custom-js` at a pipeline from someone else.
 */
import { Worker } from 'node:worker_threads'
import type { Sandbox, SandboxRequest } from '../../../src/core/sandbox'
import type { Value } from '../../../src/types/utility'

/** Runs inside the worker (CommonJS, since `eval: true` workers are scripts). */
const WORKER_SOURCE = `'use strict'
const { parentPort, workerData } = require('node:worker_threads')
const vm = require('node:vm')
const { format } = require('node:util')
const { code, input, timeoutMs } = workerData
const send = msg => parentPort.postMessage(msg)
const log = (...args) => send({ type: 'log', text: format(...args) })
const context = vm.createContext({
  input,
  console: { log, info: log, warn: log, error: log, debug: log },
  TextEncoder, TextDecoder, structuredClone, atob, btoa, URL, URLSearchParams,
  crypto: globalThis.crypto,
}, { name: 'custom_js', codeGeneration: { strings: true, wasm: false } })
const fail = e => send({
  type: 'error',
  timeout: !!e && e.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT',
  message: e !== null && typeof e === 'object' && 'message' in e ? String(e.message) : String(e),
})
const done = value => {
  try { send({ type: 'result', value }) }
  catch (e) { send({ type: 'error', message: 'Custom code returned a value that cannot be copied out of the sandbox (' + String(e && e.message || e) + ').' }) }
}
let pending
try {
  const script = new vm.Script('(async () => {\\n' + code + '\\n})()', { filename: 'custom_js.js' })
  pending = script.runInContext(context, { timeout: timeoutMs })
} catch (e) { fail(e) }
if (pending) Promise.resolve(pending).then(done, fail)
`

type WorkerMessage =
  | { type: 'log'; text: string }
  | { type: 'result'; value: Value }
  | { type: 'error'; message: string; timeout?: boolean }

/** How long a worker thread may take to boot before its run is abandoned. */
const BOOT_ALLOWANCE_MS = 10_000

function abortError(): Error {
  return Object.assign(new Error('the custom JavaScript run was cancelled'), { name: 'AbortError' })
}

export interface NodeSandboxOptions {
  /** Receives each console call from the code, formatted like `console.log`. Defaults to stderr. */
  log?: (text: string) => void
}

export function createNodeSandbox(opts: NodeSandboxOptions = {}): Sandbox {
  const log = opts.log ?? ((text: string) => { process.stderr.write(`${text}\n`) })
  return {
    run(req: SandboxRequest): Promise<Value> {
      if (req.signal?.aborted) return Promise.reject(abortError())
      return new Promise<Value>((resolve, reject) => {
        const worker = new Worker(WORKER_SOURCE, {
          eval: true,
          workerData: { code: req.code, input: req.input, timeoutMs: req.timeoutMs },
          // never let the worker's own stdio reach ours: stdout is the pipeline's output
          stdout: true,
          stderr: true,
        })
        const timedOut = () => new Error(`custom JS timed out after ${req.timeoutMs}ms`)
        let settled = false
        let timer = setTimeout(() => settle(() => reject(timedOut())), req.timeoutMs + BOOT_ALLOWANCE_MS)
        const onAbort = () => settle(() => reject(abortError()))
        function settle(finish: () => void) {
          if (settled) return
          settled = true
          clearTimeout(timer)
          req.signal?.removeEventListener('abort', onAbort)
          void worker.terminate()
          finish()
        }
        req.signal?.addEventListener('abort', onAbort, { once: true })
        // the budget is for the code itself, not the few dozen ms a worker thread takes to boot
        worker.once('online', () => {
          if (settled) return
          clearTimeout(timer)
          timer = setTimeout(() => settle(() => reject(timedOut())), req.timeoutMs)
        })
        worker.on('message', (msg: WorkerMessage) => {
          if (msg.type === 'log') { if (!settled) log(msg.text); return }
          if (msg.type === 'result') settle(() => resolve(msg.value))
          else settle(() => reject(msg.timeout ? timedOut() : new Error(msg.message)))
        })
        worker.on('error', err => settle(() => reject(err)))
        // a clean exit with no result: the worker's event loop drained while the code still
        // awaited something, i.e. a promise that nothing can ever settle
        worker.on('exit', code => settle(() => reject(new Error(code === 0
          ? 'Custom code never finished: it awaits a promise that nothing will ever settle.'
          : `the custom JS sandbox stopped unexpectedly (exit code ${code})`))))
      })
    },
  }
}
