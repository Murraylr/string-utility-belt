import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import jwt from './jwt-recipe'
// @ts-ignore
import { A, B } from './gen-jwt.mjs'
const r = await run(`Cookie: theme=dark; session=${A}; _ga=GA1.1.123\nGET /callback?code=abc&id_token=${B}&state=xyz HTTP/1.1\n`, toPipelineSteps(jwt.steps))
console.log(JSON.stringify(r.errors), '\n' + r.out.split('\n').filter(l => /"sub"/.test(l)).join('\n'))
