import { run } from '../harness'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import type { PipelineStep } from '/home/user/string-utility-belt/src/types/utility'

export const U = (id: string, utilityId: string, params: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  ({ id, utilityId, enabled: true, params, ...extra }) as any
export const E = (id: string, split: any, steps: any[], extra: Record<string, unknown> = {}) =>
  ({ id, type: 'each', enabled: true, split, skipEmpty: true, steps, ...extra }) as any

export async function show(label: string, input: string, steps: PipelineStep[]) {
  const { out, errors } = await run(input, steps)
  console.log(`\n### ${label}${Object.keys(errors).length ? '  ERRORS ' + JSON.stringify(errors) : ''}`)
  console.log(out)
  return out
}

/** Re-run every sample with Date pinned to 2020-01-01 and 2035-06-15, like recipes.test.ts does. */
export async function dateCheck(recipe: Recipe) {
  const Real = Date
  const steps = toPipelineSteps(recipe.steps)
  let ok = true
  for (const now of ['2020-01-01T00:00:00Z', '2035-06-15T12:00:00Z']) {
    const fixed = Real.parse(now)
    class FakeDate extends Real {
      constructor(...a: any[]) { if (a.length === 0) super(fixed); else super(...(a as [any])) }
      static now() { return fixed }
    }
    ;(globalThis as any).Date = FakeDate
    try {
      for (const s of recipe.samples) {
        const { out } = await run(s.input, steps)
        if (out !== s.output) { ok = false; console.log(`DATE DRIFT ${s.id} at ${now}:\n${out}`) }
      }
    } finally { (globalThis as any).Date = Real }
  }
  console.log(`date check (2020 / 2035): ${ok ? 'OK' : 'FAILED'}`)
}
