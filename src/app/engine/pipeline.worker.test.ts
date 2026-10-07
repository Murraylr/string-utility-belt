import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import type { PipelineStep } from '@/types/utility'

/** Stands in for the worker's global scope: messages in via onmessage, out via postMessage. */
const posted: any[] = []
const scope: { onmessage: ((ev: { data: unknown }) => void) | null; postMessage: (m: unknown) => void } = {
  onmessage: null,
  postMessage: m => { posted.push(m) },
}

/** A real worker handles each incoming message as its own task, never mid-microtask. */
const deliver = (data: unknown) => scope.onmessage!({ data })
/**
 * Delivers as a posted message, the way a real worker receives it: queued behind the
 * run's pending yield and ahead of every later one. Not setTimeout(0), a >=1ms timer
 * in Node that a warm chain of cached utilities can outrun, cancel arriving too late.
 */
const deliverLater = (data: unknown) => {
  const { port1, port2 } = new MessageChannel()
  port1.onmessage = () => { port1.close(); deliver(data) }
  port2.postMessage(null)
}

const resultFor = async (id: string) => {
  await vi.waitFor(() => { if (!posted.some(m => m.id === id)) throw new Error('no reply yet') }, { timeout: 15_000 })
  return posted.find(m => m.id === id)
}

const chain = (n: number): PipelineStep[] =>
  Array.from({ length: n }, (_, i) => ({ id: `s${i}`, utilityId: i % 2 ? 'base64_decode' : 'base64_encode' }))

beforeAll(async () => {
  vi.stubGlobal('self', scope)
  await import('./pipeline.worker')
}, 60_000) // cold cache: the runner and loader map take a while to transform
afterAll(() => { vi.unstubAllGlobals() })

// generous timeouts: each utility's module is transformed on first use (cold cache)
describe('pipeline.worker', { timeout: 20_000 }, () => {
  it('answers a run with its result, previews included', async () => {
    deliver({ type: 'run', id: 'r1', input: 'Café', steps: [{ id: 'd', utilityId: 'diacritics' }], previews: true })
    const msg = await resultFor('r1')
    expect(msg.type).toBe('result')
    expect(msg.result.out).toBe('Cafe')
    expect(msg.result.previews).toEqual({ d: 'Cafe' })
    expect(msg.result.aborted).toBe(false)
  })

  it('handles a cancel that arrives as a later task, between steps, even when every utility is already loaded', async () => {
    deliver({ type: 'run', id: 'warm', input: 'x', steps: chain(2), previews: false })
    await resultFor('warm') // both utilities now cached: loading them no longer yields

    deliver({ type: 'run', id: 'r2', input: 'hello', steps: chain(8), previews: false })
    deliverLater({ type: 'cancel', id: 'r2' })
    const msg = await resultFor('r2')
    expect(msg.result.aborted).toBe(true)
    expect(Object.values(msg.result.skipped)).toContain('aborted')
  })

  it('reports aborted when the cancel lands while the LAST step is loading (no later step to notice it)', async () => {
    // same task: the run is parked at its only step's pre-load yield when the cancel arrives
    deliver({ type: 'run', id: 'r3', input: 'hello', steps: [{ id: 'only', utilityId: 'base64_encode' }], previews: false })
    deliver({ type: 'cancel', id: 'r3' })
    const msg = await resultFor('r3')
    expect(msg.type).toBe('result')
    expect(msg.result.aborted).toBe(true)
    // the cancellation is not reported as if the utility itself had failed
    expect(msg.result.err).toEqual({})
  })

  it('records an unknown (or Object.prototype-named) utility id as that step\'s error', async () => {
    deliver({
      type: 'run', id: 'r4', input: 'x', previews: false,
      steps: [{ id: 'a', utilityId: 'constructor' }, { id: 'b', utilityId: 'no_such_utility' }, { id: 'c', utilityId: 'base64_encode' }],
    })
    const msg = await resultFor('r4')
    expect(msg.type).toBe('result')
    expect(msg.result.err.a).toMatch(/unknown utility/)
    expect(msg.result.err.b).toMatch(/unknown utility/)
    expect(msg.result.out).toBe('eA==')
  })

  it('ignores a cancel for a run it does not know', async () => {
    expect(() => deliver({ type: 'cancel', id: 'nope' })).not.toThrow()
  })
})
