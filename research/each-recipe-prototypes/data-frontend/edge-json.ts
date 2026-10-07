import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from './list-to-json-array'
const steps = toPipelineSteps(recipe.steps)
for (const i of ['', '101\n102\n007\n', '   \n\t\n', 'a b\nemoji 🎉\n']) {
  const r = await run(i, steps); console.log(JSON.stringify(i), '=>', JSON.stringify(r.out), JSON.stringify(r.errors))
}
