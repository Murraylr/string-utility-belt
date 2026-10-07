import { runPipeline } from '/home/user/string-utility-belt/src/core/runner'
import { staticRegistry } from '/home/user/string-utility-belt/src/utilities/static-registry'
import { traceRecipe } from '/home/user/string-utility-belt/src/recipes/trace'
import { recipe as a } from '/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/verified/strip-tracking'
import { recipe as b } from '/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/bulk-slugs'
import { recipe as c } from '/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/line-lengths'
const run = (input: any, steps: any, previews: boolean) => runPipeline(input, steps, { load: staticRegistry.load, previews, env: 'node' })
for (const recipe of [a, b, c]) {
  const t: any = await traceRecipe(recipe, run)
  console.log('\n### TRACE', recipe.slug, 'keys', Object.keys(t))
  for (const s of t.steps ?? []) console.log('  step', s.id, JSON.stringify(s).slice(0, 300))
  for (const s of t.skips ?? []) console.log('  skip', JSON.stringify(s).slice(0, 400))
}
