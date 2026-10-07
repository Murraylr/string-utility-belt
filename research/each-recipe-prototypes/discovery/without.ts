// prints, for each top-level step of a recipe, the first sample's output without that step
import { run } from '../harness'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
export async function withoutEach(recipe: Recipe) {
  const steps = toPipelineSteps(recipe.steps)
  for (const [i, s] of steps.entries()) {
    for (const sample of recipe.samples) {
      const less = steps.filter((_, j) => j !== i)
      const r = await run(sample.input, less)
      const changed = r.out !== sample.output || Object.keys(r.errors).length > 0
      console.log(`without ${s.id} on ${sample.id}: ${changed ? 'CHANGED' : 'same'} ${Object.keys(r.errors).length ? 'ERR ' + JSON.stringify(r.errors) : ''}`)
      if (changed && !Object.keys(r.errors).length) console.log('   ' + JSON.stringify(r.out).slice(0, 400))
    }
  }
}
