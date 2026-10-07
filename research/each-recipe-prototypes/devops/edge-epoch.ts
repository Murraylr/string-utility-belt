process.env.NO_PROTO = '1'
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('./epoch')
const steps = toPipelineSteps(recipe.steps)
const cases: Record<string, string> = {
  crlf: '1791446400.104 a\r\n1791446401 b\r\n',
  tabs: '1791446400.104\tCHhAv\t192.0.2.1\n',
  falsePositive: 'order 1234567890 shipped\n',
  nanos: '1791446400123456789 docker-event\n',
  bracketed: '[1791446400] started\n',
  doubleSpaces: '  1791446400   x  \n',
  oldDate: '978307200 y2k1\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  console.log('## ' + k, JSON.stringify(r.errors)); console.log(JSON.stringify(r.out))
}
