import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { Connect, ResolvedConfig, ViteDevServer } from 'vite'
import { guideIdFromUrl, listGuides, utilityGuides } from './vite-plugin-guides'

const tmp = mkdtempSync(path.join(os.tmpdir(), 'guides-plugin-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

const utilities = path.join(tmp, 'src', 'utilities')
for (const [id, guide] of [['trim', '## trim guide'], ['pad', '## pad guide'], ['no_guide', null], ['_generated', '## not a utility']] as const) {
  mkdirSync(path.join(utilities, id), { recursive: true })
  if (guide) writeFileSync(path.join(utilities, id, 'guide.md'), guide)
}

type Hooks = {
  configResolved: (c: ResolvedConfig) => void
  configureServer: (s: ViteDevServer) => void
  generateBundle: (this: { emitFile: (f: unknown) => void }) => void
}

function setup(config: { base?: string; ssr?: boolean } = {}) {
  const plugin = utilityGuides() as unknown as Hooks
  plugin.configResolved({ root: tmp, base: config.base ?? '/', build: { ssr: config.ssr ?? false } } as unknown as ResolvedConfig)
  let middleware: Connect.NextHandleFunction | undefined
  plugin.configureServer({ middlewares: { use: (fn: Connect.NextHandleFunction) => { middleware = fn } } } as unknown as ViteDevServer)
  const request = (url: string) => {
    const headers: Record<string, string> = {}
    let body: string | undefined
    let passed = false
    const res = { setHeader: (k: string, v: string) => { headers[k.toLowerCase()] = v }, end: (b: Buffer) => { body = String(b) } }
    middleware!({ url } as Connect.IncomingMessage, res as never, () => { passed = true })
    return { headers, body, passed }
  }
  return { plugin, request }
}

describe('guideIdFromUrl', () => {
  it('takes only safe ids from /guides/<id>.md', () => {
    expect(guideIdFromUrl('/guides/base64_encode.md')).toBe('base64_encode')
    expect(guideIdFromUrl('/guides/trim.md?v=1')).toBe('trim')
    expect(guideIdFromUrl('/guides/../secret.md')).toBeNull()
    expect(guideIdFromUrl('/guides/%2e%2e.md')).toBeNull()
    expect(guideIdFromUrl('/guides/a/b.md')).toBeNull()
    expect(guideIdFromUrl('/blog/trim.md')).toBeNull()
  })
})

describe('utilityGuides plugin', () => {
  it('lists utilities that have a guide, skipping generated folders', () => {
    expect(listGuides(utilities)).toEqual(['pad', 'trim'])
  })

  it('dev server answers /guides/<id>.md from disk as markdown', () => {
    const { request } = setup()
    const hit = request('/guides/trim.md')
    expect(hit.passed).toBe(false)
    expect(hit.body).toBe('## trim guide')
    expect(hit.headers['content-type']).toBe('text/markdown; charset=utf-8')
  })

  it('passes anything else on (missing guides, traversal, other paths)', () => {
    const { request } = setup()
    expect(request('/guides/no_guide.md').passed).toBe(true)
    expect(request('/guides/..%2F..%2Fpackage.json.md').passed).toBe(true)
    expect(request('/index.html').passed).toBe(true)
  })

  it('honours a non-root base', () => {
    const { request } = setup({ base: '/app/' })
    expect(request('/app/guides/pad.md').body).toBe('## pad guide')
    expect(request('/guides/pad.md').passed).toBe(true)
  })

  it('emits every guide as a static asset in a client build, none in an SSR build', () => {
    const emitted: Array<{ fileName: string; source: Buffer }> = []
    setup().plugin.generateBundle.call({ emitFile: f => emitted.push(f as never) })
    expect(emitted.map(f => f.fileName)).toEqual(['guides/pad.md', 'guides/trim.md'])
    expect(String(emitted[1].source)).toBe('## trim guide')

    const ssr: unknown[] = []
    setup({ ssr: true }).plugin.generateBundle.call({ emitFile: f => ssr.push(f) })
    expect(ssr).toEqual([])
  })
})
