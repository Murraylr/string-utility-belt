/**
 * Property test for `Utility.streamable`: any utility flagged `streamable: true`
 * must satisfy `apply(a + '\n' + b) === apply(a) + '\n' + apply(b)`, where `a` and
 * `b` are runs of whole lines (single lines included) — the property
 * `core/streaming.ts`'s chunked runner relies on.
 * Passes trivially when no utility is flagged yet (other workstreams add flags
 * independently; this file does not flag any itself).
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { UTILITIES, loadEager, runPipeline as runEager } from '../index'
import { defaultParams } from '../../core/params'
import { canChunk, runChunked } from '../../core/streaming'
import type { Params, PipelineStep, Utility } from '../../types/utility'

const NO_NEWLINE = fc.string({ unit: 'grapheme' }).filter(s => !s.includes('\n'))
/** A chunk as the chunked runner cuts it: one or more whole lines. Single-line
 * chunks alone would not catch a utility that is only wrong from the 3rd line on. */
const CHUNK = fc.array(NO_NEWLINE, { minLength: 1, maxLength: 3 }).map(lines => lines.join('\n'))

const asStr = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v))

/** Applies the utility, returning `{ ok, value }` — a malformed-input throw (e.g. a
 * lone '%' for a percent-decoder) is a property of the *input*, not the join, so
 * such trials are skipped via `fc.pre` rather than asserted on. */
async function tryApply(util: Utility, input: string, params: Params): Promise<{ ok: true; value: string } | { ok: false }> {
  try {
    return { ok: true, value: asStr(await util.apply(input, params)) }
  } catch {
    return { ok: false }
  }
}

/** Default params, plus one variant per option of every `select` param. */
function paramVariants(util: Utility): { label: string; params: Params }[] {
  const base = defaultParams(util)
  const variants = [{ label: 'defaults', params: base }]
  for (const [key, spec] of Object.entries(util.params ?? {})) {
    if (spec.kind !== 'select') continue
    for (const option of spec.options) variants.push({ label: `${key}=${option}`, params: { ...base, [key]: option } })
  }
  return variants
}

const streamableUtilities = UTILITIES.filter(u => u.streamable === true)

describe.each(streamableUtilities.map(u => [u.id, u] as const))('streamable: %s', (_id, util) => {
  const variants = paramVariants(util)

  it.each(variants.map(v => [v.label, v.params] as const))('is line-local with params %s', async (_label, params) => {
    await fc.assert(
      fc.asyncProperty(CHUNK, CHUNK, async (a, b) => {
        const [fa, fb, fab] = await Promise.all([
          tryApply(util, a, params),
          tryApply(util, b, params),
          tryApply(util, `${a}\n${b}`, params),
        ])
        fc.pre(fa.ok && fb.ok)
        if (fa.ok && fb.ok) {
          expect(fab.ok).toBe(true)
          if (fab.ok) expect(fab.value).toEqual(`${fa.value}\n${fb.value}`)
        }
      }),
      { numRuns: 50 },
    )
  })
})

// no blank lines: an all-blank chunk is the property test's job above
const FIXTURE = ['Café résumé', 'naïve façade', 'tabs\tand  spaces', 'MiXeD case 123', '日本語 テキスト', 'emoji 😀 👍🏽', 'a-b_c.d'].join('\n')

describe('canChunk / runChunked equivalence', () => {
  it('matches a full run on a synthetic line-local fixture (never vacuous)', async () => {
    const upper: Utility = {
      id: 'fx_upper', name: 'fx upper', category: 'Test', params: {}, streamable: true,
      apply: (input: any) => String(input).toUpperCase(),
    }
    const load = async () => upper
    const steps: PipelineStep[] = [{ id: 'a', utilityId: 'fx_upper' }, { id: 'b', utilityId: 'fx_upper' }]
    expect(canChunk(steps, () => ({ streamable: true }))).toBe(true)
    const chunked = await runChunked(FIXTURE, steps, { load, chunkLines: 2 })
    expect(chunked.out).toBe(FIXTURE.toUpperCase())
  })

  it.each(streamableUtilities.map(u => [u.id] as const))('%s: chunked run equals the full run', async id => {
    const steps: PipelineStep[] = [{ id: 's', utilityId: id }]
    expect(canChunk(steps, loadEagerMeta)).toBe(true)
    const full = await runEager(FIXTURE, steps)
    // a step error is recorded per chunk when chunked, so outputs can legitimately
    // differ; equivalence is only claimed for inputs the utility accepts
    if (Object.keys(full.err).length) return
    const chunked = await runChunked(FIXTURE, steps, { load: async i => loadEager(i), chunkLines: 2 })
    expect(chunked.err).toEqual({})
    expect(chunked.out).toEqual(full.out)
  })
})

function loadEagerMeta(id: string): { streamable?: boolean } | undefined {
  try { return { streamable: !!loadEager(id).streamable } } catch { return undefined }
}
