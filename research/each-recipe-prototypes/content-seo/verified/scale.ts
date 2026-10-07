import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/verified/strip-tracking.ts')
const steps = toPipelineSteps(recipe.steps)
for (const n of [20000, 100001]) {
  const big = Array.from({ length: n }, (_, i) => `https://shop.example.com/p/${i}?id=${i}&utm_source=x&gclid=abc${i}`).join('\n')
  const t0 = performance.now(); const r = await run(big, steps)
  console.log('SCALE', n, Math.round(performance.now() - t0), 'ms', JSON.stringify(r.errors).slice(0, 300), r.out.slice(0, 80))
}
