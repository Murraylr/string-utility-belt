/**
 * The real process's stdio as a `CliIo` — kept apart from bin.ts (which runs
 * `main` on import) so the wiring itself is testable.
 */
import { isatty } from 'node:tty'
import type { CliIo } from './args'

export interface ProcessStdio {
  stdin: AsyncIterable<Uint8Array | string>
  stdout: { write(chunk: Uint8Array | string): unknown }
  stderr: { write(chunk: string): unknown }
  /** `tty.isatty` — asks about a file descriptor without opening a stream on it. */
  isatty: (fd: number) => boolean
}

const realStdio = (): ProcessStdio => ({
  // a getter, so process.stdin is only opened when input is actually read
  get stdin() { return process.stdin },
  stdout: process.stdout,
  stderr: process.stderr,
  isatty,
})

export function processIo(stdio: ProcessStdio = realStdio()): CliIo {
  return {
    async stdin() {
      const chunks: Buffer[] = []
      for await (const chunk of stdio.stdin) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk))
      return new Uint8Array(Buffer.concat(chunks))
    },
    stdout: b => { stdio.stdout.write(typeof b === 'string' ? b : Buffer.from(b.buffer, b.byteOffset, b.byteLength)) },
    stderr: s => { stdio.stderr.write(s) },
    // the trailing-newline rule is about where output goes; the sample-input rule about where input comes from
    isTTY: stdio.isatty(1),
    stdinIsTTY: stdio.isatty(0),
  }
}

interface ErrorEmitter {
  on(event: 'error', listener: (err: NodeJS.ErrnoException) => void): unknown
}

/**
 * `subelt … | head` closes the pipe before we finish writing: that is the reader
 * saying "enough", not a failure, so stop quietly instead of crashing with EPIPE.
 */
export function exitQuietlyOnEpipe(stream: ErrorEmitter, exit: (code: number) => void = code => process.exit(code)): void {
  stream.on('error', err => {
    if (err.code === 'EPIPE') { exit(0); return }
    process.stderr.write(`subelt: cannot write output: ${err.message}\n`)
    exit(1)
  })
}
