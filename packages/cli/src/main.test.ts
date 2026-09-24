// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getSandbox, setSandbox } from '../../../src/core/sandbox'
import { encodeShare } from '../../../src/core/serialize'
import type { PipelineDoc } from '../../../src/types/utility'
import type { CliIo } from './args'
import { main } from './main'

function makeIo(opts: { stdin?: Uint8Array; isTTY?: boolean } = {}) {
  const out: (Uint8Array | string)[] = []
  const err: string[] = []
  const io: CliIo = {
    stdin: async () => opts.stdin ?? new Uint8Array(0),
    stdout: b => out.push(b),
    stderr: s => err.push(s),
    isTTY: opts.isTTY ?? false,
  }
  return {
    io,
    outText: () => out.map(c => (typeof c === 'string' ? c : Buffer.from(c).toString('utf8'))).join(''),
    outBytes: () => Buffer.concat(out.map(c => (typeof c === 'string' ? Buffer.from(c, 'utf8') : Buffer.from(c)))),
    errText: () => err.join(''),
  }
}

const enc = (s: string) => new TextEncoder().encode(s)

describe('input sources', () => {
  it('reads from stdin by default', async () => {
    const { io, outText } = makeIo({ stdin: enc('  hi  ') })
    expect(await main(['trim'], io)).toBe(0)
    expect(outText()).toBe('hi')
  })

  it('-t/--text overrides stdin', async () => {
    const { io, outText } = makeIo({ stdin: enc('ignored') })
    expect(await main(['-t', '  hi  ', 'trim'], io)).toBe(0)
    expect(outText()).toBe('hi')
  })

  it('-i/--input reads a file', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'subelt-'))
    const file = path.join(dir, 'in.txt')
    await writeFile(file, '  hi  ')
    try {
      const { io, outText } = makeIo()
      expect(await main(['-i', file, 'trim'], io)).toBe(0)
      expect(outText()).toBe('hi')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('output', () => {
  it('adds a trailing newline only on a TTY', async () => {
    const notTTY = makeIo({ stdin: enc('hi') })
    expect(await main(['base64_encode'], notTTY.io)).toBe(0)
    expect(notTTY.outText()).toBe('aGk=')

    const tty = makeIo({ stdin: enc('hi'), isTTY: true })
    expect(await main(['base64_encode'], tty.io)).toBe(0)
    expect(tty.outText()).toBe('aGk=\n')
  })

  it('writes bytes raw by default, and via formatForDisplay with --display', async () => {
    const raw = makeIo({ stdin: enc('hi') })
    expect(await main(['get_bytes'], raw.io)).toBe(0)
    expect(raw.outBytes()).toEqual(Buffer.from('hi', 'utf8'))

    const display = makeIo({ stdin: enc('hi') })
    expect(await main(['--display', 'get_bytes'], display.io)).toBe(0)
    expect(display.outText()).toMatch(/^bytes\[/)
    expect(display.outText()).toContain('utf8: hi')
  })

  it('-o/--output writes to a file instead of stdout', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'subelt-'))
    const file = path.join(dir, 'out.txt')
    try {
      const { io, outText } = makeIo({ stdin: enc('  hi  ') })
      expect(await main(['-o', file, 'trim'], io)).toBe(0)
      expect(outText()).toBe('')
      expect(await readFile(file, 'utf8')).toBe('hi')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('--json prints a RunResult summary', async () => {
    const { io, outText } = makeIo({ stdin: enc('  hi  ') })
    expect(await main(['--json', 'trim'], io)).toBe(0)
    const summary = JSON.parse(outText())
    expect(summary.out).toBe('hi')
    expect(summary.halted).toBe(false)
    expect(summary.aborted).toBe(false)
  })
})

describe('pipeline sources', () => {
  let dir: string
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'subelt-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  it('-p/--pipeline runs a PipelineDoc file', async () => {
    const doc: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }, { id: 'b', utilityId: 'base64_encode' }] }
    const file = path.join(dir, 'pipe.json')
    await writeFile(file, JSON.stringify(doc))
    const { io, outText } = makeIo({ stdin: enc(' hi ') })
    expect(await main(['-p', file], io)).toBe(0)
    expect(outText()).toBe('aGk=')
  })

  it('-p with a library export requires --name when there are several entries', async () => {
    const lib = {
      v: 2,
      entries: [
        { id: '1', kind: 'pipeline', name: 'one', steps: [{ id: 'a', utilityId: 'trim' }] },
        { id: '2', kind: 'pipeline', name: 'two', steps: [{ id: 'a', utilityId: 'base64_encode' }] },
      ],
    }
    const file = path.join(dir, 'lib.json')
    await writeFile(file, JSON.stringify(lib))

    const noName = makeIo({ stdin: enc('hi') })
    expect(await main(['-p', file], noName.io)).toBe(2)
    expect(noName.errText()).toMatch(/multiple entries/)

    const named = makeIo({ stdin: enc('hi') })
    expect(await main(['-p', file, '--name', 'two'], named.io)).toBe(0)
    expect(named.outText()).toBe('aGk=')
  })

  it('-s/--share decodes an encodeShare payload, with or without a URL prefix', async () => {
    const doc: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }] }
    const payload = encodeShare(doc)

    const bare = makeIo({ stdin: enc('  hi  ') })
    expect(await main(['-s', payload], bare.io)).toBe(0)
    expect(bare.outText()).toBe('hi')

    const url = makeIo({ stdin: enc('  hi  ') })
    expect(await main(['-s', `https://example.com/#/p/${payload}`], url.io)).toBe(0)
    expect(url.outText()).toBe('hi')
  })
})

describe('utility lookup', () => {
  it('--list prints utility ids', async () => {
    const { io, outText } = makeIo()
    expect(await main(['--list'], io)).toBe(0)
    expect(outText()).toMatch(/^trim\t/m)
  })

  it('--list <category> filters', async () => {
    const { io, outText } = makeIo()
    expect(await main(['--list', 'Encoding'], io)).toBe(0)
    const lines = outText().trim().split('\n')
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line.split('\t')[1]).toBe('Encoding')
  })

  it('--describe prints a utility\'s params', async () => {
    const { io, outText } = makeIo()
    expect(await main(['--describe', 'uuid'], io)).toBe(0)
    expect(outText()).toContain('uuid')
    expect(outText()).toContain('version')
  })

  it('--describe on an unknown id is a usage error', async () => {
    const { io, errText } = makeIo()
    expect(await main(['--describe', 'not_a_real_utility'], io)).toBe(2)
    expect(errText()).toMatch(/unknown utility/)
  })

  it('--search matches ids/names/tags', async () => {
    const { io, outText } = makeIo()
    expect(await main(['--search', 'base64'], io)).toBe(0)
    expect(outText()).toContain('base64_encode')
  })
})

describe('custom JS', () => {
  it('is refused without --allow-custom-js', async () => {
    const { io, errText } = makeIo({ stdin: enc('hi') })
    const code = 'custom_js:code=return String(input).toUpperCase()'
    expect(await main([code], io)).toBe(2)
    expect(errText()).toMatch(/--allow-custom-js/)
  })

  it('is refused when nested inside a macro or branch from a share link', async () => {
    const doc: PipelineDoc = {
      v: 2,
      steps: [{
        id: 'm', type: 'macro', name: 'wrapped',
        steps: [{ id: 'b', type: 'branch', merge: { mode: 'concat' }, branches: [[{ id: 'c', utilityId: 'custom_js', params: { code: 'return 1' } }]] }],
      }],
    }
    const { io, errText } = makeIo({ stdin: enc('hi') })
    expect(await main(['-s', encodeShare(doc)], io)).toBe(2)
    expect(errText()).toMatch(/custom_js.*--allow-custom-js/)
  })

  it('runs in a node:vm sandbox with --allow-custom-js', async () => {
    const { io, outText } = makeIo()
    const code = 'custom_js:code=return String(input).toUpperCase()'
    expect(await main(['-t', 'hi', '--allow-custom-js', code], io)).toBe(0)
    expect(outText()).toBe('HI')
  })
})

describe('dom utilities', () => {
  it('are refused in Node ("needs a browser")', async () => {
    const { io, errText } = makeIo({ stdin: enc('<p>hi</p>') })
    expect(await main(['html_to_markdown'], io)).toBe(2)
    expect(errText()).toMatch(/needs a browser/)
  })
})

describe('exit codes', () => {
  it('0 on success', async () => {
    const { io } = makeIo({ stdin: enc('hi') })
    expect(await main(['trim'], io)).toBe(0)
  })

  it('1 when a step fails while running, naming the step', async () => {
    const { io, errText } = makeIo({ stdin: enc('abc') })
    expect(await main(['get_bytes:mode=hex'], io)).toBe(1)
    expect(errText()).toMatch(/step 1 \(get_bytes\) failed: /)
  })

  it('2 on a usage error (unknown flag)', async () => {
    const { io, errText } = makeIo()
    expect(await main(['--nope'], io)).toBe(2)
    expect(errText()).toMatch(/unknown option/)
  })

  it('2 for an unknown utility id', async () => {
    const { io, errText } = makeIo({ stdin: enc('hi') })
    expect(await main(['not_a_real_utility'], io)).toBe(2)
    expect(errText()).toMatch(/unknown utility/)
  })

  it('help and version exit 0 without touching stdin', async () => {
    const help = makeIo()
    expect(await main(['--help'], help.io)).toBe(0)
    expect(help.outText()).toMatch(/^subelt/)

    const version = makeIo()
    expect(await main(['--version'], version.io)).toBe(0)
    expect(version.outText().trim()).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('input typing (matches the web app: valid UTF-8 is text, anything else stays bytes)', () => {
  it('piped UTF-8 text reaches string/bytes utilities as text (md5 prints hex, not raw digest bytes)', async () => {
    const { io, outText } = makeIo({ stdin: enc('hello') })
    expect(await main(['md5'], io)).toBe(0)
    expect(outText()).toBe('5d41402abc4b2a76b9719d911017c592')
  })

  it('piped hex text is decoded by gzip_decompress like a paste in the app', async () => {
    const hex = '1f8b0800000000000003f348cdc9c9d75148afca2c5004003e3d0f100c000000\n'
    const { io, outText } = makeIo({ stdin: enc(hex) })
    expect(await main(['gzip_decompress'], io)).toBe(0)
    expect(outText()).toBe('Hello, gzip!')
  })

  it('non-UTF-8 stdin stays raw bytes', async () => {
    const { io, outText } = makeIo({ stdin: new Uint8Array([0xff, 0x00, 0x80]) })
    expect(await main(['base64_encode'], io)).toBe(0)
    expect(outText()).toBe('/wCA')
  })

  it('valid UTF-8 that holds binary control bytes (a protobuf message) stays bytes', async () => {
    const { io, outText, errText } = makeIo({ stdin: new Uint8Array([0x0a, 0x03, 0x66, 0x6f, 0x6f]) })
    expect(await main(['protobuf_decode'], io)).toBe(0)
    expect(errText()).toBe('')
    expect(JSON.parse(outText())).toEqual([{ field: 1, wireType: 2, value: 'foo' }])
  })

  it('--bytes passes input through undecoded', async () => {
    const { io, outBytes } = makeIo({ stdin: enc('hello') })
    expect(await main(['--bytes', 'md5'], io)).toBe(0)
    expect(outBytes().toString('hex')).toBe('5d41402abc4b2a76b9719d911017c592')
  })

  it('-i applies the same rule to files', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'subelt-'))
    try {
      const text = path.join(dir, 'a.txt')
      const bin = path.join(dir, 'b.bin')
      await writeFile(text, 'hello')
      await writeFile(bin, Buffer.from([0xff, 0x00, 0x80]))
      const t = makeIo()
      expect(await main(['-i', text, 'md5'], t.io)).toBe(0)
      expect(t.outText()).toBe('5d41402abc4b2a76b9719d911017c592')
      const b = makeIo()
      expect(await main(['-i', bin, 'base64_encode'], b.io)).toBe(0)
      expect(b.outText()).toBe('/wCA')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('custom_js sees piped text as a string', async () => {
    const { io, outText } = makeIo({ stdin: enc('hi') })
    expect(await main(['--allow-custom-js', 'custom_js:code=return input.toUpperCase()'], io)).toBe(0)
    expect(outText()).toBe('HI')
  })
})

describe('terminal detection', () => {
  const docWithInput: PipelineDoc = { v: 2, steps: [{ id: 'a', utilityId: 'trim' }], input: '  from doc  ' }

  it('uses the document\'s sample input only when stdin (not stdout) is a terminal', async () => {
    const payload = encodeShare(docWithInput)
    const stdinTty = makeIo({ stdin: enc('  piped  ') })
    stdinTty.io.stdinIsTTY = true
    expect(await main(['-s', payload], stdinTty.io)).toBe(0)
    expect(stdinTty.outText()).toBe('from doc')

    // stdout is a terminal but input is piped: the pipe wins
    const stdoutTty = makeIo({ stdin: enc('  piped  '), isTTY: true })
    expect(await main(['-s', payload], stdoutTty.io)).toBe(0)
    expect(stdoutTty.outText()).toBe('piped\n')
  })

  it('hints on stderr when it is about to wait for terminal input', async () => {
    const { io, errText, outText } = makeIo({ stdin: enc('  typed  ') })
    io.stdinIsTTY = true
    expect(await main(['trim'], io)).toBe(0)
    expect(outText()).toBe('typed')
    expect(errText()).toMatch(/Ctrl-D/)
  })
})

describe('step errors', () => {
  it('names the failing step by position and utility, not just its internal id', async () => {
    const { io, errText } = makeIo({ stdin: enc('abc') })
    expect(await main(['trim', 'get_bytes:mode=hex'], io)).toBe(1)
    expect(errText()).toMatch(/step 2 \(get_bytes\) failed/)
  })
})

describe('step errors in nested steps', () => {
  it('give the dotted position through macros and branch lanes', async () => {
    const doc: PipelineDoc = {
      v: 2,
      steps: [{
        id: 'm', type: 'macro', name: 'wrapped',
        steps: [{
          id: 'b', type: 'branch', merge: { mode: 'concat', separator: '|' },
          branches: [[{ id: 't', utilityId: 'trim' }], [{ id: 'x', utilityId: 'get_bytes', params: { mode: 'hex' } }]],
        }],
      }],
    }
    const { io, errText } = makeIo({ stdin: enc('abc') })
    expect(await main(['-s', encodeShare(doc)], io)).toBe(1)
    expect(errText()).toMatch(/step 1\.1\.2\.1 \(get_bytes\) failed/)
  })
})

describe('--json with a bytes result', () => {
  it('encodes bytes as base64 so the summary stays valid JSON', async () => {
    const { io, outText } = makeIo({ stdin: enc('hi') })
    expect(await main(['--json', 'get_bytes'], io)).toBe(0)
    expect(JSON.parse(outText()).out).toEqual({ type: 'bytes', base64: 'aGk=' })
  })
})

describe('param parsing end to end', () => {
  it('an apostrophe in a value does not swallow the following params', async () => {
    const { io, outText } = makeIo({ stdin: enc("don't stop") })
    expect(await main(["replace:pattern=don't,replacement=do not,regex=false"], io)).toBe(0)
    expect(outText()).toBe('do not stop')
  })

  it('an unbalanced bracket in a value does not swallow the following params', async () => {
    const { io, outText } = makeIo({ stdin: enc('a[b') })
    expect(await main(['replace:pattern=[,replacement=(,regex=false'], io)).toBe(0)
    expect(outText()).toBe('a(b')
  })

  it('a regex character class may contain a comma', async () => {
    const { io, outText } = makeIo({ stdin: enc('a,b;c') })
    expect(await main(['replace:pattern=[,;],replacement=-'], io)).toBe(0)
    expect(outText()).toBe('a-b-c')
  })

  it('a multiselect takes a plain comma list', async () => {
    const { io, outText } = makeIo({ stdin: enc('mail a@b.co or see https://x.io') })
    expect(await main(['extract_preset:type=emails,urls,sort=true'], io)).toBe(0)
    expect(outText()).toBe('a@b.co\nhttps://x.io')
  })

  it('a keyvalue takes a plain comma list of find:replace pairs', async () => {
    const { io, outText } = makeIo({ stdin: enc('the colour grey') })
    expect(await main(['multi_replace:rules=colour:color,grey:gray'], io)).toBe(0)
    expect(outText()).toBe('the color gray')
  })

  it('suggests close matches for an unknown utility', async () => {
    const { io, errText } = makeIo({ stdin: enc('hi') })
    expect(await main(['base64'], io)).toBe(2)
    expect(errText()).toMatch(/did you mean .*base64_encode/)
  })
})

describe('--list', () => {
  it('an unknown category is a usage error', async () => {
    const { io, errText } = makeIo()
    expect(await main(['--list', 'Nope'], io)).toBe(2)
    expect(errText()).toMatch(/no utilities in category 'Nope'/)
  })

  it('matches a category case-insensitively', async () => {
    const { io, outText } = makeIo()
    expect(await main(['--list', 'encoding'], io)).toBe(0)
    expect(outText()).toMatch(/^base64_encode\tEncoding\t/m)
  })
})

describe('conflicting options', () => {
  it('-t with -i is a usage error', async () => {
    const { io, errText } = makeIo()
    expect(await main(['-t', 'x', '-i', 'y.txt', 'trim'], io)).toBe(2)
    expect(errText()).toMatch(/--text.*--input/)
  })

  it('--name without --pipeline is a usage error', async () => {
    const { io, errText } = makeIo()
    expect(await main(['--name', 'x', 'trim'], io)).toBe(2)
    expect(errText()).toMatch(/--name/)
  })
})

describe('--pipeline library exports', () => {
  let dir: string
  beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'subelt-')) })
  afterEach(async () => { await rm(dir, { recursive: true, force: true }) })

  it('skips malformed entries instead of crashing, and matches --name against ids too', async () => {
    const file = path.join(dir, 'lib.json')
    await writeFile(file, JSON.stringify({
      v: 2,
      entries: [null, 'junk', { id: 'e1', name: 'one', steps: [{ id: 'a', utilityId: 'trim' }] },
        { id: 'e2', name: 'two', steps: [{ id: 'a', utilityId: 'base64_encode' }] }],
    }))
    const byId = makeIo({ stdin: enc('hi') })
    expect(await main(['-p', file, '--name', 'e2'], byId.io)).toBe(0)
    expect(byId.outText()).toBe('aGk=')
  })

  it('refuses a file from a newer schema version', async () => {
    const file = path.join(dir, 'new.json')
    await writeFile(file, JSON.stringify({ v: 99, steps: [{ id: 'a', utilityId: 'trim' }] }))
    const { io, errText } = makeIo({ stdin: enc('hi') })
    expect(await main(['-p', file], io)).toBe(2)
    expect(errText()).toMatch(/newer/)
  })
})

describe('custom JS output channel', () => {
  it('console output from custom code goes to stderr, never into the piped result', async () => {
    const { io, outText, errText } = makeIo({ stdin: enc('hi') })
    const code = 'custom_js:code=console.log("debug line"); return input'
    expect(await main(['--allow-custom-js', code], io)).toBe(0)
    expect(outText()).toBe('hi')
    expect(errText()).toContain('debug line')
  })

  it('an async busy loop is stopped by timeoutMs instead of hanging the CLI', async () => {
    const { io, errText } = makeIo({ stdin: enc('hi') })
    const t0 = Date.now()
    expect(await main(['--allow-custom-js', 'custom_js:code=for(;;) await 0,timeoutMs=300'], io)).toBe(1)
    expect(errText()).toMatch(/timed out/)
    expect(Date.now() - t0).toBeLessThan(8000)
  }, 15000)

  it('restores a sandbox the host had registered before main() ran', async () => {
    const hostSandbox = { run: async () => 'host' }
    setSandbox(hostSandbox)
    try {
      const { io } = makeIo({ stdin: enc('hi') })
      await main(['--allow-custom-js', 'custom_js:code=return input'], io)
      expect(getSandbox()).toBe(hostSandbox)
    } finally {
      setSandbox(null)
    }
  })
})
