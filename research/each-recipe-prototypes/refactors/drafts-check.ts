import { proto, run } from '../harness'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import UTM_MAIN from '/home/user/string-utility-belt/src/recipes/bulk-utm-link-builder/recipe'
import XL_MAIN from '/home/user/string-utility-belt/src/recipes/excel-column-to-sql-in-clause/recipe'
import UTM from './bulk-utm-link-builder.recipe'
import XL from './excel-column-to-sql-in-clause.recipe'

for (const [draft, main] of [[UTM, UTM_MAIN], [XL, XL_MAIN]] as Array<[Recipe, Recipe]>) {
  const problems = await proto(draft)
  for (const s of draft.samples) {
    const shipped = main.samples.find(o => o.id === s.id)!
    console.log(`${s.id}: golden ${s.output === shipped.output && s.input === shipped.input ? 'UNCHANGED (input+output)' : 'CHANGED'}`)
  }
  console.log('top-level steps: main', main.steps.length, '-> draft', draft.steps.length, '| problems:', problems)
}
