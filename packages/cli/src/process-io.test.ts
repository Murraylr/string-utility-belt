// @vitest-environment node
import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
import { exitQuietlyOnEpipe, processIo, type ProcessStdio } from './process-io'

function fakeStdio(opts: { stdinTty: boolean; stdoutTty: boolean; input?: (Uint8Array | string)[] }) {
  const written: (Uint8Array | string)[] = []
  const errors: string[] = []
  const stdio: ProcessStdio = {
    stdin: (async function* () { for (const c of opts.input ?? []) yield c })(),
    stdout: { write: c => written.push(c) },
    stderr: { write: s => errors.push(s) },
    isatty: fd => (fd === 0 ? opts.stdinTty : fd === 1 ? opts.stdoutTty : false),
  }
  return { stdio, written, errors }
}

describe('processIo', () => {
  it('takes isTTY from stdout and stdinIsTTY from stdin, independently', () => {
    const piped = processIo(fakeStdio({ stdinTty: false, stdoutTty: true }).stdio)
    expect(piped.isTTY).toBe(true)
    expect(piped.stdinIsTTY).toBe(false)

    const redirected = processIo(fakeStdio({ stdinTty: true, stdoutTty: false }).stdio)
    expect(redirected.isTTY).toBe(false)
    expect(redirected.stdinIsTTY).toBe(true)
  })

  it('reads all of stdin as bytes, whatever the chunk type', async () => {
    const io = processIo(fakeStdio({ stdinTty: false, stdoutTty: false, input: [new Uint8Array([104]), 'i'] }).stdio)
    expect(Array.from(await io.stdin())).toEqual([104, 105])
  })

  it('writes byte views exactly, honouring their offset into a larger buffer', () => {
    const fake = fakeStdio({ stdinTty: false, stdoutTty: false })
    const io = processIo(fake.stdio)
    const view = new Uint8Array([1, 2, 3, 4]).subarray(1, 3)
    io.stdout(view)
    expect(Array.from(fake.written[0] as Uint8Array)).toEqual([2, 3])
  })
})

describe('exitQuietlyOnEpipe', () => {
  it('exits 0 when the reader closed the pipe, 1 for any other write error', () => {
    const stream = new EventEmitter()
    const exit = vi.fn()
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      exitQuietlyOnEpipe(stream, exit)
      stream.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))
      expect(exit).toHaveBeenLastCalledWith(0)
      stream.emit('error', Object.assign(new Error('disk full'), { code: 'ENOSPC' }))
      expect(exit).toHaveBeenLastCalledWith(1)
    } finally {
      stderr.mockRestore()
    }
  })
})
