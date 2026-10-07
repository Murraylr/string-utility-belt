import { proto, run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import C from './decode-cloudwatch-logs-data.variant-c.recipe'
import DRAFT from '../decode-cloudwatch-logs-data.recipe'
const problems = await proto(C)
for (const s of C.samples) console.log(s.id, (await run(s.input, toPipelineSteps(C.steps))).out === s.output ? 'golden OK' : 'golden DIFFERS')
console.log(problems)
