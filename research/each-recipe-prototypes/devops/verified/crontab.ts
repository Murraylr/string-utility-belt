/**
 * Reviewed copy of ../crontab.ts. One change: a schedule cron_describe cannot read
 * (61 * * * *, @every 5m, a 6-field Quartz line…) used to get a comment that just
 * repeated its raw fields ("# 61 * * * *"), which reads like a description. Now the
 * describe step empties on error and the comment says the schedule could not be read.
 * Samples and golden outputs are unchanged.
 */
process.env.NO_PROTO = '1'
import { proto, run } from '../../harness'
import { laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe: base } = await import('../crontab')

const clone = JSON.parse(JSON.stringify(base)) as Recipe
const branchStep = (clone.steps[0] as any).steps[0]
const lane = branchStep.branches[0]
lane[1].onError = 'empty' // cron_describe
lane.push(laneStep('unreadable', 'replace', { pattern: '^# $', replacement: '# (not a valid cron schedule: check this line)', regex: true, flags: '' }, { label: 'flag an unreadable schedule' }))
export const recipe = clone

if (!process.env.NO_PROTO_VERIFIED) {
  await proto(recipe)
  const steps = toPipelineSteps(recipe.steps)
  for (const v of ['61 * * * * x\n@every 5m y\n0 2 * * * ok\n', '0 30 2 * * * quartz-six-fields\n']) {
    const r = await run(v, steps)
    console.log('## edge', JSON.stringify(r.errors)); console.log(r.out)
  }
}
