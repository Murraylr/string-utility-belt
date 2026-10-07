// fill a draft's empty golden outputs with the actual run, in place (scratchpad copies only)
import { readFileSync, writeFileSync } from 'node:fs'
import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const file = process.argv[2]
const { recipe } = await import(file)
let src = readFileSync(file, 'utf8')
for (const s of recipe.samples) {
  if (s.output !== '') continue
  const { out } = await run(s.input, toPipelineSteps(recipe.steps))
  const re = new RegExp(`(id: '${s.id}'[^\\n]*?)output: ''`)
  if (!re.test(src)) throw new Error('no slot for ' + s.id)
  src = src.replace(re, `$1output: ${JSON.stringify(String(out)).replace(/\$/g, '$$$$')}`)
}
writeFileSync(file, src)
console.log('filled', file)
