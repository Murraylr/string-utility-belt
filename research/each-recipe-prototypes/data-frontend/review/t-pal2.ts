import { proto, run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from '../verified/check-palette-contrast'
await proto(recipe)
const S = toPipelineSteps(recipe.steps)
for (const v of ["  green: '#2f855a',\n", '"gold": "#ecc94b",\n', 'Neutral/Black #111111\n', '$white: #fff !default;\n', 'red: blue\n']) {
  const r = await run(v, S); console.log(r.out)
}
