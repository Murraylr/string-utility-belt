import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import MAIN from '/home/user/string-utility-belt/src/recipes/excel-column-to-sql-in-clause/recipe'
import XL from '../excel-column-to-sql-in-clause.recipe'
const withFlavor = (flavor: string, wrap = true) => toPipelineSteps(XL.steps).map((s: any) => s.id === 'quote' ? { ...s, steps: s.steps.map((l: any) => ({ ...l, params: { ...l.params, flavor, wrap } })) } : s)
const mainFlavor = (flavor: string) => toPipelineSteps(MAIN.steps).map((s: any) => s.id === 'escape' ? { ...s, params: { ...s.params, flavor } } : s)
const inputs: Record<string, string> = {
  crlf_backslash: "O'Brien\r\nC:\\Temp\\\r\nMüller\r\nsay \"hi\"\r\n\r\n",
  header: "email\r\nana@example.com\r\nbo@example.com\r\n",
  numbers: '1001\n1002\n1002\n 1003\n',
  excel_multiline_cell: '"Acme\nCorp"\nGlobex\n',
  nbsp_tabs: ' Zoë \n\tZoë\n',
  long: Array.from({ length: 5000 }, (_, i) => `SKU-${i % 4000}`).join('\r\n'),
}
for (const [name, input] of Object.entries(inputs)) {
  console.log(`\n## ${name}`)
  for (const f of ['ansi', 'mysql', 'mssql']) {
    const d = await run(input, withFlavor(f)), m = await run(input, mainFlavor(f))
    const cut = (s: string) => JSON.stringify(s.length > 200 ? s.slice(0, 200) + '…' : s)
    console.log(`  ${f.padEnd(6)} draft ${cut(d.out)} ${Object.keys(d.errors).length ? JSON.stringify(d.errors) : ''}`)
    console.log(`  ${f.padEnd(6)} main  ${cut(m.out)} ${Object.keys(m.errors).length ? JSON.stringify(m.errors) : ''}`)
  }
  const nw = await run(input, withFlavor('ansi', false))
  console.log('  ansi no-wrap', JSON.stringify(nw.out.slice(0, 200)))
}
