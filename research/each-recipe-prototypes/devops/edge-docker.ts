process.env.NO_PROTO = '1'
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('./docker-auth')
const r = await run('{"auths":{"https://index.docker.io/v1/":{}},"credsStore":"desktop"}', toPipelineSteps(recipe.steps))
console.log(JSON.stringify(r.errors), r.out)
