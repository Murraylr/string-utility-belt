/**
 * Entry point for `node dist/server.mjs`. Normally it connects `createServer()` to
 * stdio; the same file, forked with `--job-runner`, is the child process that
 * actually runs utility code (see executor.ts).
 * The shebang line is added by vite.config.ts's Rollup output banner, not here —
 * a second one surviving into the bundle is invalid JavaScript past line 1.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createProcessExecutor, serveJobs } from './executor'
import { runJob } from './jobs'
import { TOOL_TIMEOUT_MS } from './limits'
import { createServer } from './server'

const JOB_RUNNER_FLAG = '--job-runner'

// stdout carries the JSON-RPC stream: a stray console.log from any dependency would corrupt it.
console.log = console.info = console.debug = console.error.bind(console)

/** `SUBELT_MCP_TIMEOUT_MS` overrides the per-call budget (a positive integer), else the 20 s default. */
function timeoutFromEnv(): number {
  const n = Number(process.env.SUBELT_MCP_TIMEOUT_MS)
  return Number.isInteger(n) && n > 0 ? n : TOOL_TIMEOUT_MS
}

async function main() {
  const executor = createProcessExecutor(new URL(import.meta.url), { args: [JOB_RUNNER_FLAG] })
  const server = createServer({ executor, timeoutMs: timeoutFromEnv() })
  // The client closing stdin (or signalling) ends the session: kill runners, busy ones
  // included, so none is left computing for a server that no longer exists.
  let stopping = false
  const shutdown = () => {
    if (stopping) return
    stopping = true
    void executor.close().finally(() => process.exit(0))
  }
  process.stdin.once('end', shutdown).once('close', shutdown)
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) process.once(sig, shutdown)
  await server.connect(new StdioServerTransport())
}

if (process.argv.includes(JOB_RUNNER_FLAG) && process.send) {
  serveJobs(process, runJob)
} else {
  main().catch(err => {
    console.error('subelt-mcp failed to start:', err)
    process.exit(1)
  })
}
