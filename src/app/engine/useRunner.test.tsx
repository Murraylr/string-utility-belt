import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type { PipelineStep } from '@/types/utility'
import { writePref } from '@/app/prefs'

vi.mock('./executor', () => ({ execute: vi.fn() }))

import { execute } from './executor'
import { useRunner, SIZE_GUARD } from './useRunner'

const steps: PipelineStep[] = [{ id: 's1', utilityId: 'noop' }]

function mockExecOk(where: 'main' | 'worker' | 'chunked' = 'main') {
  vi.mocked(execute).mockImplementation(async (input: any) => ({
    out: input, previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: false, where,
  }))
}

const tick = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })

describe('useRunner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    mockExecOk()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.mocked(execute).mockReset()
    localStorage.clear()
  })

  it('runs immediately on first render in live mode', async () => {
    const { result } = renderHook(() => useRunner('hi', steps, { previews: false }))
    await tick()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith('hi', steps, { previews: false, signal: expect.any(AbortSignal) })
    expect(result.current.result?.out).toBe('hi')
    expect(result.current.where).toBe('main')
    expect(result.current.partial).toBe(false)
  })

  it('does not run automatically in manual mode, but runNow() does', async () => {
    const { result, rerender } = renderHook(
      ({ input }) => useRunner(input, steps, { previews: false, live: false }),
      { initialProps: { input: 'a' } },
    )
    await tick()
    expect(execute).not.toHaveBeenCalled()

    rerender({ input: 'b' })
    await tick()
    expect(execute).not.toHaveBeenCalled()

    act(() => result.current.runNow())
    await tick()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith('b', steps, expect.anything())
  })

  it('debounces the next live run adaptively after a slow run', async () => {
    // every call (ours or anything else's) advances by 1000, so our own two calls
    // around one run always measure >= 1000ms elapsed, whatever else calls it too —
    // clamp(1000+ * 2, 60, 800) is deterministically 800 regardless of the exact value
    let counter = 0
    vi.spyOn(performance, 'now').mockImplementation(() => (counter++) * 1000)
    const { rerender } = renderHook(({ input }) => useRunner(input, steps, { previews: false }), {
      initialProps: { input: 'a' },
    })
    await tick() // first run is never debounced
    expect(execute).toHaveBeenCalledTimes(1)

    rerender({ input: 'b' })
    await tick(799)
    expect(execute).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('runs immediately again when the last run was fast', async () => {
    // constant clock: every run measures 0ms elapsed, so debounce never engages
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const { rerender } = renderHook(({ input }) => useRunner(input, steps, { previews: false }), {
      initialProps: { input: 'a' },
    })
    await tick()
    rerender({ input: 'b' })
    await tick(0)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('pauses live auto-run above SIZE_GUARD and exposes largeInput, but runNow() still runs the full input', async () => {
    const big = 'x'.repeat(SIZE_GUARD + 1)
    const { result } = renderHook(() => useRunner(big, steps, { previews: false }))
    await tick()
    expect(execute).not.toHaveBeenCalled()
    expect(result.current.largeInput).toEqual({ size: big.length, paused: true })

    act(() => result.current.runNow())
    await tick()
    expect(execute).toHaveBeenCalledTimes(1)
    expect(execute).toHaveBeenCalledWith(big, steps, expect.anything())
  })

  it('does not report largeInput for input under the guard', async () => {
    const { result } = renderHook(() => useRunner('short', steps, { previews: false }))
    await tick()
    expect(result.current.largeInput).toBeNull()
  })

  it('runs live typing against a prefix when previewLimit is on and the input exceeds it', async () => {
    writePref('previewLimit', true)
    const line = 'y'.repeat(200)
    const bigish = Array.from({ length: 400 }, () => line).join('\n') // > 64KB, well under SIZE_GUARD
    const { result } = renderHook(() => useRunner(bigish, steps, { previews: false }))
    await tick()
    expect(execute).toHaveBeenCalledTimes(1)
    const [sentInput] = vi.mocked(execute).mock.calls[0]
    expect((sentInput as string).length).toBeLessThan(bigish.length)
    expect(result.current.partial).toBe(true)
    // the result itself is marked too, so code holding only `run.result` can tell
    expect(result.current.result?.partial).toBe(true)

    act(() => result.current.runNow())
    await tick()
    const [secondInput] = vi.mocked(execute).mock.calls[1]
    expect(secondInput).toBe(bigish)
    expect(result.current.partial).toBe(false)
    expect(result.current.result?.partial).toBe(false)
  })

  it('does not slice when previewLimit is off', async () => {
    const line = 'y'.repeat(200)
    const bigish = Array.from({ length: 400 }, () => line).join('\n')
    renderHook(() => useRunner(bigish, steps, { previews: false }))
    await tick()
    const [sentInput] = vi.mocked(execute).mock.calls[0]
    expect(sentInput).toBe(bigish)
  })

  it('surfaces an unexpected executor failure', async () => {
    vi.mocked(execute).mockRejectedValue(new Error('boom'))
    const { result } = renderHook(() => useRunner('x', steps, { previews: false }))
    await tick()
    expect(result.current.failure).toBe('boom')
    expect(result.current.running).toBe(false)
  })

  it('debounces by exactly twice the last run time inside the clamp range', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.mocked(execute).mockImplementation(async (input: any) => {
      now += 100 // every run "takes" 100ms → next live run waits 200ms
      return { out: input, previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: false, where: 'main' }
    })
    const { rerender } = renderHook(({ input }) => useRunner(input, steps, { previews: false }), {
      initialProps: { input: 'a' },
    })
    await tick()
    rerender({ input: 'b' })
    await tick(199)
    expect(execute).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('never debounces an explicit runNow(), even after a slow run', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.mocked(execute).mockImplementation(async (input: any) => {
      now += 5000
      return { out: input, previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: false, where: 'main' }
    })
    const { result } = renderHook(() => useRunner('a', steps, { previews: false }))
    await tick()
    expect(execute).toHaveBeenCalledTimes(1)
    act(() => result.current.runNow())
    await tick(0)
    expect(execute).toHaveBeenCalledTimes(2)
  })

  it('clears `running` when an in-flight manual run is superseded by an edit in manual mode', async () => {
    vi.mocked(execute).mockImplementation(() => new Promise(() => {}))
    const { result, rerender } = renderHook(
      ({ input }) => useRunner(input, steps, { previews: false, live: false }),
      { initialProps: { input: 'a' } },
    )
    await tick()
    act(() => result.current.runNow())
    await tick()
    expect(result.current.running).toBe(true)
    rerender({ input: 'ab' }) // aborts the manual run; manual mode does not start another
    await tick()
    expect(result.current.running).toBe(false)
  })

  it('clears `running` when an in-flight live run is superseded by an oversized (paused) input', async () => {
    vi.mocked(execute).mockImplementation(() => new Promise(() => {}))
    const { result, rerender } = renderHook(({ input }) => useRunner(input, steps, { previews: false }), {
      initialProps: { input: 'a' },
    })
    await tick()
    expect(result.current.running).toBe(true)
    rerender({ input: 'x'.repeat(SIZE_GUARD + 1) })
    await tick()
    expect(result.current.running).toBe(false)
    expect(result.current.largeInput).toEqual({ size: SIZE_GUARD + 1, paused: true })
  })

  it('drops the large-input banner as soon as the input shrinks, not after the next (debounced) run', async () => {
    let now = 0
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    vi.mocked(execute).mockImplementation(async (input: any) => {
      now += 1000
      return { out: input, previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: false, where: 'main' }
    })
    const big = 'x'.repeat(SIZE_GUARD + 1)
    const { result, rerender } = renderHook(({ input }) => useRunner(input, steps, { previews: false }), {
      initialProps: { input: big },
    })
    await tick()
    act(() => result.current.runNow()) // a slow full run → the next live run is debounced 800ms
    await tick()
    expect(result.current.largeInput?.paused).toBe(true)
    rerender({ input: 'small' })
    await tick(0)
    expect(result.current.largeInput).toBeNull()
  })

  it('with previewLimit on, an oversized input keeps live-previewing its first 64 KB instead of pausing', async () => {
    writePref('previewLimit', true)
    const big = 'x'.repeat(SIZE_GUARD + 1)
    const { result } = renderHook(() => useRunner(big, steps, { previews: false }))
    await tick()
    expect(execute).toHaveBeenCalledTimes(1)
    const [sent] = vi.mocked(execute).mock.calls[0]
    expect((sent as string).length).toBe(65_536)
    expect(result.current.partial).toBe(true)
    expect(result.current.largeInput).toEqual({ size: big.length, paused: false })

    act(() => result.current.runNow())
    await tick()
    expect(vi.mocked(execute).mock.calls[1][0]).toBe(big)
    expect(result.current.partial).toBe(false)
  })

  it('aborts a superseded run', async () => {
    const signals: AbortSignal[] = []
    vi.mocked(execute).mockImplementation(async (_input: any, _s: any, opts: any) => {
      signals.push(opts.signal)
      return new Promise(() => {}) // never resolves, so it must be aborted rather than completed
    })
    const { rerender } = renderHook(({ input }) => useRunner(input, steps, { previews: false }), {
      initialProps: { input: 'a' },
    })
    await tick()
    expect(signals).toHaveLength(1)
    expect(signals[0].aborted).toBe(false)
    rerender({ input: 'b' })
    await tick()
    expect(signals[0].aborted).toBe(true)
  })
})
