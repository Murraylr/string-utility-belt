import { proto, run } from '../harness'
import { recipe } from './cidr-def'
import { withoutEach } from './without'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
await proto(recipe)
await withoutEach(recipe)
const steps = toPipelineSteps(recipe.steps)
for (const input of ['192.0.2.300/24\n198.51.100.0/24\n', '10.0.0.0/33\n', ' 192.0.2.0/24 \n', '192.0.2.0/24, 198.51.100.0/24\n', '192.0.2.0 - 192.0.2.255\n', '']) {
  const r = await run(input, steps)
  console.log(JSON.stringify(input), '->', JSON.stringify(r.out), JSON.stringify(r.errors))
}
