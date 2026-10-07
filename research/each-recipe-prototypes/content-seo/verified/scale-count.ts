import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/line-lengths.ts')
const steps = toPipelineSteps(recipe.steps)
const big = Array.from({ length: 50000 }, (_, i) => `Title number ${i} – Example Outdoor Co. 🎒`).join('\n')
const t0 = performance.now(); const r = await run(big, steps)
console.log('SCALE 50000', Math.round(performance.now() - t0), 'ms', JSON.stringify(r.errors), r.out.split('\n').slice(-1)[0])
