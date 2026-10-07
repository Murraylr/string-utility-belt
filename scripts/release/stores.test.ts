// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { GitHub } from './github'
import { poll, request, type Fetch } from './http'
import { marketplaceVersions, npmServes, publishedVersions, storeName } from './stores'

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

describe('publishedVersions', () => {
  it('lists an npm package\'s versions from its abbreviated packument, encoding a scoped name', async () => {
    const fetch = fakeFetch(url => (url.endsWith('%2fcore') ? json({ versions: { '1.3.0': {}, '0.0.0-stage': {} } }) : status(404)))
    expect(await publishedVersions('npm', '@string-utility-belt/core', { fetch })).toEqual(['1.3.0', '0.0.0-stage'])
    expect(await publishedVersions('npm', 'never-published', { fetch })).toEqual([])
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://registry.npmjs.org/@string-utility-belt%2fcore')
    expect((init?.headers as Record<string, string>).accept).toBe('application/vnd.npm.install-v1+json')
  })

  it('lists the exact MCP Registry server\'s versions across result pages', async () => {
    const fetch = fakeFetch(url => (url.includes('cursor=next')
      ? json({ servers: [{ server: { name: 'com.x/mcp', version: '1.3.3' } }], metadata: {} })
      : json({
        servers: [{ server: { name: 'com.x/mcp', version: '1.3.0' } }, { server: { name: 'com.x/mcp-other', version: '9.0.0' } }],
        metadata: { nextCursor: 'next' },
      })))
    expect(await publishedVersions('mcp-registry', 'com.x/mcp', { fetch })).toEqual(['1.3.0', '1.3.3'])
    expect(fetch.mock.calls[0][0]).toBe('https://registry.modelcontextprotocol.io/v0/servers?search=com.x%2Fmcp&limit=100')
  })

  it('lists Open VSX versions without its aliases', async () => {
    const fetch = fakeFetch(() => json({ allVersions: { latest: 'u', 'pre-release': 'u', '1.0.0': 'u', '1.1.0': 'u' } }))
    expect(await publishedVersions('open-vsx', 'pub.ext', { fetch })).toEqual(['1.0.0', '1.1.0'])
    expect(fetch.mock.calls[0][0]).toBe('https://open-vsx.org/api/pub/ext')
  })

  it('lists a Marketplace extension\'s versions; a never-published extension has none', async () => {
    const fetch = fakeFetch((_url, init) => {
      const id = JSON.parse(String(init?.body)).filters[0].criteria[0].value
      return json({ results: [{ extensions: id === 'pub.ext' ? [{ versions: [{ version: '1.3.1' }, { version: '1.3.0' }] }] : [] }] })
    })
    expect(await publishedVersions('vscode-marketplace', 'pub.ext', { fetch })).toEqual(['1.3.1', '1.3.0'])
    expect(await marketplaceVersions('pub.other', { fetch })).toEqual([])
  })

  it('throws rather than guessing on any other answer', async () => {
    const fetch = fakeFetch(() => status(403))
    await expect(publishedVersions('npm', 'subelt', { fetch, sleep: noSleep })).rejects.toThrow(/could not read the published versions of npm subelt: HTTP 403/)
    await expect(publishedVersions('vscode-marketplace', 'pub.ext', { fetch, sleep: noSleep })).rejects.toThrow(/HTTP 403/)
    await expect(publishedVersions('open-vsx', 'not-an-id', { fetch })).rejects.toThrow(/not a publisher\.name extension id/)
  })
})

describe('npmServes', () => {
  it('asks npm for the exact version, which a fresh publish lacks until npm has processed it', async () => {
    const fetch = fakeFetch(url => (url.endsWith('/1.3.4') ? json({ version: '1.3.4' }) : status(404)))
    expect(await npmServes('@string-utility-belt/mcp', '1.3.4', { fetch })).toBe(true)
    expect(await npmServes('@string-utility-belt/mcp', '1.3.5', { fetch })).toBe(false)
    expect(fetch.mock.calls[0][0]).toBe('https://registry.npmjs.org/@string-utility-belt%2fmcp/1.3.4')
    await expect(npmServes('subelt', '1.0.0', { fetch: fakeFetch(() => status(403)) })).rejects.toThrow(/npm subelt@1\.0\.0: HTTP 403/)
  })
})

describe('poll', () => {
  /** A clock that `sleep` advances. */
  function clock() {
    let t = 0
    return { now: () => t, sleep: vi.fn(async (ms: number) => { t += ms }) }
  }

  it('checks until the check passes, telling it the time elapsed', async () => {
    const { now, sleep } = clock()
    const seen: number[] = []
    const check = async (elapsed: number) => { seen.push(elapsed); return seen.length === 3 }
    expect(await poll(check, { timeoutMs: 60_000, intervalMs: 10_000, now, sleep })).toBe(true)
    expect(seen).toEqual([0, 10_000, 20_000])
  })

  it('gives up once another interval would pass the timeout', async () => {
    const { now, sleep } = clock()
    const check = vi.fn(async () => false)
    expect(await poll(check, { timeoutMs: 25_000, intervalMs: 10_000, now, sleep })).toBe(false)
    expect(check).toHaveBeenCalledTimes(3)
    expect(sleep).toHaveBeenCalledTimes(2)
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
