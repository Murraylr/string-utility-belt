/**
 * Chunked execution for huge string inputs: split on '\n', run the whole pipeline
 * per chunk of lines, join the outputs back together. Only safe when every step is
 * "line-local" (see `Utility.streamable`) — a step that looks across lines (a branch,
 * a conditional, anything stateful across the whole input) would produce different
 * output chunked than run whole, so `canChunk` refuses those trees entirely.
 *
 * Framework-free: relative imports only, no DOM, no React (see src/core/index.ts).
 */
import type { PipelineStep } from '../types/utility'
import { asText } from './coerce'
import { isBranchStep, isEachStep, isMacroStep, isUtilityStep } from './steps'
import { runPipeline, type RunOptions, type RunResult, type SkipReason } from './runner'

/** The slice of UtilityMeta canChunk actually needs, so it doesn't depend on the registry shape. */
export interface StreamableLookup {
  (utilityId: string): { streamable?: boolean } | undefined
}

/**
 * True iff every ENABLED step in the tree is safe to run one line-chunk at a time:
 * a utility step flagged `streamable`, or a macro whose enabled inner steps all are.
 * An enabled branch disqualifies the whole tree (it can reorder or merge across
 * lines), and so does any content-dependent condition (`nonEmpty`/`regex`/`type`
 * would be evaluated per chunk instead of once over the whole input) — nested
 * inside a macro too. An `always` condition never looks at content, so it is
 * ignored. Disabled steps (and everything inside them) pass through unchanged, so
 * they never affect the answer.
 *
 * An enabled "run on each" step disqualifies it too, although its items are
 * independent: chunked, its item failures and item numbers would be counted per
 * chunk ("line 3" of the second chunk), `onError: 'stop'` would fail one chunk
 * instead of the step, and each chunk would get its own item budget. Unchunked it
 * still runs off the main thread and yields between items, so it stays cancellable.
 */
export function canChunk(steps: PipelineStep[], lookup: StreamableLookup): boolean {
  return steps.every(step => {
    if (step.enabled === false) return true
    if (step.condition && step.condition.kind !== 'always') return false
    if (isBranchStep(step) || isEachStep(step)) return false
    if (isMacroStep(step)) return canChunk(step.steps, lookup)
    if (isUtilityStep(step)) return !!lookup(step.utilityId)?.streamable
    return false
  })
}

export interface ChunkedOptions extends RunOptions {
  /** Lines per chunk (default 5000; anything below 1 counts as 1). */
  chunkLines?: number
}

const DEFAULT_CHUNK_LINES = 5000

const hasOwn = (o: object, key: string) => Object.prototype.hasOwnProperty.call(o, key)

/** A real macrotask (not a microtask) so paints and input events get a turn. */
const yieldToUI = () => new Promise<void>(resolve => setTimeout(resolve, 0))

/**
 * Runs `steps` over `source` a few thousand lines at a time, awaiting a macrotask
 * between chunks so the UI stays responsive. Requires `canChunk(steps, …)` — the
 * caller is responsible for checking that first. Per-step previews are meaningless
 * across chunks (they'd only show the last chunk's values) so they are always off;
 * errors keep the first message seen for each step id, and timings are summed.
 */
export async function runChunked(source: string, steps: PipelineStep[], opts: ChunkedOptions): Promise<RunResult> {
  const { chunkLines: chunkLinesOpt, ...runOpts } = opts
  // a 0/negative/NaN step would never advance the loop below
  const chunkLines = chunkLinesOpt === undefined ? DEFAULT_CHUNK_LINES : Math.max(1, Math.floor(chunkLinesOpt) || 1)
  const lines = source.split('\n')

  const err: Record<string, string> = {}
  const timings: Record<string, number> = {}
  const skipped: Record<string, SkipReason> = {}
  const outputs: string[] = []
  let halted = false
  let aborted = false

  for (let i = 0; i < lines.length; i += chunkLines) {
    if (runOpts.signal?.aborted) { aborted = true; break }

    const chunkSource = lines.slice(i, i + chunkLines).join('\n')
    const res = await runPipeline(chunkSource, steps, { ...runOpts, previews: false })
    outputs.push(asText(res.out))
    // own-property checks: step ids come from share links and may be 'constructor' etc.
    for (const [id, message] of Object.entries(res.err)) if (!hasOwn(err, id)) err[id] = message
    for (const [id, ms] of Object.entries(res.timings)) timings[id] = (hasOwn(timings, id) ? timings[id] : 0) + ms
    Object.assign(skipped, res.skipped)
    if (res.halted) halted = true
    if (res.aborted) { aborted = true; break }

    if (i + chunkLines < lines.length) await yieldToUI()
  }

  return { out: outputs.join('\n'), previews: {}, inputs: {}, err, timings, skipped, halted, aborted }
}
