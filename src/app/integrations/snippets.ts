/**
 * The command-line and MCP equivalents of a utility run, as a doc page shows them
 * (`RunElsewhere`): `npx subelt …` for the shell, `run_utility` arguments for an agent.
 * Pure string building, so the formats are testable against the CLI's own parser.
 */
import { defaultParams, resolveParams } from '@/core/params'
import type { UtilityMeta } from '@/core/registry'
import type { ParamSpec, Params } from '@/types/utility'

export const MCP_PACKAGE = '@string-utility-belt/mcp'

/** One line that installs the MCP server in Claude Code; other clients take the JSON on /integrations/. */
export const MCP_ADD_COMMAND = `claude mcp add subelt -- npx -y ${MCP_PACKAGE}`

/** Input longer than this, or spanning lines, is shown as a file instead of inline `-t` text. */
export const MAX_INLINE_INPUT = 120

/** Placeholder input file for a command whose input is not shown inline. */
export const INPUT_FILE = 'input.txt'

/**
 * The CLI and the MCP server run on Node: no DOM, no browser main thread, and neither
 * runs user-supplied code by default (`checkUnsupported` in the CLI, `isEvalUtility` in the MCP server).
 */
export const runsOffBrowser = (meta: Pick<UtilityMeta, 'env'>): boolean =>
  !meta.env.some(e => e === 'dom' || e === 'main' || e === 'eval')

const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * The params that differ from the utility's defaults, in the spec's order: all a command needs
 * to say. Compared as the runner resolves them (`resolveParams`), so a cleared number box is
 * its default and a bare-string multiselect is a one-item list.
 */
export function changedParams(meta: Pick<UtilityMeta, 'params'>, params: Params): Params {
  const defaults = defaultParams(meta)
  const resolved = resolveParams(meta, params)
  const out: Params = {}
  for (const key of Object.keys(meta.params)) {
    const value = resolved[key]
    if (value !== undefined && !sameValue(value, defaults[key])) out[key] = value
  }
  return out
}

/**
 * A param value as the CLI's `key=value` text (`packages/cli/src/steps.ts`): list kinds as
 * JSON (taken whole, no escaping), scalars as text with commas escaped as `\,`.
 * `undefined` when the value has no CLI spelling.
 */
function cliValue(spec: ParamSpec, value: unknown): string | undefined {
  switch (spec.kind) {
    case 'number':
    case 'range':
      return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined
    case 'boolean':
      return typeof value === 'boolean' ? String(value) : undefined
    case 'multiselect':
    case 'keyvalue':
      return Array.isArray(value) ? JSON.stringify(value) : undefined
    default:
      return typeof value === 'string' ? value.replace(/,/g, '\\,') : undefined
  }
}

/**
 * The CLI step for this utility with these params (`id` or `id:key=value,…`), or `undefined`
 * when a value cannot be spelled. The CLI has no escape for a backslash, so a value ending in
 * one would swallow the next separator as `\,`: it can only go last, and only one of them.
 */
export function cliStep(meta: Pick<UtilityMeta, 'id' | 'params'>, params: Params): string | undefined {
  const pairs: Array<[string, string]> = []
  const trailing: Array<[string, string]> = []
  for (const [key, value] of Object.entries(changedParams(meta, params))) {
    const text = cliValue(meta.params[key], value)
    if (text === undefined) return undefined
    ;(text.endsWith('\\') ? trailing : pairs).push([key, text])
  }
  if (trailing.length > 1) return undefined
  const all = [...pairs, ...trailing]
  return all.length === 0 ? meta.id : `${meta.id}:${all.map(([k, v]) => `${k}=${v}`).join(',')}`
}

/** POSIX shell quoting: bare when nothing in it is special, else single quotes (`'` as `'\''`). */
export function shellQuote(s: string): string {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`
}

/** Short single-line text goes inline; anything else (or nothing yet) is read from a file. */
const inlineInput = (input: string): boolean =>
  input !== '' && input.length <= MAX_INLINE_INPUT && !/[\0\r\n]/.test(input)

/**
 * The full `npx subelt …` command for one utility run, or `undefined` when the utility cannot
 * run off the browser or its params cannot be spelled on a command line.
 */
export function cliCommand(meta: Pick<UtilityMeta, 'id' | 'params' | 'env'>, input: string, params: Params): string | undefined {
  if (!runsOffBrowser(meta)) return undefined
  const step = cliStep(meta, params)
  if (step === undefined) return undefined
  const source = inlineInput(input) ? `-t ${shellQuote(input)}` : `-i ${INPUT_FILE}`
  return `npx subelt ${source} ${shellQuote(step)}`
}

/** The `run_utility` arguments an agent sends for this run, minus the `input` it supplies itself. */
export function mcpArguments(meta: Pick<UtilityMeta, 'id' | 'params'>, params: Params): string {
  const changed = changedParams(meta, params)
  return JSON.stringify(Object.keys(changed).length === 0 ? { id: meta.id } : { id: meta.id, params: changed })
}
