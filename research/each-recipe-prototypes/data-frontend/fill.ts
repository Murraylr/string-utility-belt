// Usage: npx vite-node fill.ts <draft.ts>  — replaces each `output: ''` (in sample order) with the actual output.
import { readFileSync, writeFileSync } from 'node:fs'
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const file = process.argv[2]
const mod = await import(file)
const recipe = mod.recipe
const steps = toPipelineSteps(recipe.steps)
let src = readFileSync(file, 'utf8')
const lit = (s: string) => /[`\\\r ​]|\$\{/.test(s) ? JSON.stringify(s) : '`' + s + '`'
for (const s of recipe.samples) {
  if (s.output !== '') continue
  const { out, errors } = await run(s.input, steps)
  if (Object.keys(errors).length) throw new Error(`${s.id}: ${JSON.stringify(errors)}`)
  const i = src.indexOf("output: ''")
  if (i < 0) throw new Error('no placeholder left')
  src = src.slice(0, i) + 'output: ' + lit(out) + src.slice(i + "output: ''".length)
}
writeFileSync(file, src)
console.log('filled', file)
