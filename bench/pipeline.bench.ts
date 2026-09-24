/**
 * Runner overhead: how much time `runPipeline` itself adds (step resolution,
 * param defaulting, coercion between steps, timing bookkeeping) on top of the
 * ten `apply` calls, at two input sizes. A regression here shows up as the
 * per-step overhead growing disproportionately to input size.
 *
 * `npm run bench` (vitest bench --run) runs this file.
 */
import { bench, describe } from 'vitest'
import { runPipeline } from '../src/utilities/index'
import type { PipelineStep } from '../src/types/utility'

const KB = 1024
const ONE_KB = 'The quick brown fox jumps over the lazy dog. '.repeat(Math.ceil(KB / 46)).slice(0, KB)
const ONE_MB = ONE_KB.repeat(1024)

/** Ten cheap, purely-textual steps — chosen to isolate runner overhead rather
 * than any one utility's own cost. */
const TEN_STEPS: PipelineStep[] = [
  { id: 's1', utilityId: 'trim' },
  { id: 's2', utilityId: 'reverse' },
  { id: 's3', utilityId: 'rot13' },
  { id: 's4', utilityId: 'swap_case' },
  { id: 's5', utilityId: 'case', params: { mode: 'upper' } },
  { id: 's6', utilityId: 'case', params: { mode: 'lower' } },
  { id: 's7', utilityId: 'collapse_whitespace' },
  { id: 's8', utilityId: 'reverse' },
  { id: 's9', utilityId: 'swap_case' },
  { id: 's10', utilityId: 'trim' }
]

// Large-input benches keep a short, fixed sampling window: this suite is for
// spotting a regression (10x slower), not for precise absolute numbers, and a
// full tinybench run at this input size is minutes, not seconds.
const HEAVY = { time: 200, iterations: 5, warmupIterations: 1, warmupTime: 50 }

describe('pipeline runner: 10-step pipeline', () => {
  bench('1 KB input', async () => {
    await runPipeline(ONE_KB, TEN_STEPS, false)
  })

  bench(
    '1 MB input',
    async () => {
      await runPipeline(ONE_MB, TEN_STEPS, false)
    },
    HEAVY
  )

  bench('1 KB input, with previews', async () => {
    await runPipeline(ONE_KB, TEN_STEPS, true)
  })

  bench(
    '1 MB input, with previews',
    async () => {
      await runPipeline(ONE_MB, TEN_STEPS, true)
    },
    HEAVY
  )
})
