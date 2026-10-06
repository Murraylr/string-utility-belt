// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { GitHub } from './github'
import { request, type Fetch } from './http'
import { isPublished, marketplaceVersions, storeName } from './stores'

const noSleep = async () => {}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const status = (code: number) => new Response(null, { status: code })

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.fn<Fetch>(async (url, init) => handler(url, init))
}

describe('storeName', () => {
  it('reads the name each store knows a package by', () => {
    expect(storeName('npm', { name: '@string-utility-belt/core' })).toBe('@string-utility-belt/core')
    expect(storeName('mcp-registry', { name: 'com.stringutilitybelt/mcp' })).toBe('com.stringutilitybelt/mcp')
    expect(storeName('vscode-marketplace', { publisher: 'pub', name: 'ext' })).toBe('pub.ext')
    expect(() => storeName('vscode-marketplace', { name: 'ext' })).toThrow(/no "publisher"/)
  })
})

describe('isPublished', () => {
  it('asks npm for the exact version, encoding a scoped name', async () => {
    const fetch = fakeFetch(url => (url.endsWith('/1.3.0') ? status(200) : status(404)))
    expect(await isPublished('npm', '@string-utility-belt/core', '1.3.0', { fetch })).toBe(true)
    expect(await isPublished('npm', '@string-utility-belt/core', '1.3.1', { fetch })).toBe(false)
    expect(fetch.mock.calls[0][0]).toBe('https://registry.npmjs.org/@string-utility-belt%2fcore/1.3.0')
  })

  it('asks the MCP Registry for the server version', async () => {
    const fetch = fakeFetch(() => status(404))
    expect(await isPublished('mcp-registry', 'com.stringutilitybelt/mcp', '1.3.4', { fetch })).toBe(false)
    expect(fetch.mock.calls[0][0]).toBe('https://registry.modelcontextprotocol.io/v0/servers/com.stringutilitybelt%2Fmcp/versions/1.3.4')
  })

  it('asks Open VSX by namespace and name', async () => {
    const fetch = fakeFetch(() => status(200))
    expect(await isPublished('open-vsx', 'pub.ext', '1.0.0', { fetch })).toBe(true)
    expect(fetch.mock.calls[0][0]).toBe('https://open-vsx.org/api/pub/ext/1.0.0')
  })

  it('finds a version among the Marketplace extension\'s versions; a never-published extension has none', async () => {
    const fetch = fakeFetch((_url, init) => {
      const id = JSON.parse(String(init?.body)).filters[0].criteria[0].value
      return json({ results: [{ extensions: id === 'pub.ext' ? [{ versions: [{ version: '1.3.1' }, { version: '1.3.0' }] }] : [] }] })
    })
    expect(await isPublished('vscode-marketplace', 'pub.ext', '1.3.0', { fetch })).toBe(true)
    expect(await isPublished('vscode-marketplace', 'pub.ext', '1.3.2', { fetch })).toBe(false)
    expect(await marketplaceVersions('pub.other', { fetch })).toEqual([])
  })

  it('throws rather than guessing on any other answer', async () => {
    const fetch = fakeFetch(() => status(403))
    await expect(isPublished('npm', 'subelt', '1.0.0', { fetch, sleep: noSleep })).rejects.toThrow(/could not tell whether npm subelt@1\.0\.0 is published: HTTP 403/)
    await expect(isPublished('vscode-marketplace', 'pub.ext', '1.0.0', { fetch, sleep: noSleep })).rejects.toThrow(/HTTP 403/)
  })
})

describe('request', () => {
  it('retries network errors, 429 and 5xx with backoff, then returns the answer', async () => {
    const answers: (Response | Error)[] = [new Error('ECONNRESET'), status(503), status(429), status(404)]
    const fetch = vi.fn<Fetch>(async () => {
      const next = answers.shift()!
      if (next instanceof Error) throw next
      return next
    })
    const sleep = vi.fn<(ms: number) => Promise<void>>(noSleep)
    expect((await request('https://x.test', {}, { fetch, sleep })).status).toBe(404)
    expect(sleep.mock.calls.map(c => c[0])).toEqual([1000, 2000, 4000])
  })

  it('gives up after the retries, with the last answer or error', async () => {
    expect((await request('https://x.test', {}, { fetch: fakeFetch(() => status(502)), sleep: noSleep, retries: 1 })).status).toBe(502)
    const failing = vi.fn<Fetch>(async () => { throw new Error('ENOTFOUND') })
    await expect(request('https://x.test', {}, { fetch: failing, sleep: noSleep, retries: 1 })).rejects.toThrow(/GET https:\/\/x\.test failed: ENOTFOUND/)
    expect(failing).toHaveBeenCalledTimes(2)
  })

  it('does not retry 4xx', async () => {
    const fetch = fakeFetch(() => status(400))
    expect((await request('https://x.test', {}, { fetch, sleep: noSleep })).status).toBe(400)
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})

describe('GitHub', () => {
  it('reads the labels of merged pull requests for a commit', async () => {
    const fetch = fakeFetch(() => json([
      { merged_at: '2026-10-06T00:00:00Z', labels: [{ name: 'release:minor' }, { name: 'bug' }] },
      { merged_at: null, labels: [{ name: 'release:major' }] },
    ]))
    const gh = new GitHub('token', 'owner/repo', 'https://api.github.test', fetch)
    expect(await gh.pullRequestLabels('abc')).toEqual(['release:minor', 'bug'])
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.github.test/repos/owner/repo/commits/abc/pulls')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer token')
  })

  it('asks whether CI succeeded on a pushed commit', async () => {
    const fetch = fakeFetch(url => json({ total_count: url.includes('head_sha=good') ? 1 : 0 }))
    const gh = new GitHub('token', 'owner/repo', 'https://api.github.test', fetch)
    expect(await gh.ciSucceeded('good')).toBe(true)
    expect(await gh.ciSucceeded('bad')).toBe(false)
    expect(fetch.mock.calls[0][0]).toBe('https://api.github.test/repos/owner/repo/actions/workflows/ci.yml/runs?head_sha=good&event=push&status=success&per_page=1')
  })

  it('is only built from a complete Actions environment', () => {
    expect(GitHub.fromEnv({ GITHUB_TOKEN: 't' })).toBeNull()
    expect(GitHub.fromEnv({ GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' })).toBeInstanceOf(GitHub)
  })
})
