/**
 * Everything about turning a run (or a registry query) into text: the final
 * result, the `--json` summary, `--previews` on stderr, and `--list` /
 * `--describe` / `--search`.
 */
import { writeFile } from 'node:fs/promises'
import { formatForDisplay, isUtilityStep, valueType, walkSteps } from '../../../src/core/index'
import type { Registry, RunResult, UtilityMeta } from '../../../src/core/index'
import type { ParamSpec, PipelineStep, Value } from '../../../src/types/utility'
import { UsageError, type CliIo, type ParsedArgs } from './args'

export const message = (e: unknown): string => (e instanceof Error ? e.message : String(e))

function textOf(value: Value): string {
  const t = valueType(value)
  if (t === 'json') return JSON.stringify(value, null, 2)
  if (t === 'bytes') return formatForDisplay(value)
  return String(value)
}

/** Writes the final result: bytes go out raw unless `--display`; string/json are always text. */
export async function emitResult(io: CliIo, args: ParsedArgs, value: Value): Promise<void> {
  const t = valueType(value)
  if (t === 'bytes' && !args.display) {
    if (args.outputFile) await writeFile(args.outputFile, Buffer.from(value as Uint8Array))
    else io.stdout(value as Uint8Array)
    return
  }
  const text = textOf(value)
  if (args.outputFile) { await writeFile(args.outputFile, text, 'utf8'); return }
  io.stdout(io.isTTY ? (text.endsWith('\n') ? text : `${text}\n`) : text)
}

function toJsonSafe(v: Value): unknown {
  return valueType(v) === 'bytes' ? { type: 'bytes', base64: Buffer.from(v as Uint8Array).toString('base64') } : v
}

const mapValues = (rec: Record<string, Value>) => Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, toJsonSafe(v)]))

/** `--json`: the whole `RunResult`, JSON-safe (bytes become `{type:'bytes', base64}`). */
export async function emitJsonSummary(io: CliIo, args: ParsedArgs, result: RunResult): Promise<void> {
  const summary = {
    out: toJsonSafe(result.out),
    err: result.err,
    skipped: result.skipped,
    halted: result.halted,
    aborted: result.aborted,
    timings: result.timings,
    ...(args.previews ? { previews: mapValues(result.previews), inputs: mapValues(result.inputs) } : {}),
  }
  const text = JSON.stringify(summary, null, 2)
  if (args.outputFile) { await writeFile(args.outputFile, text, 'utf8'); return }
  io.stdout(io.isTTY ? `${text}\n` : text)
}

/** `--previews`: every step's input/output, always in readable (display) form, to stderr. */
export function printPreviews(io: CliIo, steps: PipelineStep[], result: RunResult): void {
  walkSteps(steps, s => {
    const label = isUtilityStep(s) ? s.utilityId : s.type
    const skipped = result.skipped[s.id]
    if (skipped) { io.stderr(`[${s.id}] ${label} — skipped (${skipped})\n`); return }
    if (s.id in result.err) io.stderr(`[${s.id}] ${label} — error: ${result.err[s.id]}\n`)
    if (s.id in result.previews) io.stderr(`[${s.id}] ${label} -> ${formatForDisplay(result.previews[s.id])}\n`)
  })
}

/**
 * "step 2 (get_bytes)" for a failed step id: its position among the top-level steps
 * (nested ones as "2.1.3", lane/position inside branches and macros) and its utility.
 */
export function describeStep(steps: PipelineStep[], id: string): string {
  const find = (list: PipelineStep[], prefix: string): string | undefined => {
    for (let i = 0; i < list.length; i++) {
      const s = list[i]
      const pos = `${prefix}${i + 1}`
      if (s.id === id) return `step ${pos} (${isUtilityStep(s) ? s.utilityId : s.type})`
      const nested = isUtilityStep(s) ? undefined
        : s.type === 'branch' ? s.branches.map((lane, l) => find(lane, `${pos}.${l + 1}.`)).find(Boolean)
          : find(s.steps, `${pos}.`)
      if (nested) return nested
    }
    return undefined
  }
  return find(steps, '') ?? `step '${id}'`
}

function describeSpecExtra(spec: ParamSpec): string {
  const bits: string[] = []
  if ('default' in spec && spec.default !== undefined) bits.push(`default: ${JSON.stringify(spec.default)}`)
  if (spec.kind === 'select' || spec.kind === 'multiselect') bits.push(`options: ${spec.options.join(', ')}`)
  if (spec.kind === 'number' || spec.kind === 'range') {
    if (spec.min !== undefined) bits.push(`min: ${spec.min}`)
    if (spec.max !== undefined) bits.push(`max: ${spec.max}`)
  }
  if (spec.required) bits.push('required')
  return bits.length ? ` (${bits.join(', ')})` : ''
}

const typeList = (t: string | string[]): string => (Array.isArray(t) ? t.join('|') : t)

/** `--list [category]`; the category matches case-insensitively, and an unknown one is a usage error. */
export function printList(io: CliIo, registry: Registry, category?: string): void {
  let metas = registry.list()
  if (category) {
    const wanted = category.toLowerCase()
    const match = registry.categories().find(c => c.toLowerCase() === wanted)
    if (!match) {
      throw new UsageError(`no utilities in category '${category}' (categories: ${registry.categories().join(', ')})`)
    }
    metas = registry.byCategory(match)
  }
  for (const m of metas) io.stdout(`${m.id}\t${m.category}\t${m.name}${m.description ? ` — ${m.description}` : ''}\n`)
}

/** `--describe <id>`: one utility's metadata and params. */
export function printDescribe(io: CliIo, registry: Registry, id: string): void {
  const meta = registry.get(id)
  if (!meta) throw new UsageError(`unknown utility '${id}' (see --list, --search)`)
  const lines: string[] = []
  lines.push(`${meta.id} — ${meta.name}  [${meta.category}]`)
  if (meta.description) lines.push(meta.description)
  lines.push(`accepts: ${typeList(meta.accepts)}    produces: ${typeList(meta.produces)}`)
  if (meta.env.length) lines.push(`env: ${meta.env.join(', ')}`)
  if (meta.aliases.length) lines.push(`aliases: ${meta.aliases.join(', ')}`)
  if (meta.tags.length) lines.push(`tags: ${meta.tags.join(', ')}`)
  const params = Object.entries(meta.params)
  lines.push(params.length ? 'params:' : 'params: (none)')
  for (const [key, spec] of params) lines.push(`  ${key} (${spec.kind})${describeSpecExtra(spec)}`)
  io.stdout(`${lines.join('\n')}\n`)
}

/** `--search <query>`: substring match over ids, names, descriptions, tags and aliases. */
export function printSearch(io: CliIo, registry: Registry, query: string): void {
  const q = query.toLowerCase()
  const matches = (m: UtilityMeta) =>
    m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) ||
    m.description.toLowerCase().includes(q) ||
    m.tags.some(t => t.toLowerCase().includes(q)) || m.aliases.some(a => a.toLowerCase().includes(q))
  const hits = registry.list().filter(matches)
  if (!hits.length) { io.stdout(`no utilities match '${query}'\n`); return }
  for (const m of hits) io.stdout(`${m.id}\t${m.category}\t${m.name}\n`)
}
