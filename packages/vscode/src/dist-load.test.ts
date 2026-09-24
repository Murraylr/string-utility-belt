// @vitest-environment node
/**
 * Loads the actual built bundle (packages/vscode/dist/extension.cjs) under plain Node,
 * with `vscode` stubbed via `Module._load` patching since no `vscode` package exists on
 * disk, and drives a command through it. Skipped when the build hasn't been run — see
 * the repo root's `npm run build:vscode`.
 */
import { existsSync } from 'node:fs'
import Module, { createRequire } from 'node:module'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { encodeShare } from '../../../src/core'
import type { PipelineStep } from '../../../src/core'
import { createFakeVscode, makeContext, makeDocument, makeEditor, FakePosition, FakeSelection } from './test-helpers/fake-vscode'

const require = createRequire(import.meta.url)
const DIST = path.resolve(__dirname, '../dist/extension.cjs')
const hasBuild = existsSync(DIST)

/** `require`s the bundle with `vscode` resolved to `fake`; restores the loader afterwards. */
function loadBundle(fake: unknown) {
  const loader = Module as unknown as { _load: (request: string, ...rest: unknown[]) => unknown }
  const realLoad = loader._load
  loader._load = function (this: unknown, request: string, ...rest: unknown[]) {
    return request === 'vscode' ? fake : realLoad.apply(this, [request, ...rest])
  }
  try {
    delete require.cache[DIST]
    return require(DIST) as { activate(ctx: unknown): void; deactivate(): void }
  } finally {
    loader._load = realLoad
    delete require.cache[DIST]
  }
}

describe.skipIf(!hasBuild)('dist/extension.cjs', () => {
  const fake = createFakeVscode()
  let mod: ReturnType<typeof loadBundle>
  // Not at collection time: a skipped suite's body still runs, and there may be no bundle.
  beforeAll(() => {
    mod = loadBundle(fake)
    mod.activate(makeContext())
  })

  async function runPipelineOn(text: string, steps: PipelineStep[]) {
    const doc = makeDocument(text)
    fake.window.activeTextEditor = makeEditor(doc, [new FakeSelection(new FakePosition(0, 0), new FakePosition(0, text.length))])
    fake.window.showQuickPick.mockResolvedValueOnce({ id: 'paste' })
    fake.window.showInputBox.mockResolvedValueOnce(encodeShare({ v: 2, steps }))
    fake.window.showErrorMessage.mockClear()
    await fake.commands._handlers.get('subelt.runPipeline')!()
    return doc._text()
  }

  it('exports activate/deactivate and registers every command', () => {
    expect(typeof mod.deactivate).toBe('function')
    expect([...fake.commands._handlers.keys()].sort()).toEqual([
      'subelt.describe', 'subelt.repeatLast', 'subelt.runPipeline', 'subelt.transform',
    ])
  })

  it('runs utilities whose dependencies are lazily imported or WebAssembly, from inside the bundle', async () => {
    // yaml is a dynamic import inlined into the bundle; sha3 compiles hash-wasm's WebAssembly.
    expect(await runPipelineOn('{"a":1}', [{ id: 'y', utilityId: 'json_to_yaml' }])).toBe('a: 1\n')
    expect(await runPipelineOn('hello', [{ id: 'h', utilityId: 'sha3', params: { algorithm: 'SHA3-256', output: 'hex' } }]))
      .toBe('3338be694f50c5f338814986cdf0686453a888b84f424d792af4b9202398f392')
    expect(fake.window.showErrorMessage).not.toHaveBeenCalled()
  })

  it('refuses a browser-only utility', async () => {
    expect(await runPipelineOn('<b>x</b>', [{ id: 'h', utilityId: 'html_to_markdown' }])).toBe('<b>x</b>')
    expect(fake.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('html_to_markdown'))
  })
})

if (!hasBuild) {
  it.skip('bundle smoke test skipped: packages/vscode/dist/extension.cjs not built yet (run npm run build:vscode)', () => {})
}
