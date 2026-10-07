// Usage: npx vite-node fill.ts -- <recipe-file.ts>
// Replaces each `output: ''` in the file, in sample order, with the sample's actual output (JSON-quoted literal).
import { readFileSync, writeFileSync } from 'node:fs'
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const file = process.argv[process.argv.length - 1]
const recipe = (await import(file)).default
const steps = toPipelineSteps(recipe.steps)
let src = readFileSync(file, 'utf8')
for (const s of recipe.samples) {
  if (s.output !== '') continue
  const { out, errors } = await run(s.input, steps)
  if (Object.keys(errors).length) { console.log(`NOT FILLED ${s.id}: errors ${JSON.stringify(errors)}`); continue }
  const i = src.indexOf("output: '',")
  if (i < 0) throw new Error('no blank output left')
  src = src.slice(0, i) + `output: ${JSON.stringify(out)},` + src.slice(i + "output: '',".length)
  console.log(`filled ${s.id}`)
}
writeFileSync(file, src)
