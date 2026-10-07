import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import MAIN from '/home/user/string-utility-belt/src/recipes/excel-column-to-sql-in-clause/recipe'
import XL from './excel-column-to-sql-in-clause.recipe'
const A = toPipelineSteps(MAIN.steps), B = toPipelineSteps(XL.steps)
const parts = ["O'Brien", 'Zoë', '  padded ', '\t', '', ' ', 'C:\\temp', "''", 'a\tb', '😀', 'x\u00A0', 'dup', 'dup', '\r']
let seed = 7; const rnd = (n: number) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n }
let same = 0, diff = 0
for (let t = 0; t < 400; t++) {
  const lines = Array.from({ length: 1 + rnd(8) }, () => parts[rnd(parts.length)] + (rnd(3) ? '' : parts[rnd(parts.length)]))
  const eol = rnd(2) ? '\r\n' : '\n'
  const input = lines.join(eol) + (rnd(2) ? eol : '')
  const a = await run(input, A), b = await run(input, B)
  if (a.out === b.out && JSON.stringify(a.errors) === JSON.stringify(b.errors)) same++
  else { diff++; if (diff < 5) console.log('DIFF', JSON.stringify(input), '\n main ', JSON.stringify(a.out), '\n draft', JSON.stringify(b.out)) }
}
console.log({ same, diff })
console.log('empty input:', JSON.stringify((await run('', B)).out), JSON.stringify((await run('', A)).out))
