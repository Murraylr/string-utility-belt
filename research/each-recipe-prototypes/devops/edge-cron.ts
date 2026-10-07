process.env.NO_PROTO = '1'
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('./crontab')
const steps = toPipelineSteps(recipe.steps)
const cases: Record<string, string> = {
  crlf: '0 2 * * * a\r\n# c\r\n',
  invalid: '61 * * * * x\n* * * * y\n@bogus z\n0 0 * * *\n',
  indented: '   0 1 * * * a\n\t# tabbed comment\n   \n',
  macrosCase: '@Daily a\n@YEARLY b\n@annually c\n@midnight d\n',
  sixFieldSeconds: '0 0 2 * * * job-with-seconds\n',
  dash: '-*/5 * * * * quiet\n',
  percent: '0 1 * * * date +\\%F > /tmp/d\n',
  unicode: '0 1 * * * echo "café ☕"\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  console.log(`## ${k}`, JSON.stringify(r.errors), JSON.stringify(r.result.items)); console.log(JSON.stringify(r.out))
}
