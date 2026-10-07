import { readFileSync, writeFileSync } from 'node:fs'
import { run } from '../../harness'
import recipe from './kinesis-recipe'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const s = recipe.samples.find(x => x.id === 'python-print')!
const { out, errors } = await run(s.input, toPipelineSteps(recipe.steps))
if (Object.keys(errors).length) throw new Error(JSON.stringify(errors))
const file = new URL('./kinesis-recipe.ts', import.meta.url).pathname
const src = readFileSync(file, 'utf8')
const marker = ", output: '' },"
if (src.split(marker).length !== 2) throw new Error('marker count')
writeFileSync(file, src.replace(marker, `, output: ${JSON.stringify(out)} },`))
console.log(out)
