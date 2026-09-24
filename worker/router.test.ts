// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import worker from './index'

const ctx = { waitUntil() {}, passThroughOnException() {} } as ExecutionContext
const ORIGIN = 'https://stringutilitybelt.com'
const call = (path: string, init?: RequestInit, env = {}) => worker.fetch(new Request(`${ORIGIN}${path}`, init), env, ctx)

describe('router', () => {
  it.each(['/api', '/api/', '/api/nope', '/api/run/extra', '/api/fetchx'])('answers JSON 404 for %s', async path => {
    const res = await call(path)
    expect(res.status).toBe(404)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect((await res.json() as any).error).toBeTruthy()
  })

  it('delegates non-API paths to the ASSETS binding', async () => {
    const assets = { fetch: vi.fn(async (req: RequestInfo | URL) => new Response(`asset:${new URL(String((req as Request).url ?? req)).pathname}`)) }
    const res = await call('/blog/hello', undefined, { ASSETS: assets })
    expect(await res.text()).toBe('asset:/blog/hello')
    expect(assets.fetch).toHaveBeenCalledTimes(1)
    const root = await call('/', undefined, { ASSETS: assets })
    expect(await root.text()).toBe('asset:/')
  })

  it('answers 404 for non-API paths without an ASSETS binding', async () => {
    const res = await call('/anything')
    expect(res.status).toBe(404)
  })

  it('never hands /api paths to ASSETS', async () => {
    const assets = { fetch: vi.fn(async () => new Response('asset')) }
    await call('/api/nope', undefined, { ASSETS: assets })
    await call('/api/utilities/base64_encode', undefined, { ASSETS: assets })
    expect(assets.fetch).not.toHaveBeenCalled()
  })

  it('keeps CORS off the fetch proxy, including its preflight', async () => {
    const pre = await call('/api/fetch?url=https://example.com/', { method: 'OPTIONS' })
    expect(pre.status).toBe(405)
    expect(pre.headers.get('access-control-allow-origin')).toBeNull()
    const err = await call('/api/fetch?url=http://127.0.0.1/')
    expect(err.status).toBe(403)
    expect(err.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('does not attach CORS to unknown API routes', async () => {
    const res = await call('/api/nope')
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
