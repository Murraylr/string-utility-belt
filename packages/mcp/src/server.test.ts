// @vitest-environment node
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { encodeShare } from '../../../src/core'
import { EXAMPLES } from '../../../src/utilities/_generated/examples'
import pkg from '../package.json'
import type { Executor, RunOptions } from './executor'
import { MAX_OUTPUT_CHARS } from './limits'
import { createServer } from './server'
import type { ServerOptions } from './server'

async function connect(opts?: ServerOptions) {
  const server = createServer(opts)
  const client = new Client({ name: 'test-client', version: '0.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
  return { client, server }
}

type ToolResult = Awaited<ReturnType<Client['callTool']>>
const text = (res: ToolResult): string => {
  const first = (res.content as Array<{ type: string; text?: string }>)[0]
  return first?.text ?? ''
}
const json = (res: ToolResult) => JSON.parse(text(res))

const resourceText = (res: Awaited<ReturnType<Client['readResource']>>): string => {
  const first = res.contents[0]
  return 'text' in first ? first.text : ''
}

const b64 = (s: string) => Buffer.from(s).toString('base64')

describe('subelt MCP server', () => {
  let client: Client
  let server: Awaited<ReturnType<typeof connect>>['server']
  const call = (name: string, args: Record<string, unknown>) => client.callTool({ name, arguments: args })

  beforeAll(async () => {
    ;({ client, server } = await connect())
  })

  afterAll(async () => {
    await client.close()
    await server.close()
  })

  it('reports the package version releases bump (packages/mcp/package.json)', () => {
    expect(client.getServerVersion()).toMatchObject({ name: 'subelt', version: pkg.version })
  })

  it('lists all five tools', async () => {
    const { tools } = await client.listTools()
    expect(tools.map(t => t.name).sort()).toEqual([
      'describe_utility', 'detect_format', 'list_utilities', 'run_pipeline', 'run_utility',
    ])
  })

  it('declares an output schema on every tool and returns matching structured content', async () => {
    const { tools } = await client.listTools()
    for (const t of tools) expect(t.outputSchema, t.name).toBeDefined()
    // the client validates structuredContent against each tool's outputSchema, so a mismatch rejects here
    const results = await Promise.all([
      call('list_utilities', { query: 'base64' }),
      call('run_utility', { id: 'gzip_compress', input: 'hi' }),
      call('run_pipeline', {
        input: ' !not base64! ',
        steps: [
          { id: 'a', utilityId: 'trim' },
          { id: 'b', utilityId: 'base64_decode', onError: 'stop' },
          { id: 'c', utilityId: 'base64_encode' },
        ],
      }),
      call('detect_format', { input: '{"a":1}' }),
    ])
    for (const res of results) {
      expect(res.isError, text(res)).toBeFalsy()
      expect(res.structuredContent).toEqual(json(res))
    }
    expect(results[2].structuredContent).toMatchObject({ halted: true, skipped: { c: 'halted' } })
  })

  it('describes every utility within describe_utility’s output schema', async () => {
    const { items } = json(await call('list_utilities', { limit: 500 }))
    for (const { id } of items) {
      const res = await call('describe_utility', { id })
      expect(res.isError, `${id}: ${text(res)}`).toBeFalsy()
    }
  })

  it('accepts every inputEncoding that describe_utility examples use', async () => {
    const used = new Set(Object.values(EXAMPLES).flat().map(ex => ex.inputEncoding ?? 'text'))
    const { tools } = await client.listTools()
    const schema = tools.find(t => t.name === 'run_utility')!.inputSchema as any
    for (const enc of used) expect(schema.properties.inputEncoding.enum).toContain(enc)
  })

  describe('list_utilities', () => {
    it('reports the total catalog size and the categories', async () => {
      const body = json(await call('list_utilities', {}))
      expect(body.total).toBeGreaterThan(200)
      expect(body.items).toHaveLength(50) // default limit
      expect(body.categories).toContain('Encoding')
    })

    it('filters by category (case-insensitively) and respects limit', async () => {
      const body = json(await call('list_utilities', { category: 'encoding', limit: 3 }))
      expect(body.items).toHaveLength(3)
      expect(body.total).toBeGreaterThan(3)
      expect(body.items.every((i: { category: string }) => i.category === 'Encoding')).toBe(true)
    })

    it('matches a query against id, name, description, tags and aliases', async () => {
      const body = json(await call('list_utilities', { query: 'base64' }))
      expect(body.items.some((i: { id: string }) => i.id === 'base64_encode')).toBe(true)
    })

    it('matches multi-word queries in any order', async () => {
      const body = json(await call('list_utilities', { query: 'encode url' }))
      expect(body.items.map((i: { id: string }) => i.id)).toContain('url_encode')
    })

    it('ranks an exact id match first', async () => {
      const body = json(await call('list_utilities', { query: 'case' }))
      expect(body.items[0].id).toBe('case')
    })

    it('returns nothing (not everything) for a query that matches nothing', async () => {
      const body = json(await call('list_utilities', { query: 'zzqqxx-no-such-thing' }))
      expect(body).toMatchObject({ items: [], total: 0 })
    })

    it('rejects an out-of-range limit via the input schema', async () => {
      const res = await call('list_utilities', { limit: 0 })
      expect(res.isError).toBe(true)
    })
  })

  describe('describe_utility', () => {
    it('returns params, accepts/produces, tags, aliases and examples', async () => {
      const doc = json(await call('describe_utility', { id: 'base64_encode' }))
      expect(doc.id).toBe('base64_encode')
      expect(doc.params).toBeTypeOf('object')
      expect(doc.accepts).toBeDefined()
      expect(doc.produces).toBeDefined()
      expect(Array.isArray(doc.tags)).toBe(true)
      expect(doc.examples).toEqual(EXAMPLES.base64_encode)
      expect(doc.unavailable).toBeUndefined()
    })

    it('reports a select param\'s options and default', async () => {
      const doc = json(await call('describe_utility', { id: 'case' }))
      expect(doc.params.mode.kind).toBe('select')
      expect(doc.params.mode.options).toContain('upper')
      expect(doc.params.mode).toHaveProperty('default')
    })

    it('flags custom_js as unavailable', async () => {
      const doc = json(await call('describe_utility', { id: 'custom_js' }))
      expect(doc.unavailable).toMatch(/JavaScript/)
    })

    it('errors on an unknown id', async () => {
      const res = await call('describe_utility', { id: 'not_a_real_utility' })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/unknown utility/)
    })
  })

  describe('run_utility', () => {
    it('runs a plain string utility', async () => {
      const res = await call('run_utility', { id: 'base64_encode', input: 'hello' })
      expect(res.isError).toBeFalsy()
      expect(json(res)).toEqual({ output: b64('hello') })
    })

    it('round-trips unicode and emoji', async () => {
      const input = 'héllo 😀 世界'
      const enc = json(await call('run_utility', { id: 'base64_encode', input })).output
      expect(enc).toBe(b64(input))
      expect(json(await call('run_utility', { id: 'base64_decode', input: enc })).output).toBe(input)
    })

    it('decodes base64 input (standard, URL-safe or unpadded) before running the utility', async () => {
      for (const input of [b64('hi?>'), 'aGk_Pg', 'aGk/Pg==']) {
        const res = await call('run_utility', { id: 'base64_encode', input, inputEncoding: 'base64' })
        expect(json(res).output).toBe(b64('hi?>'))
      }
    })

    it('decodes hex input', async () => {
      const res = await call('run_utility', { id: 'base64_encode', input: '48 65 6c 6c 6f', inputEncoding: 'hex' })
      expect(json(res).output).toBe(b64('Hello'))
    })

    it('rejects malformed base64 / hex / json input', async () => {
      for (const [input, inputEncoding] of [['not base64!!', 'base64'], ['abc', 'hex'], ['{nope', 'json']]) {
        const res = await call('run_utility', { id: 'base64_encode', input, inputEncoding })
        expect(res.isError).toBe(true)
        expect(text(res)).toMatch(/not valid/)
      }
    })

    it('parses json input', async () => {
      const res = await call('run_utility', { id: 'json_minify', input: '{"a": [1, 2]}', inputEncoding: 'json' })
      expect(json(res).output).toBe('{"a":[1,2]}')
    })

    it('returns byte output as base64 with outputEncoding set', async () => {
      const body = json(await call('run_utility', { id: 'get_bytes', input: 'hi' }))
      expect(body.outputEncoding).toBe('base64')
      expect(Buffer.from(body.output, 'base64').toString('utf8')).toBe('hi')
    })

    it('round-trips binary data: gzip_compress bytes feed gzip_decompress', async () => {
      const gz = json(await call('run_utility', { id: 'gzip_compress', input: 'hello gzip' }))
      expect(gz.outputEncoding).toBe('base64')
      const back = await call('run_utility', { id: 'gzip_decompress', input: gz.output, inputEncoding: 'base64' })
      expect(json(back).output).toBe('hello gzip')
    })

    it('honours explicit params over declared defaults', async () => {
      const res = await call('run_utility', { id: 'case', input: 'hi', params: { mode: 'title' } })
      expect(json(res).output).toBe('Hi')
    })

    it('ignores prototype-polluting param keys', async () => {
      const params = JSON.parse('{"__proto__": {"polluted": true}, "mode": "upper"}')
      const res = await call('run_utility', { id: 'case', input: 'hi', params })
      expect(json(res).output).toBe('HI')
      expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    })

    it('runs html_to_markdown (turndown) under Node', async () => {
      const res = await call('run_utility', { id: 'html_to_markdown', input: '<h1>Hi</h1><p><b>x</b></p>' })
      expect(json(res).output).toBe('# Hi\n\n**x**')
    })

    it('explains a DOM-only utility failing here', async () => {
      const res = await call('run_utility', { id: 'xml_to_json', input: '<a>1</a>' })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/needs a browser DOM/)
    })

    it('truncates output past the limit and says so', async () => {
      // repeat's count is capped (1e4), so reach twice the output limit with a longer input
      const res = await call('run_utility', { id: 'repeat', input: 'ab'.repeat(MAX_OUTPUT_CHARS / 1000), params: { count: 1000 } })
      const body = json(res)
      expect(body.truncated).toBe(true)
      expect(body.output).toHaveLength(MAX_OUTPUT_CHARS)
      expect(body.fullLength).toBe(2 * MAX_OUTPUT_CHARS)
    })

    it('errors on an unknown id', async () => {
      const res = await call('run_utility', { id: 'not_a_real_utility', input: 'x' })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/unknown utility/)
    })

    it('errors on invalid params', async () => {
      const res = await call('run_utility', { id: 'case', input: 'x', params: { mode: 'not-a-real-mode' } })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/invalid params.*mode/)
    })

    it('refuses custom_js: LLM-driven code execution is out of scope', async () => {
      const res = await call('run_utility', { id: 'custom_js', input: 'x', params: { code: 'return input' } })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/out of scope/)
    })

    it('rejects input over the 1 MB limit (measured in UTF-8 bytes)', async () => {
      const res = await call('run_utility', { id: 'base64_encode', input: 'é'.repeat(500_001) })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/exceeds/)
    })

    it('reports a failing utility as isError with its message, not a thrown exception', async () => {
      const res = await call('run_utility', { id: 'json_pretty', input: 'not json' })
      expect(res.isError).toBe(true)
      expect(text(res).length).toBeGreaterThan(0)
    })
  })

  describe('run_pipeline', () => {
    it('chains steps end to end and reports per-step timings', async () => {
      const res = await call('run_pipeline', {
        input: 'hello',
        steps: [
          { id: 's1', utilityId: 'base64_encode' },
          { id: 's2', utilityId: 'base64_decode' },
        ],
      })
      expect(res.isError).toBeFalsy()
      const body = json(res)
      expect(body.output).toBe('hello')
      expect(Object.keys(body.timings).sort()).toEqual(['s1', 's2'])
      expect(body.errors).toEqual({})
      expect(body.halted).toBe(false)
    })

    it('runs branches and macros, honouring conditions and disabled steps', async () => {
      const body = json(await call('run_pipeline', {
        input: 'hi',
        steps: [
          {
            type: 'branch', id: 'fork', merge: { mode: 'concat', separator: '|' },
            branches: [
              [{ id: 'enc', utilityId: 'base64_encode' }],
              [{ type: 'macro', id: 'm', name: 'shout', steps: [{ id: 'up', utilityId: 'case', params: { mode: 'upper' } }] }],
            ],
          },
          { id: 'never', utilityId: 'reverse', condition: { kind: 'regex', pattern: '^zzz' } },
          { id: 'off', utilityId: 'reverse', enabled: false },
        ],
      }))
      expect(body.output).toBe(`${b64('hi')}|HI`)
      expect(body.skipped).toEqual({ never: 'condition', off: 'disabled' })
      expect(Object.keys(body.timings)).toEqual(expect.arrayContaining(['fork', 'enc', 'm', 'up']))
    })

    it('runs a "run on each" step per item, and refuses custom_js inside one', async () => {
      const body = json(await call('run_pipeline', {
        input: '{"user":"YWRtaW4=","pass":"czNjcjN0"}',
        steps: [{ type: 'each', id: 'e', split: { mode: 'json-values' }, steps: [{ id: 'd', utilityId: 'base64_decode' }] }],
      }))
      expect(JSON.parse(body.output)).toEqual({ user: 'admin', pass: 's3cr3t' })
      expect(body.errors).toEqual({})
      const nested = await call('run_pipeline', {
        input: 'x', steps: [{ type: 'each', id: 'e', split: { mode: 'lines' }, steps: [{ id: 'c', utilityId: 'custom_js' }] }],
      })
      expect(nested.isError).toBe(true)
      expect(text(nested)).toMatch(/custom_js/)
    })

    it('returns bytes from the last step as base64', async () => {
      const body = json(await call('run_pipeline', { input: 'hi', steps: [{ id: 'b', utilityId: 'get_bytes' }] }))
      expect(body).toMatchObject({ output: b64('hi'), outputEncoding: 'base64' })
    })

    it('records a per-step error without failing the call (passthrough policy)', async () => {
      const res = await call('run_pipeline', { input: 'not json', steps: [{ id: 's1', utilityId: 'json_pretty' }] })
      expect(res.isError).toBeFalsy()
      const body = json(res)
      expect(Object.keys(body.errors)).toEqual(['s1'])
      expect(body.output).toBe('not json') // passthrough: input carried through unchanged
    })

    it('halts on a failing step with onError "stop"', async () => {
      const body = json(await call('run_pipeline', {
        input: 'not json',
        steps: [{ id: 's1', utilityId: 'json_pretty', onError: 'stop' }, { id: 's2', utilityId: 'reverse' }],
      }))
      expect(body.halted).toBe(true)
      expect(body.skipped).toEqual({ s2: 'halted' })
    })

    it('runs a pipeline decoded from a share link, payload or full URL', async () => {
      const payload = encodeShare({ v: 2, steps: [{ id: 's1', utilityId: 'base64_encode' }] })
      for (const share of [`#/p/${payload}`, payload, `https://example.com/#/embed/${payload}`]) {
        const res = await call('run_pipeline', { input: 'hello', share })
        expect(json(res).output).toBe(b64('hello'))
      }
    })

    it('uses `share` when an agent also sends an empty `steps` array', async () => {
      const share = `#/p/${encodeShare({ v: 2, steps: [{ id: 's1', utilityId: 'base64_encode' }] })}`
      const res = await call('run_pipeline', { input: 'hello', steps: [], share })
      expect(json(res).output).toBe(b64('hello'))
    })

    it('rejects both `steps` and `share`, and neither', async () => {
      const share = encodeShare({ v: 2, steps: [{ id: 's1', utilityId: 'base64_encode' }] })
      const both = await call('run_pipeline', { input: 'x', share, steps: [{ id: 'a', utilityId: 'reverse' }] })
      expect(both.isError).toBe(true)
      expect(text(both)).toMatch(/not both/)
      const neither = await call('run_pipeline', { input: 'x' })
      expect(neither.isError).toBe(true)
      expect(text(neither)).toMatch(/steps.*share/)
    })

    it('reports a corrupt share link', async () => {
      const res = await call('run_pipeline', { input: 'x', share: '#/p/garbage!!' })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/does not contain a pipeline|corrupted/)
    })

    it('rejects invalid params on an enabled step, but not on a disabled one', async () => {
      const bad = await call('run_pipeline', {
        input: 'hi', steps: [{ id: 's1', utilityId: 'case', params: { mode: 'bogus' } }],
      })
      expect(bad.isError).toBe(true)
      expect(text(bad)).toMatch(/invalid params.*s1.*mode/)
      const off = await call('run_pipeline', {
        input: 'hi', steps: [{ id: 's1', utilityId: 'case', params: { mode: 'bogus' }, enabled: false }],
      })
      expect(json(off).output).toBe('hi')
    })

    it('rejects unknown utility ids', async () => {
      const res = await call('run_pipeline', { input: 'x', steps: [{ id: 's1', utilityId: 'nope' }] })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/unknown utility/)
    })

    it('refuses custom_js anywhere in the tree, even disabled inside a macro', async () => {
      const top = await call('run_pipeline', {
        input: 'x', steps: [{ id: 's1', utilityId: 'custom_js', params: { code: 'return input' } }],
      })
      expect(top.isError).toBe(true)
      expect(text(top)).toMatch(/out of scope/)
      const nested = await call('run_pipeline', {
        input: 'x',
        steps: [{ type: 'macro', id: 'm', name: 'm', steps: [{ id: 'c', utilityId: 'custom_js', enabled: false }] }],
      })
      expect(nested.isError).toBe(true)
      expect(text(nested)).toMatch(/custom_js/)
    })

    it('refuses custom_js arriving through a share link', async () => {
      const share = encodeShare({ v: 2, steps: [{ id: 's1', utilityId: 'custom_js', params: { code: 'return 1' } }] })
      const res = await call('run_pipeline', { input: 'x', share })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/out of scope/)
    })

    it('rejects a pipeline over the step-count limit, nested steps included', async () => {
      const steps = Array.from({ length: 101 }, (_, i) => ({ id: `s${i}`, utilityId: 'base64_encode' }))
      const flat = await call('run_pipeline', { input: 'x', steps })
      expect(flat.isError).toBe(true)
      expect(text(flat)).toMatch(/more than 100 steps/)
      const nested = await call('run_pipeline', {
        input: 'x', steps: [{ type: 'macro', id: 'm', name: 'm', steps: steps.slice(0, 100) }],
      })
      expect(nested.isError).toBe(true)
    })

    it('rejects input over the 1 MB limit', async () => {
      const res = await call('run_pipeline', { input: 'a'.repeat(1_000_001), steps: [] })
      expect(res.isError).toBe(true)
      expect(text(res)).toMatch(/exceeds/)
    })

    it('runs an empty pipeline as the identity function', async () => {
      const res = await call('run_pipeline', { input: 'hello', steps: [] })
      expect(json(res).output).toBe('hello')
    })
  })

  describe('detect_format', () => {
    it('returns ranked candidates for JSON input', async () => {
      const res = await call('detect_format', { input: '{"a":1,"b":2}' })
      expect(res.isError).toBeFalsy()
      const { candidates } = json(res)
      expect(candidates[0]).toMatchObject({ format: 'JSON' })
      expect(candidates[0].confidence).toBeGreaterThan(0.5)
    })

    it('returns an empty list for empty input', async () => {
      expect(json(await call('detect_format', { input: '' }))).toEqual({ candidates: [] })
    })
  })

  describe('resources', () => {
    it('lists the static utilities resource and the per-utility template', async () => {
      const { resources } = await client.listResources()
      expect(resources.map(r => r.uri)).toContain('subelt://utilities')
      const { resourceTemplates } = await client.listResourceTemplates()
      expect(resourceTemplates.map(t => t.uriTemplate)).toContain('subelt://utility/{id}')
    })

    it('reads the full utility catalog', async () => {
      const items = JSON.parse(resourceText(await client.readResource({ uri: 'subelt://utilities' })))
      expect(items.length).toBeGreaterThan(200)
      expect(items[0]).toHaveProperty('id')
      expect(items[0]).toHaveProperty('tags')
    })

    it('reads one utility by id via the resource template', async () => {
      const doc = JSON.parse(resourceText(await client.readResource({ uri: 'subelt://utility/base64_encode' })))
      expect(doc.id).toBe('base64_encode')
      expect(doc.params).toBeTypeOf('object')
    })

    it('completes utility ids for the template', async () => {
      const res = await client.complete({
        ref: { type: 'ref/resource', uri: 'subelt://utility/{id}' },
        argument: { name: 'id', value: 'base64_e' },
      })
      expect(res.completion.values).toEqual(['base64_encode'])
    })

    it('errors reading an unknown utility id', async () => {
      await expect(client.readResource({ uri: 'subelt://utility/not_a_real_utility' })).rejects.toThrow()
    })
  })
})

describe('createServer options', () => {
  it('hands jobs to the injected executor with the configured timeout and the request signal', async () => {
    const seen: Array<{ job: unknown; opts: RunOptions }> = []
    const executor: Executor = {
      run: async <T>(job: unknown, opts: RunOptions) => { seen.push({ job, opts }); return { output: 'from-executor' } as T },
      close: async () => {},
    }
    const { client, server } = await connect({ executor, timeoutMs: 1234 })
    try {
      const res = await client.callTool({ name: 'run_utility', arguments: { id: 'case', input: 'x' } })
      expect(JSON.parse(text(res))).toEqual({ output: 'from-executor' })
      expect(seen).toHaveLength(1)
      expect(seen[0].job).toEqual({ kind: 'utility', id: 'case', input: 'x' })
      expect(seen[0].opts.timeoutMs).toBe(1234)
      expect(seen[0].opts.signal).toBeInstanceOf(AbortSignal)
      const { tools } = await client.listTools()
      expect(tools.find(t => t.name === 'run_utility')!.description).toMatch(/1\.234s/)
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('maps an executor failure (e.g. a timeout) to isError', async () => {
    const executor: Executor = { run: async () => { throw new Error('timed out after 5ms') }, close: async () => {} }
    const { client, server } = await connect({ executor })
    try {
      const res = await client.callTool({ name: 'run_pipeline', arguments: { input: 'x', steps: [] } })
      expect(res.isError).toBe(true)
      expect(text(res)).toBe('timed out after 5ms')
    } finally {
      await client.close()
      await server.close()
    }
  })
})
