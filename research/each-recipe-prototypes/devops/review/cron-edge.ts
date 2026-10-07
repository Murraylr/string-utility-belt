process.env.NO_PROTO = '1'
import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('../crontab')
const steps = toPipelineSteps(recipe.steps)
const stopSteps = JSON.parse(JSON.stringify(steps))
stopSteps[0].steps[0].branches[0][1].onError = 'stop'
const cases: Record<string, string> = {
  commentedJob: '#0 2 * * * /opt/x\n# 0 3 * * * /opt/y\n',
  every: '@every 5m /opt/x\n',
  quartz: '0 0 12 * * ? /opt/x\n',
  sixField: '0 30 2 * * * job\n',
  rerun: '# At 02:00\n0 2 * * * a\n',
  invalid: '61 * * * * x\n0 25 * * * y\n0 0 * * 8 z\n',
  names: '0 9 * * Mon-Fri a\n0 0 1 JAN * b\n',
  trailingWs: '*/5 * * * *   \n',
  noCommand: '0 2 * * *\n',
  questionDom: '0 0 L * * x\n',
  k8sStyle: 'schedule: "*/5 * * * *"\n',
  numericVar: '5MIN=1\n',
  htmlEsc: '0 2 * * * cd /x &amp;&amp; ./run\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  console.log(`## ${k}`, JSON.stringify(r.errors)); console.log(r.out)
  if (k === 'invalid' || k === 'every') { const s = await run(v, stopSteps); console.log(`## ${k} [describe onError stop]`, JSON.stringify(s.errors)); console.log(s.out) }
}
