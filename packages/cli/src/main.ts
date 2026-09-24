/**
 * `subelt` — run a String Utility Belt pipeline from the shell.
 *
 *   subelt [options] <step>...
 *
 * A step is a utility id, or `utility_id:key=value,key2=value2` (a `\,`
 * escapes a literal comma inside a value). See `HELP` below for the full
 * option list, or run `subelt --help`.
 */
import { runPipeline } from '../../../src/core/index'
import { getSandbox, setSandbox } from '../../../src/core/sandbox'
import { staticRegistry } from '../../../src/utilities/static-registry'
import { UsageError, parseArgv, type CliIo } from './args'
import { checkUnsupported, resolveInput, resolvePipelineDoc } from './pipeline'
import { createNodeSandbox } from './sandbox-node'
import {
  describeStep, emitJsonSummary, emitResult, message, printDescribe, printList, printPreviews, printSearch,
} from './output'

export type { CliIo }

/** Bump alongside the version in the repo root's package.json. */
export const VERSION = '1.3.0'

export const HELP = `subelt ${VERSION} — run a String Utility Belt pipeline from the shell

Usage:
  subelt [options] <step>...

A step is a utility id, or utility_id:key=value,key2=value2 — values are
converted per the utility's own param kind (number/range -> Number,
boolean -> true/false/1/0/yes/no, everything else -> the text as given).
A backslash escapes a comma that is part of a value: \\,
A multiselect or keyvalue value is JSON, or a comma list that runs on
until the next known param:
  extract_preset:type=urls,emails,unique=true
  multi_replace:rules=colour:color,grey:gray
A value starting with [ or { is taken whole, up to its matching bracket.

Input (pick one; default is stdin):
  -i, --input <file>        read input from a file
  -t, --text <string>       use this literal string as input
  -b, --bytes               pass stdin/--input to the pipeline as raw bytes
  Otherwise input that reads as text (UTF-8, no binary control bytes)
  becomes a string and anything else stays raw bytes, the same rule the
  web app applies to a dropped file.

Pipeline source (pick one; default is the step arguments above):
  -p, --pipeline <file>     a PipelineDoc JSON file, or a library export
      --name <name|id>      the entry to use from a --pipeline library export
  -s, --share <url|blob>    a share URL (…/#/p/<payload>) or bare payload

Output:
  -o, --output <file>       write the result to a file instead of stdout
      --json                print the run's RunResult summary as JSON
      --previews            print every step's output to stderr
      --display             render bytes with formatForDisplay instead of
                            writing them raw

Utility lookup:
      --list [category]     list utility ids (optionally one category)
      --describe <id>       show one utility's params, accepts/produces, env
      --search <query>      search ids/names/tags/aliases

Custom JavaScript:
      --allow-custom-js     allow the custom_js utility. Each run gets a
                            node:vm context on a worker thread that is
                            killed at the step's timeoutMs; its console
                            output goes to stderr. node:vm is NOT a security
                            boundary: code can escape it and act with this
                            process's full rights. Only use this on
                            pipelines you already trust. Refused
                            together with --share.

  -h, --help                show this help
  -v, --version             show the version

Exit codes: 0 ok, 1 a step failed while running, 2 a usage error.

Examples:
  echo hi | subelt base64_encode
  subelt -t 'a,b' csv_to_json
  subelt --share 'https://example.com/#/p/…' < in.txt
  subelt -i photo.png mime_from_magic
  subelt -t hi get_bytes --display
`

async function runOnce(argv: string[], io: CliIo): Promise<number> {
  const args = parseArgv(argv)

  if (args.help) { io.stdout(HELP); return 0 }
  if (args.version) { io.stdout(`${VERSION}\n`); return 0 }
  if (args.list) { printList(io, staticRegistry, args.listCategory); return 0 }
  if (args.describe) { printDescribe(io, staticRegistry, args.describe); return 0 }
  if (args.search) { printSearch(io, staticRegistry, args.search); return 0 }

  const hostSandbox = getSandbox()
  if (args.allowCustomJs) setSandbox(createNodeSandbox({ log: text => io.stderr(`${text}\n`) }))
  try {
    const doc = await resolvePipelineDoc(args, staticRegistry)
    if (!doc.steps.length) throw new UsageError('no steps given (pass one or more utility ids, or --pipeline/--share)')

    const unsupported = checkUnsupported(doc.steps, staticRegistry, args.allowCustomJs)
    if (unsupported.length) throw new UsageError(`unsupported step${unsupported.length > 1 ? 's' : ''}: ${unsupported.join('; ')}`)

    const source = await resolveInput(args, io, doc)

    const result = await runPipeline(source, doc.steps, {
      load: id => staticRegistry.load(id),
      previews: args.previews,
      env: 'node',
    })

    if (args.previews) printPreviews(io, doc.steps, result)

    if (args.json) await emitJsonSummary(io, args, result)
    else await emitResult(io, args, result.out)

    const failed = Object.keys(result.err)
    if (failed.length) {
      for (const id of failed) io.stderr(`subelt: ${describeStep(doc.steps, id)} failed: ${result.err[id]}\n`)
      return 1
    }
    return 0
  } finally {
    // put back whatever an embedding host had registered (usually nothing)
    if (args.allowCustomJs) setSandbox(hostSandbox ?? null)
  }
}

/** Never throws: usage problems exit 2, anything else unexpected exits 1. */
export async function main(argv: string[], io: CliIo): Promise<number> {
  try {
    return await runOnce(argv, io)
  } catch (e) {
    if (e instanceof UsageError) {
      io.stderr(`subelt: ${message(e)}\n\nRun 'subelt --help' for usage.\n`)
      return 2
    }
    io.stderr(`subelt: ${message(e)}\n`)
    return 1
  }
}
