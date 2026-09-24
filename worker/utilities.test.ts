// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { EXAMPLES } from '../src/utilities/_generated/examples'
import { MANIFEST } from '../src/utilities/_generated/manifest'
import worker from './index'

const ctx = { waitUntil() {}, passThroughOnException() {} } as ExecutionContext
const ORIGIN = 'https://stringutilitybelt.com'

async function get(path: string, init?: RequestInit) {
  const res = await worker.fetch(new Request(`${ORIGIN}${path}`, init), {}, ctx)
  return { res, data: res.status === 204 || init?.method === 'HEAD' ? null : await res.json() as any }
}

describe('GET /api/utilities', () => {
  it('lists every utility with availableOnEdge, cacheable and CORS-enabled', async () => {
    const { res, data } = await get('/api/utilities')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(data.count).toBe(MANIFEST.length)
    expect(data.utilities).toHaveLength(MANIFEST.length)
    expect(data.categories).toContain('Hashing')
    const byId = Object.fromEntries(data.utilities.map((u: any) => [u.id, u]))
    expect(byId.base64_encode).toMatchObject({ name: MANIFEST.find(m => m.id === 'base64_encode')!.name, availableOnEdge: true })
    expect(byId.sha3.availableOnEdge).toBe(false)
    expect(byId.xml_to_json.availableOnEdge).toBe(false)
    expect(byId.custom_js.availableOnEdge).toBe(false)
    expect(data.utilities.every((u: any) => typeof u.availableOnEdge === 'boolean')).toBe(true)
    // metadata only: examples come from the detail route
    expect(byId.base64_encode.examples).toBeUndefined()
  })

  it('agrees with each utility’s declared env', async () => {
    const { data } = await get('/api/utilities')
    for (const u of data.utilities) {
      expect(u.availableOnEdge, u.id).toBe(u.env.length === 0)
    }
  })

  it('filters by category, case-insensitively', async () => {
    const { data } = await get('/api/utilities?category=hashing')
    expect(data.count).toBeGreaterThan(0)
    expect(data.utilities.every((u: any) => u.category === 'Hashing')).toBe(true)
    expect(data.count).toBe(MANIFEST.filter(m => m.category === 'Hashing').length)
  })

  it('searches id, name, description, tags and aliases; every term must match', async () => {
    const tag = await get('/api/utilities?q=uppercase')
    expect(tag.data.utilities.map((u: any) => u.id)).toContain('case')
    const alias = await get('/api/utilities?q=atob')
    expect(alias.data.utilities.map((u: any) => u.id)).toContain('base64_decode')
    const both = await get('/api/utilities?q=base64%20decode&category=Decoding')
    expect(both.data.utilities.every((u: any) => u.category === 'Decoding')).toBe(true)
    const none = await get('/api/utilities?q=zzzz-no-such-thing')
    expect(none.data).toMatchObject({ count: 0, utilities: [] })
  })

  it('treats a trailing slash as the list', async () => {
    const { data } = await get('/api/utilities/')
    expect(data.count).toBe(MANIFEST.length)
  })
})

describe('GET /api/utilities/:id', () => {
  it('returns metadata, availableOnEdge and examples', async () => {
    const { res, data } = await get('/api/utilities/base64_encode')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=3600')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(data).toMatchObject({ id: 'base64_encode', availableOnEdge: true })
    expect(data.examples).toEqual(EXAMPLES.base64_encode)
    expect(data.examples.length).toBeGreaterThan(0)
  })

  it('marks edge-incompatible utilities', async () => {
    const { data } = await get('/api/utilities/sha3')
    expect(data).toMatchObject({ id: 'sha3', availableOnEdge: false, env: ['wasm'] })
  })

  it('answers 404 JSON (with CORS) for unknown ids', async () => {
    for (const path of ['/api/utilities/nope', '/api/utilities/base64_encode/extra', '/api/utilities/%E0%A4%A']) {
      const { res, data } = await get(path)
      expect(res.status, path).toBe(404)
      expect(data.error).toMatch(/unknown utility/)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      expect(res.headers.get('cache-control')).toBe('no-store')
    }
  })

  it('supports HEAD, OPTIONS preflight, and refuses other methods', async () => {
    const head = await get('/api/utilities/base64_encode', { method: 'HEAD' })
    expect(head.res.status).toBe(200)
    expect(await head.res.text()).toBe('')
    const pre = await get('/api/utilities/base64_encode', { method: 'OPTIONS' })
    expect(pre.res.status).toBe(204)
    expect(pre.res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
    const post = await get('/api/utilities', { method: 'POST', body: '{}' })
    expect(post.res.status).toBe(405)
    expect(post.data.error).toBeTruthy()
  })
})
