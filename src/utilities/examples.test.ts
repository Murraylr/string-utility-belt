/**
 * Golden examples: every utility's `examples` are executed and compared with their
 * declared output. The same examples render on the utility's doc page, so a doc
 * page can never show an example that does not actually work.
 *
 * Run one utility's examples:  npx vitest run src/utilities/examples.test.ts -t "^base32_encode"
 */
import { describe, it, expect } from 'vitest'
import { UTILITIES } from './index'
import { formatForDisplay } from '../core/coerce'
import { resolveParams, validateParams } from '../core/params'
import { coerceInputFor, resolveAccepts } from '../core/coerce'
import { decodeExampleInput } from './exampleInput'

describe('utility examples', () => {
  for (const u of UTILITIES) {
    const examples = u.examples ?? []
    examples.forEach((ex, i) => {
      it(`${u.id} #${i + 1}${ex.title ? ` — ${ex.title}` : ''}`, async () => {
        expect(ex.output !== undefined || ex.outputMatches !== undefined,
          'an example needs `output` or `outputMatches`').toBe(true)
        const raw = decodeExampleInput(ex)
        const input = coerceInputFor(raw, resolveAccepts(u.accepts, raw))
        const out = await u.apply(input, resolveParams(u, ex.params ?? {}))
        const shown = formatForDisplay(out)
        if (ex.output !== undefined) expect(shown).toBe(ex.output)
        if (ex.outputMatches !== undefined) expect(shown).toMatch(new RegExp(ex.outputMatches))
      })
    })
  }

  it("uses params in every example that pass the utility's own validation", () => {
    // doc-page playgrounds run examples through the runner, which enforces bounds
    const bad: string[] = []
    for (const u of UTILITIES) {
      for (const [i, ex] of (u.examples ?? []).entries()) {
        const problems = validateParams(u, ex.params ?? {})
        for (const [k, msg] of Object.entries(problems)) bad.push(`${u.id} #${i + 1}: ${k} ${msg}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('declares only valid example shapes', () => {
    const bad: string[] = []
    for (const u of UTILITIES) {
      for (const ex of u.examples ?? []) {
        if (typeof ex.input !== 'string') bad.push(`${u.id}: input must be a string (use inputEncoding for bytes/json)`)
        for (const k of Object.keys(ex.params ?? {})) if (!(k in (u.params ?? {}))) bad.push(`${u.id}: example uses unknown param "${k}"`)
      }
    }
    expect(bad).toEqual([])
  })
})
