import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_FETCH_BYTES, fetchAsInput, isTextContentType } from './fetchInput'

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' }, ...init })
}

describe('fetchAsInput', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('rejects non-http(s) URLs without calling fetch', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as any
    await expect(fetchAsInput('ftp://example.com/x')).rejects.toThrow(/http/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns text for a successful text/json response', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ a: 1 })) as any
    const { value, contentType } = await fetchAsInput('https://example.com/data.json')
    expect(value).toBe(JSON.stringify({ a: 1 }))
    expect(contentType).toBe('application/json')
  })

  it('returns bytes for a binary content-type', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4])
    const res = new Response(bytes, { headers: { 'content-type': 'application/octet-stream' } })
    global.fetch = vi.fn().mockResolvedValue(res) as any
    const { value } = await fetchAsInput('https://example.com/data.bin')
    expect(value).toBeInstanceOf(Uint8Array)
    expect(Array.from(value as Uint8Array)).toEqual([1, 2, 3, 4])
  })

  it('falls back to the worker proxy on a network/CORS failure', async () => {
    const calls: string[] = []
    global.fetch = vi.fn(async (url: any) => {
      calls.push(String(url))
      if (calls.length === 1) throw new TypeError('Failed to fetch')
      return new Response('hello', { headers: { 'content-type': 'text/plain', 'x-subelt-final-url': 'https://blocked.example.com/x' } })
    }) as any
    const { value } = await fetchAsInput('https://blocked.example.com/x')
    expect(value).toBe('hello')
    expect(calls[1]).toContain('/api/fetch?url=')
    expect(calls[1]).toContain(encodeURIComponent('https://blocked.example.com/x'))
  })

  it('does not fall back on a real HTTP error status (not a CORS failure)', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('nope', { status: 404 })) as any
    await expect(fetchAsInput('https://example.com/missing')).rejects.toThrow(/404/)
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('maps worker error statuses to a readable message', async () => {
    const fn = vi.fn()
    fn.mockImplementationOnce(async () => { throw new TypeError('network error') })
    fn.mockImplementationOnce(async () => jsonResponse({ error: 'blocked host' }, { status: 403 }))
    global.fetch = fn as any
    await expect(fetchAsInput('https://blocked.example.com')).rejects.toThrow(/blocked host/)
  })

  it('aborts cleanly when the signal is already aborted', async () => {
    const ac = new AbortController()
    ac.abort()
    global.fetch = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError')) as any
    await expect(fetchAsInput('https://example.com/x', { signal: ac.signal })).rejects.toThrow()
  })

  it('rejects malformed URLs and URLs carrying credentials without calling fetch', async () => {
    const fetchSpy = vi.fn()
    global.fetch = fetchSpy as any
    await expect(fetchAsInput('https://')).rejects.toThrow(/not a valid URL/i)
    await expect(fetchAsInput('https://user:secret@example.com/x')).rejects.toThrow(/credentials/i)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('keeps office documents (application/vnd.openxmlformats-…) as bytes rather than decoding them as text', async () => {
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0xff, 0x00])
    const ct = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    global.fetch = vi.fn().mockResolvedValue(new Response(zip, { headers: { 'content-type': ct } })) as any
    const { value } = await fetchAsInput('https://example.com/book.xlsx')
    expect(value).toBeInstanceOf(Uint8Array)
    expect(Array.from(value as Uint8Array)).toEqual(Array.from(zip))
  })

  it('decodes text using the charset the server declares', async () => {
    const latin1 = new Uint8Array([0x63, 0x61, 0x66, 0xe9]) // "café" in ISO-8859-1
    global.fetch = vi.fn().mockResolvedValue(
      new Response(latin1, { headers: { 'content-type': 'text/plain; charset=ISO-8859-1' } }),
    ) as any
    expect((await fetchAsInput('https://example.com/latin1.txt')).value).toBe('café')
  })

  it('sniffs a missing content-type: valid UTF-8 becomes text, anything else bytes', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce(new Response(new TextEncoder().encode('plain ✓')))
      .mockResolvedValueOnce(new Response(new Uint8Array([0xff, 0xfe]))) as any
    expect((await fetchAsInput('https://example.com/a')).value).toBe('plain ✓')
    expect((await fetchAsInput('https://example.com/b')).value).toBeInstanceOf(Uint8Array)
  })

  it('refuses a direct response that declares more than 5 MB', async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response('x', {
      headers: { 'content-type': 'text/plain', 'content-length': String(MAX_FETCH_BYTES + 1) },
    })) as any
    await expect(fetchAsInput('https://example.com/huge')).rejects.toThrow(/5 MB/)
  })

  it('stops reading a direct response body once it passes 5 MB', async () => {
    let pulled = 0
    const chunk = new Uint8Array(1024 * 1024)
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { pulled++; controller.enqueue(chunk) }, // endless, no content-length
    })
    global.fetch = vi.fn().mockResolvedValue(new Response(body, { headers: { 'content-type': 'application/octet-stream' } })) as any
    await expect(fetchAsInput('https://example.com/stream')).rejects.toThrow(/5 MB/)
    expect(pulled).toBeLessThan(10)
  })

  it('treats a proxy answer without the worker marker header as "proxy unavailable" (SPA fallback page)', async () => {
    const fn = vi.fn()
    fn.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch') })
    fn.mockImplementationOnce(async () => new Response('<!doctype html><div id="root"></div>', { headers: { 'content-type': 'text/html' } }))
    global.fetch = fn as any
    await expect(fetchAsInput('https://no-cors.example.com/data')).rejects.toThrow(/proxy is not available/i)
  })

  it('maps proxy statuses without a JSON body to readable messages', async () => {
    const cases: Array<[number, RegExp]> = [[400, /not a valid URL/], [413, /5 MB/], [429, /too many/], [503, /disabled/], [504, /timed out/]]
    for (const [status, message] of cases) {
      const fn = vi.fn()
      fn.mockImplementationOnce(async () => { throw new TypeError('Failed to fetch') })
      fn.mockImplementationOnce(async () => new Response('oops', { status }))
      global.fetch = fn as any
      await expect(fetchAsInput('https://example.com/x')).rejects.toThrow(message)
    }
  })
})

describe('isTextContentType', () => {
  it('accepts text/*, json, xml, javascript and +json/+xml suffixes', () => {
    for (const ct of ['text/plain', 'text/csv; charset=utf-8', 'application/json', 'application/ld+json',
      'application/xml', 'image/svg+xml', 'application/javascript', 'text/javascript', 'APPLICATION/JSON']) {
      expect(isTextContentType(ct)).toBe(true)
    }
  })
  it('rejects binary types, even ones whose name merely contains "xml" or "json"', () => {
    for (const ct of [null, '', 'application/octet-stream', 'image/png', 'application/zip',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/x-jsonish-archive']) {
      expect(isTextContentType(ct)).toBe(false)
    }
  })
})
