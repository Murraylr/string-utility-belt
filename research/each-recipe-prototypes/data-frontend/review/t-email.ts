import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from '../hash-email-list-for-customer-match'
import { createHash } from 'node:crypto'
const S = toPipelineSteps(recipe.steps)
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const cases: Record<string, string> = {
  crlf: 'A.B@gmail.com\r\nc@example.com\r\n',
  quotedCsv: '"jane.doe@example.com"\n"x.y@gmail.com"\n',
  header: 'Email\njane@example.com\n',
  csvRow: 'jane@example.com,Jane,Doe,US,94043\n',
  nameAddr: 'Jane Doe <jane.doe@gmail.com>\n',
  commaList: 'a@example.com, b@example.com; c@example.com\n',
  zwsp: 'jane​@example.com\n',
  bom: '﻿jane@example.com\n',
  mailto: 'mailto:jane@example.com\n',
  alreadyHashed: '86e0b9e56c17cc4d12387e1949b85053fbe73bc3ce5a1188713a9d300cc6133d\n',
  plus: 'Jane.Doe+promo@gmail.com\n',
  upperGmail: 'JANE.DOE@GMAIL.COM\n',
  trailingDot: 'jane@example.com.\n',
  noNewline: 'jane@example.com',
  wsOnly: '   \n\t\njane@example.com\n',
  html: 'jane&#64;example.com\n',
  fullwidth: 'ｊａｎｅ@example.com\n',
  turkishI: 'İLKER@EXAMPLE.COM\n',
  tabbed: 'jane@example.com\tJane\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, S)
  console.log(`--- ${k}: ${JSON.stringify(v)}`)
  console.log(JSON.stringify(r.out), Object.keys(r.errors).length ? r.errors : '')
}
console.log('sha of jane@example.com', sha('jane@example.com'))
console.log('sha of abdd@gmail.com', sha('ab@gmail.com'))
console.log('sha of janedoe+promo@gmail.com', sha('janedoe+promo@gmail.com'), 'janedoe@gmail.com', sha('janedoe@gmail.com'))
console.log('sha of "jane.doe@example.com"', sha('"jane.doe@example.com"'))
// 5000-line list performance
const big = Array.from({ length: 5000 }, (_, i) => `user.${i}@example.com`).join('\n') + '\n'
const t0 = Date.now(); const rb = await run(big, S); console.log('5000 lines ms', Date.now() - t0, rb.out.toString().split('\n').length)
const big2 = Array.from({ length: 100001 }, (_, i) => `u${i}@example.com`).join('\n')
const rb2 = await run(big2, S); console.log('100001 lines errors', rb2.errors)
