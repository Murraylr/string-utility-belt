// @vitest-environment node
import { gunzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { formatForDisplay } from '../src/core/coerce'
import { createRegistry, metaOf } from '../src/core/registry'
import { encodeShare } from '../src/core/serialize'
import { EXAMPLES } from '../src/utilities/_generated/examples'
import { MANIFEST } from '../src/utilities/_generated/manifest'
import type { Utility, UtilityExample } from '../src/types/utility'
import { createApi } from './api'
import worker from './index'
import { bombPayload } from './test-utils'

const ctx = { waitUntil() {}, passThroughOnException() {} } as ExecutionContext
const ORIGIN = 'https://stringutilitybelt.com'

// every request comes from its own client IP, so the per-IP rate limit never interferes
let clients = 0
const nextClientIp = () => `198.51.${(++clients >> 8) & 0xff}.${clients & 0xff}`

function post(body: unknown, init: RequestInit = {}): Request {
  return new Request(`${ORIGIN}/api/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': nextClientIp() },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...init,
  })
}

async function run(body: unknown, init?: RequestInit) {
  const res = await worker.fetch(post(body, init), {}, ctx)
  return { res, data: await res.json() as any }
}

const b64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'))

describe('POST /api/run: happy paths', () => {
  it('runs text steps and reports the result shape', async () => {
    const { res, data } = await run({ input: 'hello', steps: [{ id: 's1', utilityId: 'base64_encode' }] })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    expect(data).toMatchObject({
      output: 'aGVsbG8=', outputEncoding: 'text', outputType: 'string',
      errors: {}, skipped: {}, halted: false,
    })
    expect(Object.keys(data.timings)).toEqual(['s1'])
  })

  it('accepts bare utility ids as steps, with params on object steps', async () => {
    const { data } = await run({
      input: 'Hello World',
      steps: ['reverse', { utilityId: 'case', params: { mode: 'lower' } }],
    })
    expect(data.output).toBe('dlrow olleh')
  })

  it('decodes base64 input to bytes (non-UTF-8 survives)', async () => {
    const { data } = await run({ input: b64(new Uint8Array([0xff, 0x00, 0x80])), inputEncoding: 'base64', steps: ['hex_encode'] })
    expect(data.output).toBe('ff0080')
  })

  it('returns byte output as base64', async () => {
    const { data } = await run({ input: 'hello hello hello', steps: ['gzip_compress'] })
    expect(data).toMatchObject({ outputEncoding: 'base64', outputType: 'bytes' })
    expect(new TextDecoder().decode(gunzipSync(fromB64(data.output)))).toBe('hello hello hello')
  })

  it('returns JSON output inline', async () => {
    const { data } = await run({ input: 'https://example.com:8080/a?x=1#f', steps: ['url_parse'] })
    expect(data).toMatchObject({ outputEncoding: 'json', outputType: 'json' })
    expect(data.output).toMatchObject({ hostname: 'example.com', port: '8080', searchParams: { x: '1' } })
  })

  it('runs a pipeline document, using its input when none is given', async () => {
    const { data } = await run({
      pipeline: { v: 2, name: 'shout', input: 'quiet', steps: [{ id: 'a', utilityId: 'case', params: { mode: 'upper' } }] },
    })
    expect(data.output).toBe('QUIET')
    const explicit = await run({ input: 'loud', pipeline: { v: 2, steps: [{ id: 'a', utilityId: 'case' }] } })
    expect(explicit.data.output).toBe('LOUD')
  })

  it('runs a share payload and a full share URL', async () => {
    const payload = encodeShare({ v: 2, steps: [{ id: 'x', utilityId: 'reverse' }, { id: 'y', utilityId: 'base64_encode' }] })
    const a = await run({ input: 'abc', share: payload })
    expect(a.data.output).toBe(btoa('cba'))
    const b = await run({ input: 'abc', share: `${ORIGIN}/#/p/${payload}` })
    expect(b.data.output).toBe(btoa('cba'))
    const c = await run({ input: 'abc', share: `${ORIGIN}/#/embed/${payload}` })
    expect(c.data.output).toBe(btoa('cba'))
  })

  it('runs branches and macros', async () => {
    const { data } = await run({
      input: 'abc',
      steps: [{
        id: 'b', type: 'branch', merge: { mode: 'concat', separator: '|' },
        branches: [['reverse'], [{ id: 'm', type: 'macro', name: 'up', steps: [{ utilityId: 'case', params: { mode: 'upper' } }] }]],
      }],
    })
    expect(data.output).toBe('cba|ABC')
  })

  it('records step errors, honours onError and reports halts', async () => {
    const pass = await run({ input: '%E0%A4%A', steps: [{ id: 'bad', utilityId: 'url_decode' }, { id: 'next', utilityId: 'reverse' }] })
    expect(pass.res.status).toBe(200)
    expect(pass.data.errors.bad).toMatch(/URI/i)
    expect(pass.data.output).toBe('A%4A%0E%')

    const stop = await run({
      input: '%E0%A4%A',
      steps: [{ id: 'bad', utilityId: 'url_decode', onError: 'stop' }, { id: 'next', utilityId: 'reverse' }],
    })
    expect(stop.data).toMatchObject({ halted: true, skipped: { next: 'halted' } })
  })

  it('reports disabled and condition-skipped steps', async () => {
    const { data } = await run({
      input: 'abc',
      steps: [
        { id: 'off', utilityId: 'reverse', enabled: false },
        { id: 'cond', utilityId: 'reverse', condition: { kind: 'regex', pattern: '^z' } },
        { id: 'on', utilityId: 'case' },
      ],
    })
    expect(data).toMatchObject({ output: 'ABC', skipped: { off: 'disabled', cond: 'condition' } })
  })
})

describe('POST /api/run: validation', () => {
  it.each([
    ['{"input": "x", "steps": [', /not valid JSON/],
    ['[1, 2]', /must be a JSON object/],
    ['"text"', /must be a JSON object/],
    ['', /not valid JSON/],
  ])('rejects the body %j with 400', async (body, message) => {
    const { res, data } = await run(body)
    expect(res.status).toBe(400)
    expect(data.error).toMatch(message)
  })

  it('rejects a body that is not UTF-8', async () => {
    const { res } = await run(undefined, { body: new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]) })
    expect(res.status).toBe(400)
  })

  it.each<[Record<string, unknown>, string]>([
    [{ input: 'x' }, 'none'],
    [{ input: 'x', steps: [], pipeline: { v: 2, steps: [] } }, 'steps + pipeline'],
    [{ input: 'x', steps: [], share: 'abc' }, 'steps + share'],
    [{ input: 'x', pipeline: { steps: [] }, share: 'abc' }, 'pipeline + share'],
  ])('requires exactly one of steps/pipeline/share (%j: %s)', async body => {
    const { res, data } = await run(body)
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/exactly one of/)
  })

  it.each([
    [{ input: 42, steps: [] }, /"input" must be a string/],
    [{ input: 'x', inputEncoding: 'hex', steps: [] }, /"inputEncoding"/],
    [{ input: '***', inputEncoding: 'base64', steps: [] }, /not valid base64/],
    [{ input: 'x', steps: 'trim' }, /"steps" must be an array/],
    [{ input: 'x', steps: [{ params: {} }] }, /1 step could not be read/],
    [{ input: 'x', steps: [42, 'trim', null] }, /2 steps could not be read/],
    [{ input: 'x', pipeline: 'trim' }, /"pipeline" must be/],
    [{ input: 'x', pipeline: { v: 3, steps: [] } }, /schema v3/],
    [{ input: 'x', pipeline: { v: 2 } }, /"pipeline.steps" must be an array/],
    [{ input: 'x', share: 'definitely-not-a-share-payload' }, /.+/],
    [{ input: 'x', share: 42 }, /"share" must be/],
  ])('rejects %j with 400', async (body, message) => {
    const { res, data } = await run(body)
    expect(res.status).toBe(400)
    expect(data.error).toMatch(message)
  })

  it('applies inputEncoding only to an explicit input, never to a pipeline’s own (text) input', async () => {
    const share = encodeShare({ v: 2, input: 'hello', steps: [{ id: 'r', utilityId: 'reverse' }] })
    const embedded = await run({ share, inputEncoding: 'base64' })
    expect(embedded.res.status).toBe(200)
    expect(embedded.data.output).toBe('olleh')
    const doc = await run({ pipeline: { v: 2, input: 'abc', steps: ['reverse'] }, inputEncoding: 'base64' })
    expect(doc.data.output).toBe('cba')
    // an explicit input is still decoded, and a bad encoding name is still refused
    const explicit = await run({ share, input: btoa('xyz'), inputEncoding: 'base64' })
    expect(explicit.data.output).toBe('zyx')
    const bad = await run({ share, inputEncoding: 'hex' })
    expect(bad.res.status).toBe(400)
    expect(bad.data.error).toMatch(/"inputEncoding"/)
  })

  it('rejects a share made by a newer schema', async () => {
    const LZ = (await import('lz-string')).default
    const share = LZ.compressToEncodedURIComponent(JSON.stringify({ v: 9, steps: [] }))
    const { res, data } = await run({ input: 'x', share })
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/newer version/)
  })
})

describe('POST /api/run: limits', () => {
  it('refuses a declared Content-Length over 1 MB without reading the body', async () => {
    const body = new ReadableStream({ pull(c) { c.close() } })
    const req = new Request(`${ORIGIN}/api/run`, {
      method: 'POST', body, headers: { 'content-length': String(1024 * 1024 + 1) }, duplex: 'half',
    } as RequestInit)
    const res = await worker.fetch(req, {}, ctx)
    expect(res.status).toBe(413)
    expect((await res.json() as any).error).toMatch(/larger than 1024 KB/)
    expect(req.bodyUsed).toBe(false)
  })

  it('counts the bytes actually read, whatever Content-Length claims', async () => {
    const chunk = new Uint8Array(256 * 1024).fill(0x20)
    let sent = 0
    const body = new ReadableStream<Uint8Array>({
      pull(c) { if (sent++ < 6) c.enqueue(chunk); else c.close() },
    })
    const req = new Request(`${ORIGIN}/api/run`, {
      method: 'POST', body, headers: { 'content-length': '20' }, duplex: 'half',
    } as RequestInit)
    const res = await worker.fetch(req, {}, ctx)
    expect(res.status).toBe(413)
    expect(sent).toBeLessThan(7) // stopped reading once over the limit
  })

  it('refuses an oversized body sent without Content-Length', async () => {
    const big = JSON.stringify({ input: 'x'.repeat(1024 * 1024), steps: [] })
    const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(big)); c.close() } })
    const req = new Request(`${ORIGIN}/api/run`, { method: 'POST', body, duplex: 'half' } as RequestInit)
    const res = await worker.fetch(req, {}, ctx)
    expect(res.status).toBe(413)
  })

  it('accepts a body just under 1 MB', async () => {
    const input = 'x'.repeat(1024 * 1024 - 100)
    const { res, data } = await run({ input, steps: ['reverse'] })
    expect(res.status).toBe(200)
    expect(data.output.length).toBe(input.length)
  })

  it('survives pathologically deep JSON without a 500', async () => {
    const depth = 200_000
    const deepParams = `{"input":"x","steps":[{"utilityId":"trim","params":{"p":${'['.repeat(depth)}${']'.repeat(depth)}}}]}`
    const a = await run(deepParams)
    expect(a.res.status).toBeLessThan(500)
    const deepSteps = `{"input":"x","steps":${'['.repeat(depth)}${']'.repeat(depth)}}`
    const b = await run(deepSteps)
    expect(b.res.status).toBe(400)
    const deepBranches = { input: 'x', steps: [] as unknown[] }
    let lane: unknown[] = deepBranches.steps
    for (let i = 0; i < 50; i++) {
      const inner: unknown[] = []
      lane.push({ type: 'branch', merge: { mode: 'concat' }, branches: [inner] })
      lane = inner
    }
    const c = await run(deepBranches)
    expect(c.res.status).toBe(400)
    expect(c.data.error).toMatch(/nested more than 8 levels/)
  })

  it('allows 100 steps and refuses 101, nested steps included', async () => {
    const ok = await run({ input: 'a', steps: Array(100).fill('reverse') })
    expect(ok.res.status).toBe(200)
    const flat = await run({ input: 'a', steps: Array(101).fill('reverse') })
    expect(flat.res.status).toBe(400)
    expect(flat.data.error).toMatch(/too many steps: 101/)
    // 1 branch + 2 lanes × 50 = 101
    const nested = await run({
      input: 'a',
      steps: [{ type: 'branch', merge: { mode: 'pick', index: 0 }, branches: [Array(50).fill('reverse'), Array(50).fill('reverse')] }],
    })
    expect(nested.res.status).toBe(400)
    expect(nested.data.error).toMatch(/too many steps: 101/)
  })

  it('applies the step limit to share links too', async () => {
    const steps = Array.from({ length: 101 }, (_, i) => ({ id: `s${i}`, utilityId: 'reverse' }))
    const { res, data } = await run({ input: 'a', share: encodeShare({ v: 2, steps }) })
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/too many steps/)
  })

  describe('timeout', () => {
    const slow: Utility = {
      id: 'slow', name: 'slow', category: 'Test', params: {},
      // honours the signal the runner passes down
      apply: (input, _p, c) => new Promise((resolve, reject) => {
        const t = setTimeout(() => resolve(input), 5_000)
        c?.signal?.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')) })
      }),
    }
    const hang: Utility = {
      id: 'hang', name: 'hang', category: 'Test', params: {},
      // ignores the signal entirely
      apply: () => new Promise(() => {}),
    }
    const upper: Utility = { id: 'upper', name: 'upper', category: 'Test', params: {}, apply: v => String(v).toUpperCase() }
    const all = [slow, hang, upper]
    const registry = createRegistry(all.map(u => metaOf(u)), id => all.find(u => u.id === id)!)
    const api = createApi({ registry, runTimeoutMs: 40 })

    it.each(['slow', 'hang'])('answers 504 when a %s step outlives the budget', async id => {
      const t0 = Date.now()
      const res = await api.fetch(post({ input: 'x', steps: [id, 'upper'] }))
      expect(res.status).toBe(504)
      expect((await res.json() as any).error).toMatch(/did not finish within 0.04 s/)
      expect(Date.now() - t0).toBeLessThan(2_000)
    })

    it('finishes normally inside the budget', async () => {
      const res = await api.fetch(post({ input: 'x', steps: ['upper'] }))
      expect(res.status).toBe(200)
      expect((await res.json() as any).output).toBe('X')
    })

    it('uses the injected clock for timings', async () => {
      let t = 0
      const clocked = createApi({ registry, clock: () => (t += 5) })
      const res = await clocked.fetch(post({ input: 'x', steps: [{ id: 'u', utilityId: 'upper' }] }))
      expect((await res.json() as any).timings).toEqual({ u: 5 })
    })
  })
})

describe('POST /api/run: value size ceiling', () => {
  it('fails a step whose output passes the ceiling, and carries on with its input', async () => {
    const api = createApi({ maxValueSize: 1_000 })
    const res = await api.fetch(post({ input: 'a'.repeat(300), steps: [
      { id: 'h1', utilityId: 'hex_encode' }, // 600
      { id: 'h2', utilityId: 'hex_encode' }, // 1200: refused
      { id: 'r', utilityId: 'reverse' },
    ] }))
    const data = await res.json() as any
    expect(res.status).toBe(200)
    expect(data.errors).toEqual({ h2: expect.stringMatching(/larger than the server's limit of 1000/) })
    expect(data.output).toBe('16'.repeat(300))
  })

  it('refuses oversized input to a utility with a superlinear worst case, before running it', async () => {
    const api = createApi()
    const res = await api.fetch(post({ input: '<'.repeat(40_000), steps: [{ id: 'q', utilityId: 'sql_format' }] }))
    const data = await res.json() as any
    expect(res.status).toBe(200)
    expect(data.errors.q).toMatch(/sql_format accepts at most 4000 characters/)
    const ok = await createApi().fetch(post({ input: 'select 1', steps: [{ id: 'q', utilityId: 'sql_format' }] }))
    expect((await ok.json() as any).errors).toEqual({})
  })

  it('applies to byte outputs too', async () => {
    const api = createApi({ maxValueSize: 100 })
    const res = await api.fetch(post({ input: 'x', steps: [{ id: 'b', utilityId: 'random_bytes', params: { count: 101 } }] }))
    expect((await res.json() as any).errors.b).toMatch(/larger than/)
  })

  it('refuses a branch merge whose lanes add up past the ceiling, before joining them', async () => {
    const api = createApi({ maxValueSize: 1_000 })
    const lane = [{ utilityId: 'hex_encode' }] // 600 each
    const res = await api.fetch(post({ input: 'a'.repeat(300), steps: [{ id: 'br', type: 'branch', merge: { mode: 'concat', separator: '' }, branches: [lane, lane] }] }))
    const data = await res.json() as any
    expect(res.status).toBe(200)
    expect(data.errors.br).toMatch(/output is too large/)
    expect(data.output).toBe('a'.repeat(300)) // the branch step's error policy passes its input through
  })

  it('refuses a repeat whose output would pass the ceiling without building it', async () => {
    const api = createApi({ maxValueSize: 1_000 })
    const steps = (count: number) => [{ id: 'r', utilityId: 'repeat', params: { count, separator: '-' } }]
    const over = await (await api.fetch(post({ input: 'a'.repeat(100), steps: steps(10) }))).json() as any
    expect(over.errors.r).toMatch(/larger than the server's limit of 1000/) // 10 × 100 + 9 separators
    const fits = await (await api.fetch(post({ input: 'a'.repeat(100), steps: steps(9) }))).json() as any
    expect(fits.errors).toEqual({})
    expect(fits.output).toHaveLength(908)
  })

  it('answers 413 when the final output passes the ceiling, with CORS', async () => {
    const api = createApi({ maxValueSize: 60 })
    const res = await api.fetch(post({ input: 'https://example.com:8080/a?x=1#f', steps: ['url_parse'] }))
    expect(res.status).toBe(413)
    expect((await res.json() as any).error).toMatch(/output is larger than the server's limit of 60/)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('measures a JSON output by its serialised size', async () => {
    const api = createApi({ maxValueSize: 60 })
    const input = 'https://example.com:8080/a?x=1#f' // 32 characters in, a much larger object out
    const big = await api.fetch(post({ input, steps: ['url_parse'] }))
    expect(big.status).toBe(413)
    const roomy = await createApi({ maxValueSize: 10_000 }).fetch(post({ input, steps: ['url_parse'] }))
    expect(roomy.status).toBe(200)
    expect((await roomy.json() as any).outputEncoding).toBe('json')
  })

  it('stops a 1 MB request from growing without bound through chained steps (default ceiling)', async () => {
    const t0 = Date.now()
    const { res, data } = await run({ input: 'a'.repeat(600 * 1024), steps: Array.from({ length: 8 }, (_, i) => ({ id: `h${i}`, utilityId: 'hex_encode' })) })
    expect(res.status).toBe(200)
    // 600 K → 1.2 M → 2.4 M → 4.8 M characters; every further doubling (9.6 M) passes the 8 Mi ceiling
    expect(Object.keys(data.errors)).toEqual(['h3', 'h4', 'h5', 'h6', 'h7'])
    expect(data.output).toHaveLength(600 * 1024 * 8)
    expect(Date.now() - t0).toBeLessThan(15_000)
  }, 30_000)
})

describe('POST /api/run: share size ceiling', () => {
  it('refuses a small share payload that decompresses to hundreds of millions of characters', async () => {
    const bomb = bombPayload(20_000) // ~50 KB → 200M characters with a stock decoder
    const t0 = Date.now()
    const { res, data } = await run({ input: 'x', share: bomb })
    expect(res.status).toBe(413)
    expect(data.error).toMatch(/too large to open safely.*2,097,152 characters/)
    expect(Date.now() - t0).toBeLessThan(2_000)
  })

  it('applies an injected ceiling to the decompressed document', async () => {
    const api = createApi({ maxShareChars: 1_000 })
    const big = encodeShare({ v: 2, input: 'x'.repeat(2_000), steps: [{ id: 'r', utilityId: 'reverse' }] })
    expect((await api.fetch(post({ share: big }))).status).toBe(413)
    const small = encodeShare({ v: 2, input: 'abc', steps: [{ id: 'r', utilityId: 'reverse' }] })
    const ok = await api.fetch(post({ share: small }))
    expect(ok.status).toBe(200)
    expect((await ok.json() as any).output).toBe('cba')
  })
})

describe('POST /api/run: params', () => {
  it.each<[Record<string, unknown>, string, RegExp]>([
    [{ utilityId: 'random_bytes', params: { count: 2 ** 21 } }, 'count', /at most 1048576/],
    [{ utilityId: 'aes_encrypt', params: { password: 'p', iterations: 1e9 } }, 'iterations', /at most 10000000/],
    [{ utilityId: 'fake_data', params: { count: '50000' } }, 'count', /at most 10000/],
    [{ utilityId: 'password_generator', params: { length: 0 } }, 'length', /at least 1/],
    [{ utilityId: 'hex_dump', params: { width: -1 } }, 'width', /at least 1/],
  ])('refuses %j with 400 and names the param', async (step, param, message) => {
    const { res, data } = await run({ input: 'x', steps: [{ id: 'bad', ...step }] })
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/^invalid params: /)
    expect(data.invalidParams).toEqual([{ stepId: 'bad', utilityId: step.utilityId, param, error: expect.stringMatching(message) }])
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('checks nested steps but skips steps that cannot run', async () => {
    const bad = { utilityId: 'random_bytes', params: { count: 2 ** 21 } }
    const nested = await run({ input: 'x', steps: [{ type: 'macro', name: 'm', steps: [{ id: 'deep', ...bad }] }] })
    expect(nested.res.status).toBe(400)
    expect(nested.data.invalidParams.map((p: any) => p.stepId)).toEqual(['deep'])

    const skipped = await run({
      input: 'abc',
      steps: [
        { id: 'off', ...bad, enabled: false },
        { type: 'macro', name: 'm', enabled: false, steps: [{ id: 'inside', ...bad }] },
        'reverse',
      ],
    })
    expect(skipped.res.status).toBe(200)
    expect(skipped.data.output).toBe('cba')
  })

  it('accepts in-range values and leaves every other rule to the utility, as the app does', async () => {
    const inRange = await run({ input: 'x', steps: [{ utilityId: 'random_bytes', params: { count: 4, output: 'hex' } }] })
    expect(inRange.res.status).toBe(200)
    expect(inRange.data.output).toMatch(/^[0-9a-f]{8}$/)
    // legacy text rules for a keyvalue param still work
    const legacy = await run({ input: 'the colour grey', steps: [{ utilityId: 'multi_replace', params: { rules: 'colour => color' } }] })
    expect(legacy.data.output).toBe('the color grey')
    // an unknown option is the utility's call: a step error, not a refused request
    const option = await run({ input: 'x', steps: [{ id: 'c', utilityId: 'case', params: { mode: 'shout' } }] })
    expect(option.res.status).toBe(200)
    // params the utility does not declare are ignored
    const unknown = await run({ input: 'abc', steps: [{ utilityId: 'reverse', params: { count: 1e12 } }] })
    expect(unknown.data.output).toBe('cba')
  })

  // WebCrypto PBKDF2 runs synchronously in workerd: 1e8 iterations blocked a local isolate
  // for ~2 minutes and the 10 s timeout never fired, so the work is refused up front.
  describe('PBKDF2 work budget', () => {
    it.each<[string, Record<string, unknown>]>([
      // within pbkdf2's own declared maximum (1e7) but over the edge's whole-request budget
      ['pbkdf2 over the edge budget', { utilityId: 'pbkdf2', params: { iterations: 5_000_000 } }],
      ['aes_encrypt inside its declared maximum', { utilityId: 'aes_encrypt', params: { password: 'p', iterations: 5_000_000 } }],
      ['aes_decrypt as a numeric string', { utilityId: 'aes_decrypt', params: { password: 'p', iterations: '2e6' } }],
      ['pbkdf2 with a long key (52 SHA-1 blocks × 50 000)', { utilityId: 'pbkdf2', params: { algorithm: 'SHA-1', iterations: 50_000, keyLength: 1024 } }],
    ])('refuses %s with 400 before running anything', async (_label, step) => {
      const t0 = Date.now()
      const { res, data } = await run({ input: 'pw', steps: [{ id: 'kdf', ...step }] })
      expect(res.status).toBe(400)
      expect(data.invalidParams).toEqual([{ stepId: 'kdf', utilityId: step.utilityId, param: 'iterations', error: expect.stringMatching(/PBKDF2 .*1000000/) }])
      expect(Date.now() - t0).toBeLessThan(1_000)
    })

    it('counts the whole pipeline (nested steps too) against one budget', async () => {
      const api = createApi({ pbkdf2Budget: 1_000 })
      const kdf = (id: string, iterations: number) => ({ id, utilityId: 'pbkdf2', params: { iterations, keyLength: 32 } })
      const ok = await api.fetch(post({ input: 'pw', steps: [kdf('a', 600), { type: 'macro', name: 'm', steps: [kdf('b', 400)] }] }))
      expect(ok.status).toBe(200)
      const over = await api.fetch(post({ input: 'pw', steps: [kdf('a', 600), { type: 'macro', name: 'm', steps: [kdf('b', 401)] }] }))
      expect(over.status).toBe(400)
      expect((await over.json() as any).invalidParams.map((p: any) => p.stepId)).toEqual(['b'])
    })

    it('uses declared defaults for omitted params, and ignores disabled steps', async () => {
      const api = createApi({ pbkdf2Budget: 150_000 })
      // aes_encrypt and pbkdf2 both default to 100 000 iterations
      const twoDefaults = await api.fetch(post({ input: 'pw', steps: [{ id: 'e', utilityId: 'aes_encrypt', params: { password: 'p' } }, { id: 'k', utilityId: 'pbkdf2' }] }))
      expect(twoDefaults.status).toBe(400)
      const oneDisabled = await api.fetch(post({ input: 'pw', steps: [{ id: 'e', utilityId: 'aes_encrypt', params: { password: 'p' }, enabled: false }, { id: 'k', utilityId: 'pbkdf2', params: { iterations: 1000 } }] }))
      expect(oneDisabled.status).toBe(200)
    })
  })

  it('refuses a branch with more lanes than a pipeline can hold', async () => {
    const lanes = Array.from({ length: 17 }, () => ['reverse'])
    const { res, data } = await run({ input: 'x', steps: [{ type: 'branch', merge: { mode: 'concat' }, branches: lanes }] })
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/at most 16 lanes/)
    const ok = await run({ input: 'x', steps: [{ type: 'branch', merge: { mode: 'concat', separator: '' }, branches: lanes.slice(0, 16) }] })
    expect(ok.data.output).toBe('x'.repeat(16))
  })
})

/** The API's input for an example: text as-is, bytes as base64 (the API has no hex or JSON input). */
function exampleBody(ex: UtilityExample) {
  if (ex.inputEncoding === 'hex') {
    return { input: b64(Uint8Array.from(ex.input.replace(/\s+/g, '').match(/../g) ?? [], h => parseInt(h, 16))), inputEncoding: 'base64' }
  }
  if (ex.inputEncoding === 'base64') return { input: ex.input, inputEncoding: 'base64' }
  return { input: ex.input }
}

describe('POST /api/run: every documented example of every edge utility', () => {
  const edge = MANIFEST.filter(m => m.env.length === 0)

  it('covers most of the catalogue', () => {
    expect(edge.length).toBeGreaterThan(200)
  })

  it.each(edge.map(m => [m.id] as const))('%s', async id => {
    for (const [i, ex] of (EXAMPLES[id] ?? []).entries()) {
      const { res, data } = await run({ ...exampleBody(ex), steps: [{ id: 's', utilityId: id, params: ex.params ?? {} }] })
      expect(res.status, `${id} #${i + 1}: ${data.error}`).toBe(200)
      expect(data.errors, `${id} #${i + 1}`).toEqual({})
      const shown = formatForDisplay(data.outputEncoding === 'base64' ? fromB64(data.output) : data.output)
      if (ex.output !== undefined) expect(shown, `${id} #${i + 1}`).toBe(ex.output)
      if (ex.outputMatches !== undefined) expect(shown, `${id} #${i + 1}`).toMatch(new RegExp(ex.outputMatches))
    }
  })
})

describe('POST /api/run: edge support', () => {
  it.each([
    ['sha3', 'needs wasm'],
    ['xml_to_json', 'needs dom'],
    ['custom_js', 'needs eval, main'],
    ['no_such_utility', 'unknown utility'],
  ])('refuses %s with 422 (%s)', async (utilityId, reason) => {
    const { res, data } = await run({ input: 'x', steps: ['trim', { id: 'bad', utilityId }] })
    expect(res.status).toBe(422)
    expect(data.error).toMatch(/cannot run on the server/)
    expect(data.unsupported).toEqual([{ stepId: 'bad', utilityId, reason }])
  })

  it('finds unsupported steps nested in branches and macros, and disabled ones', async () => {
    const { res, data } = await run({
      input: 'x',
      steps: [
        { id: 'b', type: 'branch', merge: { mode: 'concat' }, branches: [[{ id: 'x1', utilityId: 'xml_to_json' }], ['trim']] },
        { id: 'm', type: 'macro', name: 'm', steps: [{ id: 's3', utilityId: 'sha3', enabled: false }] },
      ],
    })
    expect(res.status).toBe(422)
    expect(data.unsupported.map((u: any) => u.stepId)).toEqual(['x1', 's3'])
  })
})

describe('/api/run: HTTP semantics', () => {
  it('answers the CORS preflight', async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/api/run`, {
      method: 'OPTIONS',
      headers: { origin: 'https://elsewhere.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' },
    }), {}, ctx)
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('*')
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS')
    expect(res.headers.get('access-control-allow-headers')).toBe('content-type')
    expect(res.headers.get('access-control-max-age')).toBe('86400')
    expect(res.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('sends CORS headers on success and on errors, never credentials', async () => {
    for (const body of [{ input: 'x', steps: [] }, 'nope', { input: 'x', steps: ['sha3'] }]) {
      const { res } = await run(body)
      expect(res.headers.get('access-control-allow-origin')).toBe('*')
      expect(res.headers.get('access-control-allow-credentials')).toBeNull()
    }
  })

  it('refuses other methods with 405 JSON', async () => {
    const res = await worker.fetch(new Request(`${ORIGIN}/api/run`), {}, ctx)
    expect(res.status).toBe(405)
    expect(res.headers.get('allow')).toBe('POST, OPTIONS')
    expect(await res.json()).toHaveProperty('error')
  })

  it('rate-limits each client IP, with retry-after and CORS on the 429', async () => {
    let now = 1_000_000
    const api = createApi({ now: () => now, runRateLimit: { limit: 2, windowMs: 60_000 } })
    const from = (ip: string) => api.fetch(post({ input: 'abc', steps: ['reverse'] }, {
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    }))
    expect((await from('192.0.2.1')).status).toBe(200)
    now += 30_000
    expect((await from('192.0.2.1')).status).toBe(200)
    const limited = await from('192.0.2.1')
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('30')
    expect(limited.headers.get('access-control-allow-origin')).toBe('*')
    expect((await limited.json() as any).error).toMatch(/too many runs/)
    expect((await from('192.0.2.2')).status).toBe(200)
    now += 30_001
    expect((await from('192.0.2.1')).status).toBe(200)
  })

  it('accepts a form-encoded content type (curl -d) as long as the body is JSON', async () => {
    const { res, data } = await run({ input: 'abc', steps: ['reverse'] }, { headers: { 'content-type': 'application/x-www-form-urlencoded' } })
    expect(res.status).toBe(200)
    expect(data.output).toBe('cba')
  })
})
