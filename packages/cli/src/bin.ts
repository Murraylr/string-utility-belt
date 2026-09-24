/**
 * Process wiring for `subelt`: real stdin/stdout/stderr, real exit code.
 * The shebang is added by the build (see vite.config.ts's `banner`), not here.
 */
import { main } from './main'
import { exitQuietlyOnEpipe, processIo } from './process-io'

exitQuietlyOnEpipe(process.stdout)

main(process.argv.slice(2), processIo())
  // exitCode rather than process.exit(): lets buffered stdout drain before Node exits
  .then(code => { process.exitCode = code })
  .catch((err: unknown) => {
    process.stderr.write(`subelt: unexpected error: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exitCode = 1
  })
