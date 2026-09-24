// @vitest-environment node
/**
 * End-to-end smoke test for the real built binary (`dist/server.mjs`), talking
 * raw JSON-RPC over stdio — no SDK Client involved, so a bug in the build (a
 * broken bundle, browser-only dependency variants, wrong externals, the job-runner
 * re-entry) shows up here even if the in-process `server.test.ts` suite (which
 * never touches the built file) stays green. Only runs once `npm run build:mcp`
 * has produced the file.
 */
import { execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js'
import { afterEach, describe, expect, it } from 'vitest'

const here = path.dirname(fileURLToPath(import.meta.url))
const distPath = path.resolve(here, '../dist/server.mjs')

interface JsonRpcResponse { id?: number | string; result?: any; error?: any }

/** Direct children of `pid` (the server's job runners). */
function childPids(pid: number): number[] {
  const out = process.platform === 'win32'
    ? execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `(Get-CimInstance Win32_Process -Filter "ParentProcessId=${pid}").ProcessId`], { encoding: 'utf8' })
    : (() => { try { return execFileSync('pgrep', ['-P', String(pid)], { encoding: 'utf8' }) } catch { return '' } })()
  return out.split(/\s+/).filter(Boolean).map(Number)
}

const isAlive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }

async function waitFor(check: () => boolean, ms: number, what: string) {
  const deadline = Date.now() + ms
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`gave up waiting for: ${what}`)
    await new Promise(r => setTimeout(r, 200))
  }
}

/** Sends framed JSON-RPC lines to a child process and resolves each by request id. */
function jsonRpcSession(child: ReturnType<typeof spawn>) {
  const pending = new Map<number, { resolve: (v: JsonRpcResponse) => void; reject: (e: Error) => void }>()
  const garbage: string[] = []
  let buffer = ''
  let stderr = ''
  child.stdout!.setEncoding('utf8')
  child.stdout!.on('data', (chunk: string) => {
    buffer += chunk
    let idx: number
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx)
      buffer = buffer.slice(idx + 1)
      if (!line.trim()) continue
      let msg: JsonRpcResponse
      try { msg = JSON.parse(line) } catch { garbage.push(line); continue }
      if (typeof msg.id === 'number' && pending.has(msg.id)) {
        pending.get(msg.id)!.resolve(msg)
        pending.delete(msg.id)
      }
    }
  })
  child.stderr!.setEncoding('utf8')
  child.stderr!.on('data', (d: string) => { stderr += d })

  let nextId = 1
  const session = {
    notify(method: string, params?: unknown) {
      child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
    },
    request(method: string, params?: unknown, timeoutMs = 15000): Promise<JsonRpcResponse> {
      const id = nextId++
      child.stdin!.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => { pending.delete(id); reject(new Error(`timed out waiting for ${method} (id=${id}). stderr:\n${stderr}`)) },
          timeoutMs,
        )
        pending.set(id, {
          resolve: v => { clearTimeout(timer); resolve(v) },
          reject: e => { clearTimeout(timer); reject(e) },
        })
      })
    },
    async initialize() {
      const res = await session.request('initialize', {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'smoke-test', version: '0.0.0' },
      })
      expect(res.error, `initialize failed: ${JSON.stringify(res.error)}`).toBeUndefined()
      session.notify('notifications/initialized')
      return res
    },
    async callTool(name: string, args: Record<string, unknown>) {
      const res = await session.request('tools/call', { name, arguments: args })
      expect(res.error, `${name} failed: ${JSON.stringify(res.error)}`).toBeUndefined()
      return res.result as { content: Array<{ text: string }>; isError?: boolean }
    },
    garbage,
    get stderr() { return stderr },
  }
  return session
}

describe.skipIf(!existsSync(distPath))('subelt-mcp binary (stdio smoke test)', () => {
  const children: Array<ReturnType<typeof spawn>> = []
  const start = (env: Record<string, string> = {}) => {
    const child = spawn(process.execPath, [distPath], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env } })
    children.push(child)
    return Object.assign(jsonRpcSession(child), { child })
  }
  afterEach(() => { children.splice(0).forEach(c => c.kill()) })

  it('answers initialize, notifications/initialized and tools/list over real stdio', async () => {
    const rpc = start()
    const initRes = await rpc.initialize()
    expect(initRes.result?.serverInfo?.name).toBe('subelt')

    const toolsRes = await rpc.request('tools/list', {})
    expect(toolsRes.error, `tools/list failed: ${JSON.stringify(toolsRes.error)}`).toBeUndefined()
    const names = (toolsRes.result?.tools ?? []).map((t: { name: string }) => t.name).sort()
    expect(names).toEqual(['describe_utility', 'detect_format', 'list_utilities', 'run_pipeline', 'run_utility'])
  }, 30_000)

  it('runs utility code in the bundle with Node builds of its dependencies', async () => {
    const rpc = start()
    await rpc.initialize()
    // turndown's browser build (what a non-SSR bundle picks up) throws "document is not defined" here
    const md = await rpc.callTool('run_utility', { id: 'html_to_markdown', input: '<h1>Hi</h1><p><b>x</b></p>' })
    expect(md.isError, md.content[0].text).toBeFalsy()
    expect(JSON.parse(md.content[0].text).output).toBe('# Hi\n\n**x**')

    const gz = await rpc.callTool('run_utility', { id: 'gzip_compress', input: 'hello' })
    const back = await rpc.callTool('run_utility', {
      id: 'gzip_decompress', input: JSON.parse(gz.content[0].text).output, inputEncoding: 'base64',
    })
    expect(JSON.parse(back.content[0].text).output).toBe('hello')
    expect(rpc.garbage).toEqual([]) // nothing but JSON-RPC on stdout
  }, 30_000)

  it('kills a call that blocks the thread at the timeout and keeps serving', async () => {
    const rpc = start({ SUBELT_MCP_TIMEOUT_MS: '1500' })
    await rpc.initialize()
    const t0 = Date.now()
    // catastrophic backtracking: synchronous, so only killing the runner process can stop it
    const stuck = await rpc.callTool('run_pipeline', {
      input: `${'a'.repeat(40)}!`,
      steps: [{ id: 's1', utilityId: 'reverse', condition: { kind: 'regex', pattern: '^(a+)+$' } }],
    })
    expect(stuck.isError).toBe(true)
    expect(stuck.content[0].text).toMatch(/timed out after 1500ms/)
    expect(Date.now() - t0).toBeLessThan(10_000)

    const ok = await rpc.callTool('run_utility', { id: 'base64_encode', input: 'still alive' })
    expect(JSON.parse(ok.content[0].text).output).toBe(Buffer.from('still alive').toString('base64'))
  }, 30_000)

  it('refuses an amplifying param up front, and survives a runaway it cannot pre-check', async () => {
    const rpc = start({ SUBELT_MCP_TIMEOUT_MS: '8000' })
    await rpc.initialize()
    // declared bounds are the first line of defence: `repeat` at 1e8 never allocates
    const refused = await rpc.callTool('run_utility', {
      id: 'repeat', input: 'x'.repeat(20), params: { count: 100_000_000 },
    })
    expect(refused.isError).toBe(true)
    expect(refused.content[0].text).toMatch(/at most 10000/)
    // catastrophic backtracking has no declarative bound: the runner process is killed at
    // the deadline (in-process this would wedge the server for good)
    const boom = await rpc.callTool('run_utility', {
      id: 'replace', input: 'a'.repeat(40) + '!', params: { pattern: '(a+)+$', replacement: '', regex: true, flags: 'g' },
    })
    expect(boom.isError).toBe(true)
    expect(boom.content[0].text).toMatch(/timed out after 8000ms/)
    const ok = await rpc.callTool('run_utility', { id: 'case', input: 'alive', params: { mode: 'upper' } })
    expect(JSON.parse(ok.content[0].text).output).toBe('ALIVE')
  }, 45_000)

  it('exits when the client closes stdin, taking its job runners with it', async () => {
    const rpc = start()
    await rpc.initialize()
    await rpc.callTool('run_utility', { id: 'case', input: 'x' }) // spawns a runner
    const runners = childPids(rpc.child.pid!)
    expect(runners.length).toBeGreaterThan(0)
    let exited = false
    rpc.child.once('exit', () => { exited = true })
    rpc.child.stdin!.end()
    await waitFor(() => exited, 5000, 'server exit after stdin closed')
    await waitFor(() => runners.every(p => !isAlive(p)), 5000, 'runners to exit')
  }, 30_000)

  it('a runner whose server is killed mid-job kills itself instead of spinning on as an orphan', async () => {
    const rpc = start({ SUBELT_MCP_TIMEOUT_MS: '60000' })
    await rpc.initialize()
    rpc.request('tools/call', {
      name: 'run_pipeline',
      arguments: { input: `${'a'.repeat(40)}!`, steps: [{ id: 's', utilityId: 'reverse', condition: { kind: 'regex', pattern: '^(a+)+$' } }] },
    }, 20_000).catch(() => {})
    let runners: number[] = []
    await waitFor(() => (runners = childPids(rpc.child.pid!)).length > 0, 10_000, 'a runner to start')
    await new Promise(r => setTimeout(r, 500)) // let it get stuck in the regex
    rpc.child.kill('SIGKILL') // no chance for the server to clean up
    await waitFor(() => runners.every(p => !isAlive(p)), 10_000, 'orphaned runner to kill itself')
  }, 40_000)
})
