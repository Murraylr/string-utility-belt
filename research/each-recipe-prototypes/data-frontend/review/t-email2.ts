import { proto, run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from '../verified/hash-email-list-for-customer-match'
import { createHash } from 'node:crypto'
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
await proto(recipe)
console.log('expect', ['jane.doe@example.com','jsmith84@gmail.com','alexrivera@googlemail.com','support.team@example.org','john_smith@gmail.com','pat.lee@example.net'].map(s => s + ' ' + sha(s)).join('\n'))
const S = toPipelineSteps(recipe.steps)
for (const v of ['Jane Doe <jane.doe@gmail.com>\n', 'a@example.com, b@example.com\n', 'jane​@example.com\n', '86e0b9e56c17cc4d12387e1949b85053fbe73bc3ce5a1188713a9d300cc6133d\n', "o'brien@example.com\n"]) {
  console.log(JSON.stringify(v), '->', JSON.stringify((await run(v, S)).out))
}
