// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createApi } from './api'
import type { ApiEnv } from './env'

const ORIGIN = 'https://stringutilitybelt.com'
const SAME_SITE = { 'content-type': 'application/json', 'sec-fetch-site': 'same-origin', origin: ORIGIN }

function setup(limit = 30) {
  const writeDataPoint = vi.fn()
  const env: ApiEnv = { EVENTS: { writeDataPoint } }
  const api = createApi({ eventRateLimit: { limit, windowMs: 60_000 } })
  const send = (body: unknown, headers: Record<string, string> = SAME_SITE, method = 'POST') =>
    api.fetch(new Request(`${ORIGIN}/api/event`, {
      method,
      headers: { 'cf-connecting-ip': '203.0.113.7', ...headers },
      body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    }), env)
  return { send, writeDataPoint }
}

describe('POST /api/event', () => {
  it('counts each allowed event as one data point: the name as index, its ids as blobs', async () => {
    const { send, writeDataPoint } = setup()
    const events = [
      [{ name: 'sponsor_click', sponsorship: 'acme-2026-11', page: 'util/jwt_decode' }, ['acme-2026-11', 'util/jwt_decode']],
      [{ name: 'integration_click', integration: 'mcp', source: 'promo_rail' }, ['mcp', 'promo_rail']],
      [{ name: 'recipe_open', recipe: 'decode-kubernetes-secret' }, ['decode-kubernetes-secret', '']],
    ] as const
    for (const [event, blobs] of events) {
      const res = await send(event)
      expect(res.status).toBe(204)
      expect(res.headers.get('access-control-allow-origin')).toBeNull()
      expect(writeDataPoint).toHaveBeenLastCalledWith({ indexes: [event.name], blobs, doubles: [1] })
    }
  })

  it.each([
    ['an unknown event', { name: 'page_view', path: '/' }],
    ['an extra field', { name: 'recipe_open', recipe: 'x', input: 'secret' }],
    ['a missing field', { name: 'sponsor_click', sponsorship: 'acme' }],
    ['free text as an id', { name: 'recipe_open', recipe: 'Bearer eyJhbGciOi…' }],
    ['a page outside the sponsorable kinds', { name: 'sponsor_click', sponsorship: 'acme', page: 'p/N4Ig' }],
    ['an integration that does not exist', { name: 'integration_click', integration: 'firefox', source: 'header' }],
    ['an unknown source', { name: 'integration_click', integration: 'cli', source: 'email' }],
    ['an array', [{ name: 'recipe_open', recipe: 'x' }]],
  ])('refuses %s without counting it', async (_, body) => {
    const { send, writeDataPoint } = setup()
    const res = await send(body)
    expect(res.status).toBe(400)
    expect(writeDataPoint).not.toHaveBeenCalled()
  })

  it('refuses a body that is not JSON, or too long to be an event', async () => {
    const { send, writeDataPoint } = setup()
    expect((await send('{nope')).status).toBe(400)
    expect((await send({ name: 'recipe_open', recipe: 'x'.repeat(600) })).status).toBe(413)
    expect(writeDataPoint).not.toHaveBeenCalled()
  })

  it('only takes events from pages on this site', async () => {
    const { send, writeDataPoint } = setup()
    const event = { name: 'recipe_open', recipe: 'x' }
    expect((await send(event, { 'content-type': 'application/json' })).status).toBe(403)
    expect((await send(event, { ...SAME_SITE, 'sec-fetch-site': 'cross-site' })).status).toBe(403)
    expect((await send(event, { ...SAME_SITE, origin: 'https://evil.example' })).status).toBe(403)
    expect(writeDataPoint).not.toHaveBeenCalled()
  })

  it('answers only POST', async () => {
    const { send } = setup()
    const res = await send(undefined, SAME_SITE, 'GET')
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST')
  })

  it('limits each client address', async () => {
    const { send, writeDataPoint } = setup(2)
    const event = { name: 'recipe_open', recipe: 'x' }
    expect((await send(event)).status).toBe(204)
    expect((await send(event)).status).toBe(204)
    const limited = await send(event)
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBeTruthy()
    expect(writeDataPoint).toHaveBeenCalledTimes(2)
  })

  it('accepts events without a dataset bound (local dev, tests)', async () => {
    const api = createApi()
    const res = await api.fetch(new Request(`${ORIGIN}/api/event`, {
      method: 'POST', headers: SAME_SITE, body: JSON.stringify({ name: 'recipe_open', recipe: 'x' }),
    }), {})
    expect(res.status).toBe(204)
  })
})
