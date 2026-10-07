/** Entry point for `npm run gen` — see gen-utilities.ts, then gen-recipes.ts (which reads the utility manifest). */
import { generate as generateUtilities } from './gen-utilities'

async function main() {
  const utilities = await generateUtilities()
  console.log(`[gen] ${utilities.count} utilities; ${utilities.written.length ? 'updated ' + utilities.written.join(', ') : 'up to date'}`)
  // imported after the utility manifest is written: the recipe generator reads it at import time
  const { generate: generateRecipes } = await import('./gen-recipes')
  const recipes = await generateRecipes()
  console.log(`[gen] ${recipes.count} recipes; ${recipes.written.length ? 'updated ' + recipes.written.join(', ') : 'up to date'}`)
}

main().catch(e => { console.error(`[gen] ${e?.message ?? e}`); process.exit(1) })
