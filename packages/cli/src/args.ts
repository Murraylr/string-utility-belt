import { UsageError } from './steps'

export { UsageError }

/** The host's I/O, abstracted so `main` is testable without real stdio. */
export interface CliIo {
  stdin: () => Promise<Uint8Array>
  stdout: (b: Uint8Array | string) => void
  stderr: (s: string) => void
  /** stdout is a terminal: text output then gets a trailing newline. */
  isTTY?: boolean
  /** stdin is a terminal (nothing piped in): a pipeline's own sample input is used instead of waiting. */
  stdinIsTTY?: boolean
}

export interface ParsedArgs {
  help: boolean
  version: boolean
  list: boolean
  listCategory?: string
  describe?: string
  search?: string
  json: boolean
  previews: boolean
  display: boolean
  allowCustomJs: boolean
  /** Hand stdin / `-i` input to the pipeline as raw bytes, never decoded to text. */
  bytes: boolean
  inputFile?: string
  text?: string
  outputFile?: string
  pipelineFile?: string
  pipelineName?: string
  share?: string
  stepArgs: string[]
}

/** Parses `argv` (already stripped of `node subelt`). Throws `UsageError` for anything malformed. */
export function parseArgv(argv: string[]): ParsedArgs {
  const out: ParsedArgs = {
    help: false, version: false, list: false, json: false, previews: false,
    display: false, allowCustomJs: false, bytes: false, stepArgs: [],
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = (): string => {
      i++
      if (i >= argv.length) throw new UsageError(`${a} requires a value`)
      return argv[i]
    }
    switch (a) {
      case '-h': case '--help': out.help = true; break
      case '-v': case '--version': out.version = true; break
      case '-i': case '--input': out.inputFile = next(); break
      case '-t': case '--text': out.text = next(); break
      case '-o': case '--output': out.outputFile = next(); break
      case '-p': case '--pipeline': out.pipelineFile = next(); break
      case '-s': case '--share': out.share = next(); break
      case '--name': out.pipelineName = next(); break
      case '--describe': out.describe = next(); break
      case '--search': out.search = next(); break
      case '--json': out.json = true; break
      case '--previews': out.previews = true; break
      case '--display': out.display = true; break
      case '--allow-custom-js': out.allowCustomJs = true; break
      case '-b': case '--bytes': out.bytes = true; break
      case '--list':
        out.list = true
        if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) out.listCategory = argv[++i]
        break
      default:
        if (a.startsWith('-') && a !== '-') throw new UsageError(`unknown option: ${a}`)
        out.stepArgs.push(a)
    }
  }
  if (out.text !== undefined && out.inputFile !== undefined) {
    throw new UsageError('--text and --input cannot be combined (pick one input)')
  }
  if (out.bytes && out.text !== undefined) {
    throw new UsageError('--bytes applies to stdin and --input, not --text')
  }
  if (out.pipelineName !== undefined && out.pipelineFile === undefined) {
    throw new UsageError('--name only applies to a --pipeline library file')
  }
  // a share link is someone else's pipeline by definition, and node:vm is no boundary:
  // together these would let a link run arbitrary code with this process's rights
  if (out.allowCustomJs && out.share !== undefined) {
    throw new UsageError('--allow-custom-js cannot be combined with --share (a shared pipeline is not code you wrote); save it with --pipeline after reviewing it')
  }
  return out
}
