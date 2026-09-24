/**
 * Editor-independent helpers for the extension: none of this touches the `vscode`
 * API, so it is tested directly without mocking anything.
 */
import { isBranchStep, isMacroStep, isUtilityStep, valueType, walkSteps } from '../../../src/core'
import type { ParamSpec, PipelineStep, UtilityEnv, UtilityMeta, Utility, Value } from '../../../src/core'

export const errorMessage = (e: unknown): string => (e as any)?.message || String(e)

/**
 * VS Code turns `[label](target)` in a notification into a clickable link — `command:`
 * targets included. Notifications quote untrusted text (utility ids and labels from a
 * shared pipeline, error messages echoing the document), so the syntax is broken up.
 */
export const inertLinks = (text: string): string => text.replace(/\]\(/g, '] (')

/** Utility ids whose params contain code that runs — never enabled from an untrusted pipeline. */
export const CODE_UTILITY_IDS = new Set(['custom_js'])

/**
 * Capabilities the extension host (a plain Node process) lacks. Stricter than the core's
 * `unsupportedSteps(…, 'node')`, which assumes a DOM shim and an eval sandbox the CLI can
 * provide but this host does not.
 */
export const NODE_MISSING_ENVS: readonly UtilityEnv[] = ['dom', 'main', 'eval']

/** Utilities a plain Node process (the extension host) can run. */
export function isUsableInNode(meta: Pick<UtilityMeta, 'env'>): boolean {
  return !meta.env.some(e => NODE_MISSING_ENVS.includes(e))
}

export interface UnsupportedStep { stepId: string; utilityId: string; reason: string }

/** Every step (nested and disabled ones included) this host cannot run, unknown utilities too. */
export function unsupportedInNode(steps: PipelineStep[], lookup: (id: string) => UtilityMeta | undefined): UnsupportedStep[] {
  const out: UnsupportedStep[] = []
  walkSteps(steps, s => {
    if (!isUtilityStep(s)) return
    const meta = lookup(s.utilityId)
    if (!meta) { out.push({ stepId: s.id, utilityId: s.utilityId, reason: 'unknown utility' }); return }
    const lack = meta.env.filter(e => NODE_MISSING_ENVS.includes(e))
    if (lack.length) out.push({ stepId: s.id, utilityId: s.utilityId, reason: `needs ${lack.join(', ')}` })
  })
  return out
}

/**
 * The selections to transform: the non-empty ones. An empty result means "the whole
 * document" — used only when every selection is a bare cursor, because a whole-document
 * range alongside real selections would overlap them (which VS Code rejects).
 */
export function targetSelections<T extends { isEmpty: boolean }>(selections: readonly T[]): T[] {
  return selections.filter(s => !s.isEmpty)
}

/** Most-recently-used ids first (in MRU order), then the rest in their given order. */
export function orderByRecent<T extends { id: string }>(items: T[], recentIds: string[]): T[] {
  const byId = new Map(items.map(m => [m.id, m]))
  const recent = recentIds.map(id => byId.get(id)).filter((m): m is T => !!m)
  const seen = new Set(recent.map(m => m.id))
  return [...recent, ...items.filter(m => !seen.has(m.id))]
}

/** MRU list with `id` moved to the front, capped at `max`. */
export function withRecent(recentIds: string[], id: string, max = 8): string[] {
  return [id, ...recentIds.filter(existing => existing !== id)].slice(0, max)
}

/**
 * How a text param's current value is shown in VS Code's single-line input box, which
 * silently drops line breaks: they (and tabs) are shown as `\n`, `\r`, `\t` escapes.
 */
export const toDisplay = (value: string): string =>
  value.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')

/** The value an input box answer stands for: an untouched prefill keeps the exact original. */
export function fromDisplay(answer: string, original: unknown): unknown {
  return original !== undefined && answer === toDisplay(String(original)) ? original : answer
}

export interface FormattedResult {
  text: string
  /** True when the raw result was bytes — the caller should tell the user it was base64-encoded. */
  binary: boolean
}

/** bytes -> base64, json -> pretty-printed, string -> itself. */
export function formatResult(v: Value): FormattedResult {
  const t = valueType(v)
  if (t === 'bytes') return { text: Buffer.from(v as Uint8Array).toString('base64'), binary: true }
  if (t === 'json') {
    try { return { text: JSON.stringify(v, null, 2), binary: false } } catch { return { text: String(v), binary: false } }
  }
  return { text: String(v ?? ''), binary: false }
}

/**
 * Pull the lz-string payload out of a pasted share/embed URL
 * (`…#/p/<payload>` or `…#/embed/<payload>`); a bare payload is returned as-is.
 * Like the app's router, a `?query` after the payload is ignored. The payload alphabet
 * has no `%`, so any percent-escapes were added in transit and are undone.
 */
export function extractSharePayload(raw: string): string {
  let s = raw.trim()
  const hashIdx = s.indexOf('#/')
  if (hashIdx !== -1) {
    const afterHash = s.slice(hashIdx + 2) // 'p/<payload>' or 'embed/<payload>'
    const slash = afterHash.indexOf('/')
    s = slash === -1 ? afterHash : afterHash.slice(slash + 1)
  }
  s = s.split('?')[0]
  if (s.includes('%')) {
    try { s = decodeURIComponent(s) } catch { /* malformed escapes: let decodeShare report it */ }
  }
  return s
}

function findCodeSteps(steps: PipelineStep[]): string[] {
  const ids: string[] = []
  const visit = (seq: PipelineStep[]) => {
    for (const s of seq) {
      if (isUtilityStep(s) && CODE_UTILITY_IDS.has(s.utilityId)) ids.push(s.id)
      else if (isBranchStep(s)) s.branches.forEach(visit)
      else if (isMacroStep(s)) visit(s.steps)
    }
  }
  visit(steps)
  return ids
}

/** Disable every `custom_js` step so a pipeline from a link or file can't run code unasked. */
export function quarantine(steps: PipelineStep[]): { steps: PipelineStep[]; quarantined: string[] } {
  const ids = new Set(findCodeSteps(steps))
  if (!ids.size) return { steps, quarantined: [] }
  const walk = (seq: PipelineStep[]): PipelineStep[] => seq.map(s => {
    if (ids.has(s.id)) return { ...s, enabled: false }
    if (isBranchStep(s)) return { ...s, branches: s.branches.map(walk) }
    if (isMacroStep(s)) return { ...s, steps: walk(s.steps) }
    return s
  })
  return { steps: walk(steps), quarantined: [...ids] }
}

/** A parsed JSON file is either a library export (`{ entries: [...] }`) or a single pipeline doc. */
export function isLibraryExport(parsed: unknown): parsed is { entries: unknown[] } {
  return !!parsed && typeof parsed === 'object' && Array.isArray((parsed as any).entries)
}

export interface LibraryExportEntry { name: string; kind: 'pipeline' | 'macro'; steps: unknown[] }

/**
 * The usable entries of a library export, with printable names. Steps are still raw
 * file data here — the caller sanitizes the chosen entry's steps before running them.
 */
export function libraryEntries(parsed: { entries: unknown[] }): LibraryExportEntry[] {
  const out: LibraryExportEntry[] = []
  for (const e of parsed.entries) {
    if (!e || typeof e !== 'object' || !Array.isArray((e as any).steps)) continue
    const { name, kind, steps } = e as { name?: unknown; kind?: unknown; steps: unknown[] }
    const label = typeof name === 'string' || typeof name === 'number' ? String(name).trim().slice(0, 120) : ''
    out.push({ name: label || 'untitled', kind: kind === 'macro' ? 'macro' : 'pipeline', steps })
  }
  return out
}

/** Keeps a value inside one markdown table cell. */
const cell = (s: string) => s.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')

/** A code fence longer than any backtick run in `text`, so example text can't close it early. */
const fenceFor = (text: string) => '`'.repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map(r => r.length + 1)))

function paramNotes(spec: ParamSpec): string {
  const notes: string[] = []
  if (spec.kind === 'select' || spec.kind === 'multiselect') notes.push(`options: ${spec.options.join(', ')}`)
  if (spec.kind === 'number' || spec.kind === 'range') {
    if (spec.min !== undefined) notes.push(`min ${spec.min}`)
    if (spec.max !== undefined) notes.push(`max ${spec.max}`)
    if (spec.kind === 'number' && spec.integer) notes.push('whole number')
  }
  if (spec.required) notes.push('required')
  return notes.join('; ')
}

/**
 * Rendered as an untitled markdown doc by the "Describe Utility" command. `env` is the
 * utility's full capability list from the registry (declared + detected).
 */
export function describeMarkdown(util: Utility, env: readonly UtilityEnv[] = util.env ?? []): string {
  const lines: string[] = [`# ${util.name}`, '', `_${util.category}_`, '']
  if (util.description) lines.push(util.description, '')
  lines.push(`- **id:** \`${util.id}\``)
  lines.push(`- **accepts:** \`${JSON.stringify(util.accepts ?? 'string')}\``)
  lines.push(`- **produces:** \`${JSON.stringify(util.produces ?? 'string')}\``)
  const lack = env.filter(e => NODE_MISSING_ENVS.includes(e))
  if (lack.length) lines.push(`- **browser only:** needs ${lack.join(', ')}, so it can't run inside VS Code — use the web app.`)
  lines.push('')

  const specs = Object.entries(util.params ?? {})
  if (specs.length) {
    lines.push('## Parameters', '', '| name | label | kind | default | notes |', '| --- | --- | --- | --- | --- |')
    for (const [key, spec] of specs) {
      const def = 'default' in spec ? JSON.stringify((spec as { default?: unknown }).default) ?? '' : ''
      lines.push(`| ${cell(key)} | ${cell(spec.label)} | ${spec.kind} | ${cell(def)} | ${cell(paramNotes(spec))} |`)
    }
    lines.push('')
  }

  if (util.tags?.length) lines.push(`**tags:** ${util.tags.join(', ')}`, '')
  if (util.aliases?.length) lines.push(`**aliases:** ${util.aliases.join(', ')}`, '')

  if (util.examples?.length) {
    lines.push('## Examples', '')
    for (const ex of util.examples) {
      if (ex.title) lines.push(`### ${ex.title}`, '')
      const body: string[] = []
      const enc = ex.inputEncoding && ex.inputEncoding !== 'text' ? ` (${ex.inputEncoding})` : ''
      body.push(enc ? `input${enc}: ${ex.input}` : `input:  ${ex.input}`)
      if (ex.params) body.push(`params: ${JSON.stringify(ex.params)}`)
      if (ex.output !== undefined) body.push(`output: ${ex.output}`)
      else if (ex.outputMatches) body.push(`output matches: /${ex.outputMatches}/`)
      const fence = fenceFor(body.join('\n'))
      lines.push(fence, ...body, fence, '')
    }
  }

  return lines.join('\n')
}
