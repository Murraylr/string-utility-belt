process.env.NO_PROTO = '1'
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('./env-secret')
const steps = toPipelineSteps(recipe.steps)
const cases: Record<string, string> = {
  crlf: 'A=1\r\nB="two words"\r\n',
  malformed: 'A=1\nthis line has no equals\nB=2\n',
  yamlKeys: 'NO=x\nY=1\non=2\nTRUE=3\n',
  empty: '',
  onlyComments: '# nothing\n\n',
  expandRef: 'HOST=db.example.com\nURL=postgres://${HOST}/app\n',
  dup: 'A=first\nA=second\n',
  unicode: 'GREETING=héllo wörld 👋\n',
  unterminated: 'A="open\nB=2\n',
  badKey: 'MY KEY=1\n',
  dotsKeys: 'app.config.json={"a":1}\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  console.log(`## ${k}`, JSON.stringify(r.errors)); console.log(r.out)
}
