/**
 * Chunked (`runChunked`) vs. whole-input (`runPipeline`) execution for a
 * pipeline of `streamable` steps, on a multi-megabyte, many-line input. Only
 * runs when `src/core/streaming.ts` exists — chunked execution is a separate
 * architectural piece that may land after this bench suite, so a dynamic
 * import keeps this file from failing to even load in that window.
 *
 * `npm run bench` (vitest bench --run) runs this file.
 */
import { bench, describe } from 'vitest'
import { runPipeline, loadEager } from '../src/utilities/index'
import type { PipelineStep } from '../src/types/utility'

const LINE = 'The quick brown fox jumps over the lazy dog.'
const LINES = 20_000 // ~1 MB of many short lines, the shape chunking is meant for
const BIG_INPUT = Array.from({ length: LINES }, () => LINE).join('\n')

// All three are `streamable: true` (see their metadata) and line-local, so the
// tree is safe to run one line-chunk at a time.
const STREAMABLE_STEPS: PipelineStep[] = [
  { id: 's1', utilityId: 'rot13' },
  { id: 's2', utilityId: 'atbash' },
  { id: 's3', utilityId: 'escape_html' }
]

const streamingModule = await import('../src/core/streaming').catch(() => null)

// A timing comparison only means something if both paths are legal and agree: fail
// loudly (instead of benching a no-op or a wrong answer) if a step loses its
// `streamable` flag or chunking starts to change the output.
if (streamingModule) {
  const { canChunk, runChunked } = streamingModule
  if (!canChunk(STREAMABLE_STEPS, (id) => loadEager(id))) {
    throw new Error('streaming.bench: STREAMABLE_STEPS are no longer all streamable — pick other steps')
  }
  const [full, chunked] = await Promise.all([
    runPipeline(BIG_INPUT, STREAMABLE_STEPS, false),
    runChunked(BIG_INPUT, STREAMABLE_STEPS, { load: (id) => loadEager(id), chunkLines: 500 })
  ])
  if (full.out !== chunked.out) throw new Error('streaming.bench: chunked and full runs disagree')
}

// Short, fixed sampling window: this suite is for spotting a regression, not
// precise absolute numbers, at an input size where a full tinybench run
// would take minutes.
const HEAVY = { time: 200, iterations: 5, warmupIterations: 1, warmupTime: 50 }

describe.runIf(streamingModule !== null)('chunked vs full run (streamable pipeline)', () => {
  bench(
    'full run (runPipeline)',
    async () => {
      await runPipeline(BIG_INPUT, STREAMABLE_STEPS, false)
    },
    HEAVY
  )

  bench(
    'chunked run (runChunked, 5000 lines/chunk)',
    async () => {
      const { runChunked } = streamingModule!
      await runChunked(BIG_INPUT, STREAMABLE_STEPS, { load: (id) => loadEager(id), chunkLines: 5000 })
    },
    HEAVY
  )

  bench(
    'chunked run (runChunked, 500 lines/chunk)',
    async () => {
      const { runChunked } = streamingModule!
      await runChunked(BIG_INPUT, STREAMABLE_STEPS, { load: (id) => loadEager(id), chunkLines: 500 })
    },
    HEAVY
  )
})

describe.skipIf(streamingModule !== null)('chunked vs full run (streamable pipeline)', () => {
  bench.skip('src/core/streaming.ts not present yet', () => {})
})
