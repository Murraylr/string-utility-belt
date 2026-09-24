/**
 * The extension's commands, written against an injected `vscode` API (see extension.ts)
 * so unit tests can drive them with a fake instead of resolving the host-only module.
 */
import type * as vscode from 'vscode'
import {
  coerceInputFor, decodeShare, defaultParams, findStep, isUtilityStep, migratePipeline,
  resolveAccepts, resolveParams, runPipeline as runCore, sanitizeSteps, utilityIds, validateParam,
  SCHEMA_VERSION,
} from '../../../src/core'
import type { Params, ParamSpec, PipelineStep, Utility, UtilityMeta, Value } from '../../../src/core'
import { staticRegistry } from '../../../src/utilities/static-registry'
import {
  describeMarkdown, errorMessage, extractSharePayload, formatResult, fromDisplay, inertLinks, isLibraryExport,
  isUsableInNode, libraryEntries, orderByRecent, quarantine, targetSelections, toDisplay,
  unsupportedInNode, withRecent,
} from './logic'

/** The slice of the `vscode` module the commands use. */
export type VscodeApi = Pick<typeof vscode, 'window' | 'workspace' | 'commands' | 'Range'>

const PREFIX = 'String Utility Belt'
const RECENT_KEY = 'subelt.recentUtilities'
const MAX_RECENT = 8

/** Distinguishes "the user cancelled" from every legitimate param value, including `undefined`. */
const CANCELLED = Symbol('subelt.cancelled')

/** keyvalue/multiselect/file don't have a sensible single-line prompt — defaults only. */
const KEEP_DEFAULT_KINDS = new Set(['keyvalue', 'multiselect', 'file'])

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

interface Edit { range: vscode.Range; text: string }

export function createExtension(api: VscodeApi) {
  const { window } = api
  /** The utility + params behind the last successful "Transform Selection" run. */
  let lastRun: { utilityId: string; params: Params } | undefined

  // Messages quote untrusted text, so link syntax in them is always neutralized.
  const showError = (msg: string) => { void window.showErrorMessage(`${PREFIX}: ${inertLinks(msg)}`) }
  const showWarning = (msg: string) => { void window.showWarningMessage(`${PREFIX}: ${inertLinks(msg)}`) }
  const showInfo = (msg: string) => { void window.showInformationMessage(`${PREFIX}: ${inertLinks(msg)}`) }

  const usableUtilities = (): UtilityMeta[] => staticRegistry.list().filter(isUsableInNode)

  const toQuickPickItem = (m: UtilityMeta, description = m.category) =>
    ({ id: m.id, label: m.name, description, detail: m.description })

  /** MRU-ordered QuickPick of utilities runnable in this (Node) host. */
  async function pickUtility(context: vscode.ExtensionContext): Promise<UtilityMeta | undefined> {
    const recentIds = context.globalState.get<string[]>(RECENT_KEY, [])
    const ordered = orderByRecent(usableUtilities(), recentIds)
    const picked = await window.showQuickPick(ordered.map(m => toQuickPickItem(m)), {
      placeHolder: 'Choose a utility to run on the selection',
      matchOnDescription: true,
      matchOnDetail: true,
    })
    if (!picked) return undefined
    await context.globalState.update(RECENT_KEY, withRecent(recentIds, picked.id, MAX_RECENT))
    return ordered.find(m => m.id === picked.id)
  }

  /**
   * One param's value, `undefined` for "use the declared default" (a cleared number box),
   * or `CANCELLED` if the user backed out of the prompt.
   */
  async function promptForParam(util: UtilityMeta, spec: ParamSpec, current: unknown, siblings: Params): Promise<unknown> {
    const title = `${util.name}: ${spec.label}`
    switch (spec.kind) {
      case 'select': {
        const items = spec.options.map(o => ({ label: o, description: o === spec.default ? 'default' : undefined }))
        const picked = await window.showQuickPick(items, { title, placeHolder: spec.label })
        return picked ? picked.label : CANCELLED
      }
      case 'boolean': {
        const cur = current ?? spec.default
        const items = [
          { label: 'Yes', value: true, description: cur === true ? 'default' : undefined },
          { label: 'No', value: false, description: cur === false ? 'default' : undefined },
        ]
        const picked = await window.showQuickPick(items, { title, placeHolder: spec.label })
        return picked ? picked.value : CANCELLED
      }
      case 'number':
      case 'range': {
        const val = await window.showInputBox({
          title,
          prompt: spec.description ?? spec.label,
          value: current !== undefined ? String(current) : '',
          validateInput: v => validateParam(spec, v.trim()) ?? undefined,
        })
        if (val === undefined) return CANCELLED
        // Number('') is 0, which would slip past `min` — blank means the declared default.
        return val.trim() === '' ? undefined : Number(val)
      }
      // string, regex, textarea, code, color, date: a prefilled single-line box.
      default: {
        const display = current !== undefined ? toDisplay(String(current)) : ''
        const val = await window.showInputBox({
          title,
          prompt: spec.description ?? spec.label,
          value: display,
          validateInput: v => validateParam(spec, fromDisplay(v, current), siblings) ?? undefined,
        })
        return val === undefined ? CANCELLED : fromDisplay(val, current)
      }
    }
  }

  /** "Use defaults" vs. walk every param; `undefined` means the user cancelled the flow. */
  async function pickParams(util: UtilityMeta): Promise<Params | undefined> {
    const specs = Object.entries(util.params)
    const base = defaultParams(util)
    if (!specs.length) return base

    const mode = await window.showQuickPick(
      [{ label: 'Use defaults', id: 'defaults' as const }, { label: 'Customize…', id: 'customize' as const }],
      { placeHolder: `${util.name}: use default parameters, or customize them?` },
    )
    if (!mode) return undefined
    if (mode.id === 'defaults') return base

    const params: Params = { ...base }
    for (const [key, spec] of specs) {
      if (KEEP_DEFAULT_KINDS.has(spec.kind)) continue
      const value = await promptForParam(util, spec, params[key], params)
      if (value === CANCELLED) return undefined
      if (value === undefined) delete params[key] // resolveParams fills in the default
      else params[key] = value
    }
    return params
  }

  /** Non-empty selections (deduplicated), or the whole document when there are none. */
  function selectionRanges(document: vscode.TextDocument, selections: readonly vscode.Selection[]): vscode.Range[] {
    const targets = targetSelections(selections)
    if (!targets.length) {
      return [new api.Range(document.positionAt(0), document.positionAt(document.getText().length))]
    }
    const seen = new Set<string>()
    const ranges: vscode.Range[] = []
    for (const sel of targets) {
      const key = `${sel.start.line}:${sel.start.character}-${sel.end.line}:${sel.end.character}`
      if (seen.has(key)) continue
      seen.add(key)
      ranges.push(new api.Range(sel.start, sel.end))
    }
    return ranges
  }

  /**
   * Applies all replacements in one edit — unless the document changed since `version`
   * (the user kept typing while an async utility ran), when the computed ranges and
   * results are stale and applying them would corrupt the text.
   */
  async function applyEdits(editor: vscode.TextEditor, version: number, edits: Edit[]): Promise<boolean> {
    if (editor.document.version !== version) {
      showError('the document changed while the transform was running, so nothing was replaced. Run it again.')
      return false
    }
    let applied = false
    try {
      applied = await editor.edit(builder => { for (const e of edits) builder.replace(e.range, e.text) })
    } catch (e) {
      showError(`the edit could not be applied — ${errorMessage(e)}`)
      return false
    }
    if (!applied) showError('the edit could not be applied (was the document changed or closed?).')
    return applied
  }

  /** Runs `util` over every selection and applies the results. Returns whether it succeeded. */
  async function applyUtility(editor: vscode.TextEditor, util: Utility, params: Params): Promise<boolean> {
    const { document } = editor
    const version = document.version
    const edits: Edit[] = []
    let sawBinary = false
    for (const range of selectionRanges(document, editor.selections)) {
      const input = document.getText(range)
      try {
        const coerced = coerceInputFor(input, resolveAccepts(util.accepts, input))
        const result = await util.apply(coerced, resolveParams(util, params), { env: 'node' })
        const formatted = formatResult(result as Value)
        if (formatted.binary) sawBinary = true
        edits.push({ range, text: formatted.text })
      } catch (e) {
        showError(`"${util.name}" failed — ${errorMessage(e)}`)
        return false
      }
    }
    if (!(await applyEdits(editor, version, edits))) return false
    if (sawBinary) showInfo('binary result inserted as base64.')
    return true
  }

  async function transformWith(editor: vscode.TextEditor, meta: UtilityMeta, params: Params): Promise<void> {
    const util = await staticRegistry.load(meta.id)
    if (await applyUtility(editor, util, params)) lastRun = { utilityId: meta.id, params }
  }

  async function runTransform(context: vscode.ExtensionContext): Promise<void> {
    if (!window.activeTextEditor) { showError('no active editor.'); return }
    const meta = await pickUtility(context)
    if (!meta) return
    const params = await pickParams(meta)
    if (params === undefined) return
    // Re-read: the prompts may have been open for a while.
    const editor = window.activeTextEditor
    if (!editor) { showError('no active editor.'); return }
    await transformWith(editor, meta, params)
  }

  async function runRepeatLast(): Promise<void> {
    if (!lastRun) { showInfo('no previous transform to repeat.'); return }
    const editor = window.activeTextEditor
    if (!editor) { showError('no active editor.'); return }
    const meta = staticRegistry.get(lastRun.utilityId)
    if (!meta) { showError('that utility is no longer available.'); return }
    await transformWith(editor, meta, lastRun.params)
  }

  /** The steps in a picked `.json` file: a pipeline document, or one entry of a library export. */
  async function readPipelineFile(): Promise<PipelineStep[] | undefined> {
    const uris = await window.showOpenDialog({
      canSelectMany: false, openLabel: 'Run pipeline', filters: { 'Pipeline JSON': ['json'] },
    })
    if (!uris?.length) return undefined
    let parsed: unknown
    try {
      // workspace.fs, not node:fs: the file may live on a remote or virtual file system.
      parsed = JSON.parse(new TextDecoder().decode(await api.workspace.fs.readFile(uris[0])))
    } catch {
      showError('that file could not be read as JSON.')
      return undefined
    }
    if (isObj(parsed) && typeof parsed.v === 'number' && parsed.v > SCHEMA_VERSION) {
      showError(`that pipeline was made with a newer version (v${parsed.v}); update the extension.`)
      return undefined
    }
    if (!isLibraryExport(parsed)) return migratePipeline(parsed).steps

    const entries = libraryEntries(parsed)
    if (!entries.length) { showError('that library export has no pipelines.'); return undefined }
    const picked = await window.showQuickPick(
      entries.map((e, index) => ({ label: e.name, description: e.kind, index })),
      { placeHolder: 'Choose a pipeline from the library export' },
    )
    // Entries came from a file handed around by anyone — sanitized like a pasted share payload.
    return picked ? sanitizeSteps(entries[picked.index].steps) : undefined
  }

  /** Parses the user's pasted text or picked file into a set of steps to run. */
  async function readPipelineSteps(): Promise<PipelineStep[] | undefined> {
    const source = await window.showQuickPick(
      [{ label: 'Paste a share link or payload', id: 'paste' as const }, { label: 'Pick a JSON file…', id: 'file' as const }],
      { placeHolder: 'Where is the pipeline?' },
    )
    if (!source) return undefined
    if (source.id === 'file') return readPipelineFile()

    const raw = await window.showInputBox({
      prompt: 'Share URL (…#/p/<payload> or …#/embed/<payload>) or the bare payload',
      ignoreFocusOut: true,
    })
    if (!raw?.trim()) return undefined
    try {
      return decodeShare(extractSharePayload(raw)).steps
    } catch (e) {
      showError(errorMessage(e))
      return undefined
    }
  }

  /** "step <label or utility name>" for messages about a step id from a run result. */
  function describeStep(steps: PipelineStep[], id: string): string {
    const step = findStep(steps, id)
    if (!step) return `step ${id}`
    if (step.label) return `step "${step.label}"`
    return isUtilityStep(step) ? `"${staticRegistry.get(step.utilityId)?.name ?? step.utilityId}"` : `step ${id}`
  }

  async function runPipelineCommand(): Promise<void> {
    const editor = window.activeTextEditor
    if (!editor) { showError('no active editor.'); return }

    const rawSteps = await readPipelineSteps()
    if (!rawSteps) return
    if (!utilityIds(rawSteps).length) { showError('that pipeline has no steps to run.'); return }

    // Checked before quarantining: a step needing the browser (custom_js included) can't
    // run in this Node host either way, so it is refused outright, not silently disabled.
    const unsupported = unsupportedInNode(rawSteps, id => staticRegistry.get(id))
    if (unsupported.length) {
      const list = [...new Set(unsupported.map(u => `${u.utilityId} (${u.reason})`))].join(', ')
      showError(`this pipeline can't run in VS Code — ${list}`)
      return
    }

    // Defense in depth for any future code-running utility that doesn't need the browser:
    // a pipeline arriving from a link or file never gets to run code unasked.
    const { steps, quarantined } = quarantine(rawSteps)
    if (quarantined.length) showWarning(`disabled ${quarantined.length} code-running step(s) from this untrusted pipeline.`)

    const { document } = editor
    const version = document.version
    const edits: Edit[] = []
    const stepErrors: string[] = []
    let sawBinary = false
    for (const range of selectionRanges(document, editor.selections)) {
      const result = await runCore(document.getText(range), steps, { load: id => staticRegistry.load(id), env: 'node' })
      const failures = Object.entries(result.err).map(([id, msg]) => `${describeStep(steps, id)}: ${msg}`)
      if (result.halted) {
        showError(`the pipeline stopped at ${failures[failures.length - 1] ?? 'a failing step'} — nothing was replaced.`)
        return
      }
      stepErrors.push(...failures)
      const formatted = formatResult(result.out)
      if (formatted.binary) sawBinary = true
      edits.push({ range, text: formatted.text })
    }
    if (!(await applyEdits(editor, version, edits))) return
    if (sawBinary) showInfo('binary result inserted as base64.')
    if (stepErrors.length) {
      const more = stepErrors.length > 1 ? ` (+${stepErrors.length - 1} more)` : ''
      showWarning(`a step failed and its error policy was applied — ${stepErrors[0]}${more}`)
    }
  }

  async function runDescribe(): Promise<void> {
    const items = staticRegistry.list().map(m =>
      toQuickPickItem(m, isUsableInNode(m) ? m.category : `${m.category} · browser only`))
    const picked = await window.showQuickPick(items, {
      placeHolder: 'Choose a utility to describe',
      matchOnDescription: true,
      matchOnDetail: true,
    })
    if (!picked) return
    const util = await staticRegistry.load(picked.id)
    const env = staticRegistry.get(picked.id)?.env
    const document = await api.workspace.openTextDocument({ content: describeMarkdown(util, env), language: 'markdown' })
    await window.showTextDocument(document)
  }

  /** Unexpected failures surface as a named error rather than VS Code's generic one. */
  const guard = (fn: () => Promise<void>) => async () => {
    try { await fn() } catch (e) { showError(errorMessage(e)) }
  }

  function activate(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      api.commands.registerCommand('subelt.transform', guard(() => runTransform(context))),
      api.commands.registerCommand('subelt.repeatLast', guard(runRepeatLast)),
      api.commands.registerCommand('subelt.runPipeline', guard(runPipelineCommand)),
      api.commands.registerCommand('subelt.describe', guard(runDescribe)),
    )
  }

  return { activate, deactivate: () => {} }
}
