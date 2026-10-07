import { proto } from '../harness'
import { recipe } from './zip-def'
import { withoutEach } from './without'
await proto(recipe)
await withoutEach(recipe)
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
for (const input of ['2134\r\n501\r\n', ' 2134\n2134 \n', '２１３４\n', 'Boston\t2134\n', '12\n123456\n0\n', 'K1A 0B6\nSW1A 1AA\n', '2134', '']) {
  const r = await run(input, steps)
  console.log(JSON.stringify(input), '->', JSON.stringify(r.out), JSON.stringify(r.errors))
}
