import { run } from '../../harness'
import { recipe } from '../zip-def'
import { step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const sedScript = 's/^([0-9]{4})$/0\\1/\ns/^([0-9]{3})$/00\\1/\ns/^([0-9]{8})$/0\\1/\ns/^([0-9]{7})$/00\\1/'
const alt = toPipelineSteps([step('sed', 'sed', { script: sedScript }, 'one sed step, every line')])
const mine = toPipelineSteps(recipe.steps)
const extra = ['Zip\r\n2134\r\n501\r\n', 'Name,City,Zip\nAda,Boston,2134\nBo,Newark,7102\n', 'Name\tZip\nAda\t2134\n', '2134.0\n501.0\n', '2,134\n', "'2134\n", '"2134"\n']
for (const s of [...recipe.samples.map(s => s.input), ...extra]) {
  const a = await run(s, alt); const b = await run(s, mine)
  console.log(JSON.stringify(s).slice(0, 60).padEnd(62), a.out === b.out ? 'SAME' : 'DIFF', JSON.stringify(a.out).slice(0, 70), Object.keys(a.errors).length ? JSON.stringify(a.errors) : '', '| each:', JSON.stringify(b.out).slice(0, 60))
}
