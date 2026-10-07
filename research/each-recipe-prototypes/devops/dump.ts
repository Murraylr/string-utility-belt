// usage: vite-node dump.ts <module.ts> <outdir> — writes each sample's actual output to <outdir>/<id>.out
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { writeFileSync, mkdirSync } from 'node:fs'
const [mod, outdir] = process.argv.slice(2)
process.env.NO_PROTO = '1'
const { recipe } = await import(mod)
mkdirSync(outdir, { recursive: true })
for (const s of recipe.samples) {
  const { out } = await run(s.input, toPipelineSteps(recipe.steps))
  writeFileSync(`${outdir}/${s.id}.out`, out)
  writeFileSync(`${outdir}/${s.id}.in`, s.input)
}
