// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeVscode, makeContext, makeDocument, makeEditor, FakePosition, FakeSelection,
  type FakeVscode,
} from './test-helpers/fake-vscode'
import { encodeShare } from '../../../src/core'
import type { PipelineStep } from '../../../src/core'
import { staticRegistry } from '../../../src/utilities/static-registry'
import { createExtension } from './commands'

let fake: FakeVscode
let context: ReturnType<typeof makeContext>

const run = (command: string) => {
  const handler = fake.commands._handlers.get(command)
  if (!handler) throw new Error(`command not registered: ${command}`)
  return handler()
}

const sel = (from: number, to: number) => new FakeSelection(new FakePosition(0, from), new FakePosition(0, to))

function openEditor(text: string, selections?: FakeSelection[]) {
  const doc = makeDocument(text)
  const editor = makeEditor(doc, selections ?? [sel(0, text.length)])
  fake.window.activeTextEditor = editor
  return { doc, editor }
}

const qp = () => fake.window.showQuickPick
const pickUtility = (id: string) => qp().mockResolvedValueOnce({ id, label: id })
const useDefaults = () => qp().mockResolvedValueOnce({ id: 'defaults', label: 'Use defaults' })
const customize = () => qp().mockResolvedValueOnce({ id: 'customize', label: 'Customize…' })
const errors = () => fake.window.showErrorMessage.mock.calls.map(c => String(c[0]))

/** Mimics the real single-line input box, which cannot hold a line break: it drops them. */
const acceptPrefilled = () => fake.window.showInputBox.mockImplementationOnce(
  async (o: { value?: string }) => (o.value ?? '').replace(/[\r\n]/g, ''),
)

function pastePipeline(steps: PipelineStep[]) {
  qp().mockResolvedValueOnce({ id: 'paste', label: 'Paste a share link or payload' })
  fake.window.showInputBox.mockResolvedValueOnce(encodeShare({ v: 2, steps }))
}

function pickFile(path: string, content: unknown) {
  fake._files.set(path, typeof content === 'string' ? content : JSON.stringify(content))
  qp().mockResolvedValueOnce({ id: 'file', label: 'Pick a JSON file…' })
  fake.window.showOpenDialog.mockResolvedValueOnce([{ fsPath: path }])
}

beforeEach(() => {
  // A fresh host and extension instance per test: no state (last run, MRU) leaks between cases.
  fake = createFakeVscode()
  context = makeContext()
  createExtension(fake as any).activate(context as any)
})

// Spies on shared utility objects from the static registry must never outlive a test.
afterEach(() => { vi.restoreAllMocks() })

describe('activate', () => {
  it('registers all four commands and hands their disposables to the context', () => {
    expect([...fake.commands._handlers.keys()].sort()).toEqual([
      'subelt.describe', 'subelt.repeatLast', 'subelt.runPipeline', 'subelt.transform',
    ])
    expect(context.subscriptions).toHaveLength(4)
  })
})

describe('subelt.transform — picking a utility', () => {
  it('offers only Node-runnable utilities, searchable by category and description', async () => {
    openEditor('x')
    qp().mockResolvedValueOnce(undefined)
    await run('subelt.transform')

    const [items, options] = qp().mock.calls[0]
    const ids = items.map((i: { id: string }) => i.id)
    expect(ids).toContain('sha3') // wasm is fine in Node
    expect(ids).not.toContain('html_to_markdown') // dom
    expect(ids).not.toContain('custom_js') // eval + main
    const caseItem = items.find((i: { id: string }) => i.id === 'case')
    const meta = staticRegistry.get('case')!
    expect(caseItem).toMatchObject({ label: meta.name, description: meta.category, detail: meta.description })
    expect(options).toMatchObject({ matchOnDescription: true, matchOnDetail: true })
  })

  it('lists recently used utilities first', async () => {
    openEditor('abc')
    pickUtility('reverse')
    await run('subelt.transform')
    openEditor('abc')
    pickUtility('case'); useDefaults()
    await run('subelt.transform')

    qp().mockReset()
    qp().mockResolvedValueOnce(undefined)
    await run('subelt.transform')
    const ids = qp().mock.calls[0][0].map((i: { id: string }) => i.id)
    expect(ids.slice(0, 2)).toEqual(['case', 'reverse'])
  })

  it('cancelling the utility picker runs nothing', async () => {
    const { doc } = openEditor('unchanged', [sel(0, 0)])
    qp().mockResolvedValueOnce(undefined)
    await run('subelt.transform')
    expect(doc._text()).toBe('unchanged')
    expect(fake.window.showErrorMessage).not.toHaveBeenCalled()
  })
})

describe('subelt.transform — selections and results', () => {
  it('with "Use defaults" replaces every selection, and flags a binary result as base64', async () => {
    const { doc } = openEditor('hiXbye', [sel(0, 2), sel(3, 6)])
    pickUtility('get_bytes'); useDefaults()
    await run('subelt.transform')

    const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
    expect(doc._text()).toBe(`${b64('hi')}X${b64('bye')}`)
    expect(fake.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('base64'))
  })

  it('with only an empty selection runs over the whole document, and pretty-prints JSON', async () => {
    const { doc } = openEditor('Mozilla/5.0 (Macintosh) Gecko/20100101 Firefox/119.0', [sel(5, 5)])
    pickUtility('user_agent_parse') // no params: no defaults/customize prompt
    await run('subelt.transform')

    const text = doc._text()
    expect(JSON.parse(text)).toMatchObject({ browser: expect.anything() })
    expect(text).toContain('\n  ')
    expect(fake.window.showInformationMessage).not.toHaveBeenCalled()
  })

  it('ignores bare cursors when there are real selections (no whole-document overlap)', async () => {
    const { doc } = openEditor('abc def ghi', [sel(0, 3), sel(6, 6), sel(8, 11)])
    pickUtility('case'); useDefaults()
    await run('subelt.transform')

    expect(errors()).toEqual([])
    expect(doc._text()).toBe('ABC def GHI')
  })

  it('handles emoji and other astral characters intact', async () => {
    const { doc } = openEditor('héllo 👋🏽 wörld')
    pickUtility('case'); useDefaults()
    await run('subelt.transform')
    expect(doc._text()).toBe('HÉLLO 👋🏽 WÖRLD')
  })

  it('names the utility in the error message when apply throws, and edits nothing', async () => {
    const { doc } = openEditor('not valid hex')
    pickUtility('get_bytes'); customize()
    qp().mockResolvedValueOnce({ label: 'hex' })
    await run('subelt.transform')

    expect(errors()).toEqual([expect.stringContaining('Get bytes')])
    expect(doc._text()).toBe('not valid hex')
  })

  it('refuses to apply stale results when the document changed while the utility ran', async () => {
    const { doc } = openEditor('hello world')
    const util = await staticRegistry.load('case')
    const spy = vi.spyOn(util, 'apply').mockImplementationOnce(async () => {
      doc._setText('the user kept typing')
      return 'HELLO WORLD'
    })
    pickUtility('case'); useDefaults()
    await run('subelt.transform')
    expect(spy).toHaveBeenCalledTimes(1)

    expect(doc._text()).toBe('the user kept typing')
    expect(errors()).toEqual([expect.stringMatching(/changed/)])
  })

  it('reports an edit VS Code declined, and does not remember it as the last run', async () => {
    const { editor } = openEditor('hello')
    editor._accept = false
    pickUtility('case'); useDefaults()
    await run('subelt.transform')
    expect(errors()).toEqual([expect.stringMatching(/could not be applied/)])

    await run('subelt.repeatLast')
    expect(fake.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('no previous'))
  })

  it('shows an error instead of failing silently when there is no editor', async () => {
    await run('subelt.transform')
    expect(errors()).toEqual([expect.stringContaining('no active editor')])
    expect(qp()).not.toHaveBeenCalled()
  })
})

describe('subelt.transform — customizing params', () => {
  it('types each param and rejects invalid numbers via validateInput', async () => {
    const chunk = await staticRegistry.load('chunk')
    const applySpy = vi.spyOn(chunk, 'apply')
    openEditor('one two three four five six seven eight')

    pickUtility('chunk'); customize()
    qp()
      .mockResolvedValueOnce({ label: 'words' }) // unit (select)
      .mockResolvedValueOnce({ label: 'Yes', value: true }) // padLast (boolean)
    fake.window.showInputBox
      .mockResolvedValueOnce('2') // size (number)
      .mockResolvedValueOnce('|') // separator (string)
      .mockResolvedValueOnce('_') // padChar (string)
    await run('subelt.transform')

    const size = fake.window.showInputBox.mock.calls[0][0]
    expect(size.validateInput('abc')).toMatch(/number/)
    expect(size.validateInput('2.5')).toMatch(/whole/)
    expect(size.validateInput('0')).toMatch(/at least/) // min: 1
    expect(size.validateInput('2')).toBeFalsy()
    expect(size.validateInput('')).toBeFalsy() // blank = default

    expect(applySpy).toHaveBeenCalledTimes(1)
    expect(applySpy.mock.calls[0][1]).toMatchObject({ size: 2, unit: 'words', separator: '|', padLast: true, padChar: '_' })
  })

  it('marks the default option in a select and the default answer for a boolean', async () => {
    openEditor('abc')
    pickUtility('chunk'); customize()
    qp().mockResolvedValueOnce(undefined) // cancel at "unit"
    fake.window.showInputBox.mockResolvedValueOnce('3') // size
    await run('subelt.transform')

    const unitItems = qp().mock.calls[2][0]
    expect(unitItems.find((i: { label: string }) => i.label === 'characters')).toMatchObject({ description: 'default' })
    expect(unitItems.find((i: { label: string }) => i.label === 'words').description).toBeUndefined()
  })

  it('a cleared number box falls back to the declared default, not 0', async () => {
    const chunk = await staticRegistry.load('chunk')
    const applySpy = vi.spyOn(chunk, 'apply')
    openEditor('abcdefghijklmnop')
    pickUtility('chunk'); customize()
    qp().mockResolvedValueOnce({ label: 'characters' }).mockResolvedValueOnce({ label: 'No', value: false })
    fake.window.showInputBox
      .mockResolvedValueOnce('') // size cleared
      .mockResolvedValueOnce('-') // separator
      .mockResolvedValueOnce(' ') // padChar
    await run('subelt.transform')

    expect(applySpy.mock.calls[0][1]).toMatchObject({ size: 10 })
  })

  it('shows a line-break default escaped, and keeps it when accepted unchanged', async () => {
    const { doc } = openEditor('abcdef')
    pickUtility('chunk'); customize()
    qp().mockResolvedValueOnce({ label: 'characters' }).mockResolvedValueOnce({ label: 'No', value: false })
    fake.window.showInputBox.mockResolvedValueOnce('2') // size
    acceptPrefilled() // separator: default '\n'
    acceptPrefilled() // padChar
    await run('subelt.transform')

    expect(fake.window.showInputBox.mock.calls[1][0].value).toBe('\\n')
    expect(doc._text()).toBe('ab\ncd\nef')
  })

  it('validates a regex param as you type', async () => {
    openEditor('a1b22')
    pickUtility('regex_extract'); customize()
    fake.window.showInputBox.mockResolvedValueOnce('\\d+').mockResolvedValueOnce('g')
    await run('subelt.transform')

    const pattern = fake.window.showInputBox.mock.calls[0][0]
    expect(pattern.validateInput('(')).toBeTruthy()
    expect(pattern.validateInput('\\d+')).toBeFalsy()
  })

  it('backing out of any param prompt runs nothing', async () => {
    const { doc } = openEditor('keep me')
    pickUtility('chunk'); customize()
    fake.window.showInputBox.mockResolvedValueOnce(undefined) // Escape at "size"
    await run('subelt.transform')

    expect(doc._text()).toBe('keep me')
    expect(errors()).toEqual([])
  })
})

describe('subelt.repeatLast', () => {
  it('says so when there is nothing to repeat', async () => {
    await run('subelt.repeatLast')
    expect(fake.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('no previous'))
  })

  it('reuses the last utility and params without prompting again', async () => {
    const first = openEditor('hello world')
    pickUtility('case'); customize()
    qp().mockResolvedValueOnce({ label: 'title' })
    await run('subelt.transform')
    expect(first.doc._text()).toBe('Hello World')

    qp().mockReset()
    const second = openEditor('second run')
    await run('subelt.repeatLast')

    expect(second.doc._text()).toBe('Second Run')
    expect(qp()).not.toHaveBeenCalled()
  })
})

describe('subelt.runPipeline — sources', () => {
  it('runs a pipeline decoded from a pasted share URL', async () => {
    const payload = encodeShare({ v: 2, steps: [{ id: 's1', utilityId: 'case', params: { mode: 'upper' } }] })
    const { doc } = openEditor('shared pipeline text')
    qp().mockResolvedValueOnce({ id: 'paste', label: 'Paste a share link or payload' })
    fake.window.showInputBox.mockResolvedValueOnce(`  https://example.com/#/p/${payload}?utm_source=chat  `)
    await run('subelt.runPipeline')

    expect(errors()).toEqual([])
    expect(doc._text()).toBe('SHARED PIPELINE TEXT')
  })

  it('runs every selection through branches and macros', async () => {
    const { doc } = openEditor('ab|cd', [sel(0, 2), sel(3, 5)])
    pastePipeline([
      { id: 'm', type: 'macro', name: 'shout', steps: [{ id: 'u', utilityId: 'case', params: { mode: 'upper' } }] },
      {
        id: 'b', type: 'branch', merge: { mode: 'concat', separator: '+' },
        branches: [[{ id: 'r', utilityId: 'reverse' }], []],
      },
    ])
    await run('subelt.runPipeline')
    expect(doc._text()).toBe('BA+AB|DC+CD')
  })

  it('runs a pipeline document picked from a .json file', async () => {
    const { doc } = openEditor('from a file')
    pickFile('/pipes/upper.json', { v: 2, name: 'upper', steps: [{ id: 's', utilityId: 'case', params: { mode: 'upper' } }] })
    await run('subelt.runPipeline')

    expect(fake.window.showOpenDialog).toHaveBeenCalledWith(expect.objectContaining({ filters: { 'Pipeline JSON': ['json'] } }))
    expect(doc._text()).toBe('FROM A FILE')
  })

  it('lets you pick one pipeline from a library export, skipping malformed entries', async () => {
    const { doc } = openEditor('Library')
    pickFile('/lib.json', {
      v: 2,
      entries: [
        null,
        { id: 'x', name: 'no steps' },
        { id: 'a', kind: 'pipeline', name: 'upper', steps: [{ id: 's', utilityId: 'case', params: { mode: 'upper' } }] },
        { id: 'b', kind: 'pipeline', name: { evil: true }, steps: [{ id: 's', utilityId: 'reverse' }] },
      ],
    })
    qp().mockImplementationOnce(async (items: { label: string }[]) => items[1])
    await run('subelt.runPipeline')

    const items = qp().mock.calls[1][0]
    expect(items.map((i: { label: string }) => i.label)).toEqual(['upper', 'untitled'])
    expect(doc._text()).toBe('yrarbiL')
  })

  it('reports an unreadable or non-JSON file', async () => {
    const { doc } = openEditor('same')
    pickFile('/broken.json', '{ not json')
    await run('subelt.runPipeline')
    expect(errors()).toEqual([expect.stringContaining('JSON')])
    expect(doc._text()).toBe('same')
  })

  it('refuses a file made by a newer version', async () => {
    const { doc } = openEditor('same')
    pickFile('/future.json', { v: 4, steps: [{ id: 's', utilityId: 'case' }] })
    await run('subelt.runPipeline')
    expect(errors()).toEqual([expect.stringContaining('newer version')])
    expect(doc._text()).toBe('same')
  })

  it('refuses a JSON file with no steps instead of making an empty edit', async () => {
    const { doc, editor } = openEditor('same')
    const editSpy = vi.spyOn(editor, 'edit')
    pickFile('/package.json', { name: 'not-a-pipeline', version: '1.0.0' })
    await run('subelt.runPipeline')
    expect(errors()).toEqual([expect.stringContaining('no steps')])
    expect(editSpy).not.toHaveBeenCalled()
    expect(doc._text()).toBe('same')
  })

  it('reports a corrupted share payload', async () => {
    openEditor('same')
    qp().mockResolvedValueOnce({ id: 'paste', label: 'Paste a share link or payload' })
    fake.window.showInputBox.mockResolvedValueOnce('https://example.com/#/p/%%%not-a-payload')
    await run('subelt.runPipeline')
    expect(errors()).toHaveLength(1)
  })
})

describe('subelt.runPipeline — refusals and error policies', () => {
  it('refuses a pipeline with an unknown utility, naming it, without editing', async () => {
    const { doc } = openEditor('untouched')
    pastePipeline([{ id: 's1', utilityId: 'totally_unknown_util' }])
    await run('subelt.runPipeline')
    expect(errors()).toEqual([expect.stringContaining('totally_unknown_util')])
    expect(doc._text()).toBe('untouched')
  })

  it('never lets text from an untrusted pipeline become a clickable link in a notification', async () => {
    openEditor('untouched')
    pastePipeline([{ id: 's1', utilityId: '[Fix it](command:workbench.action.terminal.new)' }])
    await run('subelt.runPipeline')
    expect(errors()).toHaveLength(1)
    expect(errors()[0]).toContain('Fix it')
    expect(errors()[0]).not.toMatch(/\]\(command:/)
  })

  it('refuses a browser-only (DOM) utility, even nested in a branch', async () => {
    const { doc } = openEditor('<b>hi</b>')
    pastePipeline([
      { id: 'b', type: 'branch', merge: { mode: 'concat' }, branches: [[{ id: 'h', utilityId: 'html_to_markdown' }]] },
    ])
    await run('subelt.runPipeline')
    expect(errors()).toEqual([expect.stringMatching(/html_to_markdown.*dom/)])
    expect(doc._text()).toBe('<b>hi</b>')
  })

  it('refuses (rather than silently disables) a pipeline containing a custom_js step', async () => {
    const { doc } = openEditor('untouched')
    pastePipeline([{ id: 's1', utilityId: 'custom_js', params: { code: 'return input' } }])
    await run('subelt.runPipeline')
    expect(errors()).toEqual([expect.stringContaining('custom_js')])
    expect(doc._text()).toBe('untouched')
  })

  it('a step with onError "stop" that fails leaves the selection untouched and says why', async () => {
    const { doc } = openEditor('not valid hex')
    pastePipeline([
      { id: 'u', utilityId: 'case', params: { mode: 'upper' } },
      { id: 'h', utilityId: 'get_bytes', params: { mode: 'hex' }, onError: 'stop' },
    ])
    await run('subelt.runPipeline')
    expect(doc._text()).toBe('not valid hex')
    expect(errors()).toEqual([expect.stringContaining('Get bytes')])
  })

  it('a passthrough failure still applies the rest, and the warning carries the error', async () => {
    const { doc } = openEditor('not valid hex')
    pastePipeline([
      { id: 'h', utilityId: 'get_bytes', params: { mode: 'hex' } },
      { id: 'u', utilityId: 'case', params: { mode: 'upper' } },
    ])
    await run('subelt.runPipeline')
    expect(doc._text()).toBe('NOT VALID HEX')
    expect(fake.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('Get bytes'))
  })
})

describe('subelt.describe', () => {
  it('opens an untitled markdown document with params and examples', async () => {
    qp().mockResolvedValueOnce({ id: 'case', label: 'change case' })
    await run('subelt.describe')

    expect(fake.workspace.openTextDocument).toHaveBeenCalledTimes(1)
    const [opts] = fake.workspace.openTextDocument.mock.calls[0]
    expect(opts.language).toBe('markdown')
    expect(opts.content).toContain('# change case')
    expect(opts.content).toMatch(/\| mode \|/)
    expect(opts.content).toContain('## Examples')
    expect(fake.window.showTextDocument).toHaveBeenCalledTimes(1)
  })

  it('lists browser-only utilities too, marked as such', async () => {
    qp().mockResolvedValueOnce(undefined)
    await run('subelt.describe')
    const items = qp().mock.calls[0][0]
    expect(items.find((i: { id: string }) => i.id === 'html_to_markdown').description).toMatch(/browser only/)
    expect(fake.workspace.openTextDocument).not.toHaveBeenCalled()
  })
})
