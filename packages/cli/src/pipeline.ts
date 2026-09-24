/**
 * Resolves the CLI's various pipeline sources (step args, `--pipeline`,
 * `--share`) into a `PipelineDoc`, resolves the run's input, and checks a
 * pipeline against what this environment (Node) can actually run.
 */
import { readFile } from 'node:fs/promises'
import {
  SCHEMA_VERSION, decodeShare, isUtilityStep, migratePipeline, walkSteps,
} from '../../../src/core/index'
import type { Registry } from '../../../src/core/index'
import type { PipelineDoc, PipelineStep, Value } from '../../../src/types/utility'
import { UsageError, parseStepSpec } from './steps'
import type { CliIo, ParsedArgs } from './args'

/** The payload of a `…#/p/<payload>` / `…#/embed/<payload>` URL, or the text itself when it is a bare payload. */
export function payloadOf(s: string): string {
  const text = s.trim()
  const route = /#\/(?:p|embed)\/(.*)$/.exec(text)
  if (route) return route[1]
  return text.includes('/') ? text.slice(text.lastIndexOf('/') + 1) : text
}

/** decodeShare, retried once URL-decoded: chat apps and terminals sometimes percent-encode `$`/`+`. */
function decodeSharePayload(payload: string): PipelineDoc {
  try {
    return decodeShare(payload)
  } catch (e) {
    if (!/%[0-9a-f]{2}/i.test(payload)) throw e
    let unescaped: string
    try { unescaped = decodeURIComponent(payload) } catch { throw e }
    return decodeShare(unescaped)
  }
}

interface LibraryEntryLike {
  id?: unknown
  name?: unknown
  description?: unknown
  steps?: unknown
  input?: unknown
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

function refuseNewer(json: unknown, filePath: string): void {
  if (isObj(json) && typeof json.v === 'number' && json.v > SCHEMA_VERSION) {
    throw new UsageError(`'${filePath}' was made by a newer version of String Utility Belt (v${json.v}); update subelt`)
  }
}

function docFromFileJson(json: unknown, name: string | undefined, filePath: string): PipelineDoc {
  refuseNewer(json, filePath)
  if (isObj(json) && Array.isArray(json.entries)) {
    const entries = json.entries.filter(isObj) as LibraryEntryLike[]
    const label = (e: LibraryEntryLike) => (typeof e.name === 'string' && e.name ? e.name : String(e.id ?? '?'))
    const available = () => entries.map(label).join(', ')
    if (!entries.length) throw new UsageError(`'${filePath}' has no entries`)
    let chosen = entries[0]
    if (name) {
      const wanted = name.toLowerCase()
      const found = entries.find(e => typeof e.name === 'string' && e.name.toLowerCase() === wanted) ??
        entries.find(e => e.id !== undefined && String(e.id) === name)
      if (!found) throw new UsageError(`no entry named '${name}' in '${filePath}' (available: ${available()})`)
      chosen = found
    } else if (entries.length > 1) {
      throw new UsageError(`'${filePath}' has multiple entries; pick one with --name (available: ${available()})`)
    }
    return migratePipeline({
      v: 2, name: chosen.name, description: chosen.description, steps: chosen.steps, input: chosen.input,
    })
  }
  return migratePipeline(json)
}

/** Build a `PipelineDoc` from whichever of `--pipeline`, `--share` or bare step args was given. */
export async function resolvePipelineDoc(args: ParsedArgs, registry: Registry): Promise<PipelineDoc> {
  const sourceCount = (args.pipelineFile ? 1 : 0) + (args.share ? 1 : 0) + (args.stepArgs.length ? 1 : 0)
  if (sourceCount > 1) {
    throw new UsageError('give steps, --pipeline, or --share — not more than one of these')
  }

  if (args.pipelineFile) {
    let text: string
    try { text = await readFile(args.pipelineFile, 'utf8') }
    catch { throw new UsageError(`cannot read '${args.pipelineFile}'`) }
    let json: unknown
    try { json = JSON.parse(text) } catch { throw new UsageError(`'${args.pipelineFile}' is not valid JSON`) }
    const doc = docFromFileJson(json, args.pipelineName, args.pipelineFile)
    if (!doc.steps.length) throw new UsageError(`'${args.pipelineFile}' contains no pipeline steps`)
    return doc
  }

  if (args.share) {
    try { return decodeSharePayload(payloadOf(args.share)) }
    catch (e) { throw new UsageError(e instanceof Error ? e.message : String(e)) }
  }

  if (args.stepArgs.length) {
    return { v: 2, steps: args.stepArgs.map((s, i) => parseStepSpec(s, i, registry)) }
  }

  throw new UsageError('no steps given: pass one or more utility ids, or --pipeline/--share')
}

/** C0 controls plain text does not contain: everything below 0x20 except TAB, LF, VT, FF, CR and ESC. */
const isBinaryControl = (b: number) => b < 0x20 && !(b >= 0x09 && b <= 0x0d) && b !== 0x1b

/**
 * Bytes from stdin or a file, typed by the web app's text test (`looksLikeText`):
 * strict UTF-8 with no binary control bytes becomes a string (a BOM is kept);
 * anything else — including binary that happens to be valid UTF-8, like a small
 * protobuf message — stays bytes. Utilities that accept both treat them differently
 * (md5 of text is hex, of bytes a raw digest; gzip_decompress reads text as
 * base64/hex), so this keeps the CLI in step with the app. `--bytes` skips it.
 */
export function decodeInput(bytes: Uint8Array): Value {
  for (let i = 0; i < bytes.length; i++) if (isBinaryControl(bytes[i])) return bytes
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return bytes
  }
}

/** `-t` > `-i` > the document's own sample input (only when stdin is a live terminal) > stdin. */
export async function resolveInput(args: ParsedArgs, io: CliIo, doc: PipelineDoc): Promise<Value> {
  if (args.text !== undefined) return args.text
  const typed = (bytes: Uint8Array): Value => (args.bytes ? bytes : decodeInput(bytes))
  if (args.inputFile) {
    let bytes: Uint8Array
    try { bytes = new Uint8Array(await readFile(args.inputFile)) }
    catch { throw new UsageError(`cannot read '${args.inputFile}'`) }
    return typed(bytes)
  }
  if (io.stdinIsTTY) {
    if (doc.input !== undefined) return doc.input
    io.stderr('subelt: reading input from the terminal — finish with Ctrl-D (Ctrl-Z then Enter on Windows), or pass -t/-i\n')
  }
  return typed(await io.stdin())
}

/**
 * Steps this environment (Node, no browser) cannot run, one message per
 * offending step. `custom_js` is the one utility whose `main` requirement is
 * satisfied by `--allow-custom-js`'s node:vm sandbox; every other `main` or
 * `dom` step, and `eval` without the flag, is refused outright.
 */
export function checkUnsupported(steps: PipelineStep[], registry: Registry, allowCustomJs: boolean): string[] {
  const problems: string[] = []
  walkSteps(steps, s => {
    if (!isUtilityStep(s)) return
    const meta = registry.get(s.utilityId)
    if (!meta) { problems.push(`'${s.utilityId}' (step ${s.id}): unknown utility`); return }
    if (meta.env.includes('dom')) { problems.push(`'${s.utilityId}' (step ${s.id}): needs a browser`); return }
    if (meta.env.includes('eval') && !allowCustomJs) {
      problems.push(`'${s.utilityId}' (step ${s.id}): needs --allow-custom-js`)
      return
    }
    if (meta.env.includes('main') && !(s.utilityId === 'custom_js' && allowCustomJs)) {
      problems.push(`'${s.utilityId}' (step ${s.id}): needs a browser main thread`)
    }
  })
  return problems
}
