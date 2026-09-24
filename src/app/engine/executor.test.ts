import { describe, it, expect, vi, afterEach } from 'vitest'
import { writePref } from '@/app/prefs'
import type { PipelineStep } from '@/types/utility'
import { WorkerCrashedError } from './crash'

vi.mock('./workerClient', () => ({
  workerClient: { isAvailable: vi.fn(() => true), run: vi.fn(), cancel: vi.fn() },
}))

const { execute, CHUNK_THRESHOLD } = await import('./executor')
const { workerClient } = await import('./workerClient')

const streamableStep: PipelineStep[] = [{ id: 's1', utilityId: 'diacritics' }]
const nonStreamableStep: PipelineStep[] = [{ id: 's1', utilityId: 'base64_encode' }]

const bigInput = (over = 1000) => {
  const line = 'café '.repeat(50)
  const lines = Array.from({ length: Math.ceil((CHUNK_THRESHOLD + over) / (line.length + 1)) }, () => line)
  return lines.join('\n')
}

describe('execute', () => {
  afterEach(() => {
    localStorage.clear()
    vi.mocked(workerClient.isAvailable).mockReturnValue(true)
    vi.mocked(workerClient.run).mockReset()
    vi.mocked(workerClient.cancel).mockReset()
    delete (globalThis as any).Worker
  })

  it('runs on the main thread in jsdom (no Worker global)', async () => {
    expect(typeof Worker).toBe('undefined')
    const res = await execute('café', streamableStep, { previews: false })
    expect(res.where).toBe('main')
    expect(res.out).toBe('cafe')
    expect(workerClient.run).not.toHaveBeenCalled()
  })

  it('uses chunked mode for a large streamable-only string input', async () => {
    const input = bigInput()
    expect(input.length).toBeGreaterThan(CHUNK_THRESHOLD)
    const res = await execute(input, streamableStep, { previews: false })
    expect(res.where).toBe('chunked')
    expect(res.out).toBe(input.replace(/é/g, 'e'))
  }, 20000)

  it('does not chunk when the "chunked" pref is off', async () => {
    writePref('chunked', false)
    const res = await execute(bigInput(), streamableStep, { previews: false })
    expect(res.where).toBe('main')
  }, 20000)

  it('does not chunk when a step is not streamable', async () => {
    const res = await execute(bigInput(), nonStreamableStep, { previews: false })
    expect(res.where).toBe('main')
  }, 20000)

  it('uses the worker when available and every step can run there', async () => {
    ;(globalThis as any).Worker = class {}
    vi.mocked(workerClient.run).mockReturnValue({ id: '1', promise: Promise.resolve({
      out: 'WORKER', previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: false,
    } as any) })
    const res = await execute('x', streamableStep, { previews: false })
    expect(res.where).toBe('worker')
    expect(res.out).toBe('WORKER')
  })

  it('keeps a pipeline with a DOM-only utility on the main thread even when a Worker exists', async () => {
    ;(globalThis as any).Worker = class {}
    const res = await execute('<b>hi</b>', [{ id: 'h', utilityId: 'html_to_markdown' }], { previews: false })
    expect(res.where).toBe('main')
    expect(workerClient.run).not.toHaveBeenCalled()
  })

  it('keeps a pipeline on the main thread when a nested (macro) step needs the DOM', async () => {
    ;(globalThis as any).Worker = class {}
    const steps = [{
      id: 'm', type: 'macro', name: 'm',
      steps: [{ id: 'a', utilityId: 'diacritics' }, { id: 'h', utilityId: 'html_to_markdown' }],
    }] as PipelineStep[]
    const res = await execute('x', steps, { previews: false })
    expect(res.where).toBe('main')
    expect(workerClient.run).not.toHaveBeenCalled()
  })

  it('forwards the caller\'s abort to workerClient.cancel with the run id', async () => {
    ;(globalThis as any).Worker = class {}
    let settle!: (r: any) => void
    vi.mocked(workerClient.run).mockReturnValue({ id: '42', promise: new Promise(r => { settle = r }) })
    const ac = new AbortController()
    const pending = execute('x', streamableStep, { previews: false, signal: ac.signal })
    ac.abort()
    expect(workerClient.cancel).toHaveBeenCalledWith('42')
    settle({ out: 'x', previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: true })
    expect((await pending).aborted).toBe(true)
  })

  it('does not start a worker run for a signal that is already aborted', async () => {
    ;(globalThis as any).Worker = class {}
    // a worker that would never answer: execute must not wait on it
    vi.mocked(workerClient.run).mockReturnValue({ id: '7', promise: new Promise(() => {}) })
    const ac = new AbortController()
    ac.abort()
    const res = await execute('café', streamableStep, { previews: false, signal: ac.signal })
    expect(res.aborted).toBe(true)
    expect(res.out).toBe('café')
    expect(workerClient.run).not.toHaveBeenCalled()
  })

  it('does not use the worker when the "useWorker" pref is off', async () => {
    ;(globalThis as any).Worker = class {}
    writePref('useWorker', false)
    const res = await execute('café', streamableStep, { previews: false })
    expect(res.where).toBe('main')
    expect(workerClient.run).not.toHaveBeenCalled()
  })

  it('never replays a run that crashed the worker on the main thread', async () => {
    ;(globalThis as any).Worker = class {}
    vi.mocked(workerClient.run).mockReturnValue({ id: '1', promise: Promise.reject(new WorkerCrashedError()) })
    await expect(execute('café', streamableStep, { previews: false })).rejects.toThrow(/crashed the background worker/)
  })

  it('falls back to the main thread when the worker run rejects (not the caller\'s abort)', async () => {
    ;(globalThis as any).Worker = class {}
    vi.mocked(workerClient.run).mockReturnValue({ id: '1', promise: Promise.reject(new Error('worker unavailable')) })
    const res = await execute('café', streamableStep, { previews: false })
    expect(res.where).toBe('main')
    expect(res.out).toBe('cafe')
  })

  it('reports aborted without falling back when the caller\'s own signal fired', async () => {
    ;(globalThis as any).Worker = class {}
    const ac = new AbortController()
    vi.mocked(workerClient.run).mockImplementation(() => {
      const promise = new Promise<any>((_resolve, reject) => {
        ac.signal.addEventListener('abort', () => reject(new Error('cancelled')))
      })
      return { id: '1', promise }
    })
    const runPromise = execute('café', streamableStep, { previews: false, signal: ac.signal })
    ac.abort()
    const res = await runPromise
    expect(res.where).toBe('worker')
    expect(res.aborted).toBe(true)
    // not run on the main thread: the original (untransformed) input comes back
    expect(res.out).toBe('café')
  })
})
