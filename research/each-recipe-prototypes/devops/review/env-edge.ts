process.env.NO_PROTO = '1'
import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('../env-secret')
const steps = toPipelineSteps(recipe.steps)
const big = 'X'.repeat(200000)
const cases: Record<string, string> = {
  hashNoSpace: 'DB_PASS=abc#123\n',
  spacesAroundEq: 'KEY = value with spaces   \n',
  whitespaceOnly: 'A="  "\n',
  bom: '﻿NODE_ENV=production\nB=1\n',
  quotedThenComment: 'A="x" # trailing\n',
  jsonValue: 'CFG={"a":1,"b":[1,2]}\n',
  numberish: 'A=0x1F\nB=1e3\nC=true\nD=null\n',
  colonKey: 'MY:KEY=1\n',
  htmlEscaped: 'URL=https://example.com/?a=1&amp;b=2\n',
  composeYaml: 'services:\n  web:\n    image: x\n',
  dollarSingle: "P='a$b'\nQ=\"c\\$d\"\nR=e$f\n",
  bigValue: 'BIG=' + big + '\n',
  keyNamedProto: '__proto__=x\nconstructor=y\n',
  numericKey: '123=abc\n',
  onlyExport: 'export\n',
  tabIndent: '\tA=1\n  B=2\n',
  emptyQuoted: 'A=""\nB=\'\'\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  const o = r.out.length > 600 ? r.out.slice(0, 300) + ' …[' + r.out.length + ']' : r.out
  console.log(`## ${k}`, JSON.stringify(r.errors)); console.log(o)
}
