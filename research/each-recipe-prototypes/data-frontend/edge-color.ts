import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from './check-palette-contrast'
const steps = toPipelineSteps(recipe.steps)
for (const i of ['--color-primary: #2b6cb0;\nblue-500: oklch(0.6 0.16 250)\nred: #c53030\n\n#abc\r\nnot-a-color\n#c53030 #ffffff\n']) {
  const r = await run(i, steps); console.log(JSON.stringify(r.out)); console.log(r.out, r.errors)
}
