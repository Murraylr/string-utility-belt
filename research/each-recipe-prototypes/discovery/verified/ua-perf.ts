import { run } from '../../harness'
import { recipe } from './ua-def'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
const base = recipe.samples[0].input.trimEnd().split('\n')
for (const n of [20000, 100001]) {
  const lines = Array.from({ length: n }, (_, i) => base[i % base.length])
  const t = Date.now()
  const r = await run(lines.join('\n') + '\n', steps)
  console.log(n, 'lines', Date.now() - t, 'ms', 'rows', r.out.split('\n').length - 1, JSON.stringify(r.errors).slice(0, 200))
}
