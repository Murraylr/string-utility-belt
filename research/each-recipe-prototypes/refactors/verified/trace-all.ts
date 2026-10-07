import { runPipeline } from '/home/user/string-utility-belt/src/core/runner'
import { staticRegistry } from '/home/user/string-utility-belt/src/utilities/static-registry'
import { traceRecipe } from '/home/user/string-utility-belt/src/recipes/trace'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
const runner = (input: any, steps: any, previews: boolean) => runPipeline(input, steps, { load: staticRegistry.load, previews, env: 'node' })
const which = process.env.WHICH ?? 'cw'
const mods: Record<string, () => Promise<{ default: Recipe }>> = {
  cw: () => import('../decode-cloudwatch-logs-data.recipe'),
  cwc: () => import('./decode-cloudwatch-logs-data.variant-c.recipe'),
  cwmain: () => import('/home/user/string-utility-belt/src/recipes/decode-cloudwatch-logs-data/recipe'),
  xl: () => import('../excel-column-to-sql-in-clause.recipe'),
  utm: () => import('../bulk-utm-link-builder.recipe'),
  utmmain: () => import('/home/user/string-utility-belt/src/recipes/bulk-utm-link-builder/recipe'),
}
const r = (await mods[which]()).default
for (const sample of r.samples) {
  const t = await traceRecipe(r, runner, sample)
  console.log(`\n===== ${r.slug} / ${sample.id}`)
  for (const s of t.steps) console.log(`  STEP ${s.id}${s.skipped ? ' (skipped)' : ''}${s.error ? ' ERROR ' + s.error : ''}\n    ${JSON.stringify(s.output?.text ?? '').slice(0, 300)}`)
  for (const s of t.skip) console.log(`  SKIP ${s.id}: ${s.unchanged ? 'UNCHANGED' : s.error ? 'error at ' + s.error.stepId + ': ' + s.error.message.slice(0, 160) : JSON.stringify(s.output?.text).slice(0, 200)}`)
}
