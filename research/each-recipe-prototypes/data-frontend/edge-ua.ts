import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from './parse-user-agent-list-to-csv'
const r0 = await run(recipe.samples[0].input, [{ id: 'u', utilityId: 'user_agent_parse', enabled: true, params: {} } as any])
console.log('whole paste as one UA:', r0.out)
const steps = toPipelineSteps(recipe.steps)
for (const i of ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36\r\n"quoted, with comma"\r\nnot a user agent\r\n', '']) {
  const r = await run(i, steps); console.log(JSON.stringify(r.out), r.errors)
}
