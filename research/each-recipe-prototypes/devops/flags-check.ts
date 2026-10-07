process.env.NO_PROTO = '1'
import { sanitizeSteps } from '/home/user/string-utility-belt/src/core/serialize'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('./crontab')
const steps = JSON.parse(JSON.stringify(toPipelineSteps(recipe.steps)))
delete steps[0].steps[0].condition.flags
const s = sanitizeSteps(steps) as any
console.log('after sanitize, nested condition:', JSON.stringify(s[0].steps[0].condition))
