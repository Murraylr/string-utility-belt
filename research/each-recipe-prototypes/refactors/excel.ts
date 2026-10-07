import { proto, run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/excel-column-to-sql-in-clause/recipe'

const [trim, dedupe, , , wrap] = ORIGINAL.steps

/** main, with only the flavor switched, as the "why" invites MySQL users to consider */
const withFlavor = (flavor: string) => toPipelineSteps(ORIGINAL.steps.map(s =>
  s.id === 'escape' ? { ...s, params: { ...(s as any).params, flavor } } as any : s))

const E: Recipe = {
  ...ORIGINAL,
  updated: '2026-10-08',
  steps: [
    trim, dedupe,
    each('quote', { mode: 'lines' }, [laneStep('escape', 'sql_escape', { flavor: 'ansi', wrap: true })],
      "Turns each value into a SQL string literal on its own: doubles every apostrophe, so O'Connor stays one value, and wraps it in single quotes. Switch the flavor to mysql for MySQL and MariaDB backslash escapes, or mssql for an N prefix on non-ASCII names.",
      { label: 'quote each value' }),
    step('join', 'line_affix', { prefix: '', suffix: '', skipBlank: true, joinWith: ', ' },
      'Joins the quoted values with commas onto one line, skipping the blank cells between rows.',
      { label: 'join with commas' }),
    wrap,
  ],
}

await proto(E)
for (const s of ORIGINAL.samples) {
  const r = await run(s.input, toPipelineSteps(E.steps))
  console.log(s.id, r.out === s.output ? 'SAME as main' : 'DIFFERENT')
}

const names = "O'Brien\nMüller\nD'Angelo\nC:\\Users\\shared\n"
for (const flavor of ['mysql', 'mssql']) {
  console.log(`\n--- flavor ${flavor}`)
  console.log('main, flavor switched:', (await run(names, withFlavor(flavor))).out)
  const each = toPipelineSteps(E.steps.map(s => s.id === 'quote'
    ? { ...s, steps: [laneStep('escape', 'sql_escape', { flavor, wrap: true })] } as any : s))
  console.log('each, flavor switched:', (await run(names, each)).out)
}
