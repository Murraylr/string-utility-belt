/**
 * Checks recipes (`src/recipes/<slug>/`) against the rules in
 * `src/recipes/check.ts` — the same checks `recipes.test.ts` runs, with the
 * engine the SEO build uses (the static registry, in Node):
 *
 *   npm run check:recipes -- decode-saml-request     (no slugs: every recipe, plus the cross-recipe rules)
 *
 * Reads each `recipe.ts` directly, so it works before `npm run gen`. A sample
 * whose output differs prints the actual output next to the expected one.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { runPipeline } from '../src/core/runner'
import { staticRegistry, STATIC_UTILITIES } from '../src/utilities/static-registry'
import { MANIFEST } from '../src/utilities/_generated/manifest'
import { checkRecipe, checkRecipeSet, type RecipeCheckContext } from '../src/recipes/check'
import type { Recipe } from '../src/recipes/types'
import { discoverRecipes, loadRecipe, readRecipeGuide } from './gen-recipes'

async function main() {
  const asked = process.argv.slice(2).filter(a => a !== '--')
  const all = discoverRecipes()
  const unknown = asked.filter(slug => !all.includes(slug))
  if (unknown.length) {
    console.error(`[check-recipes] no recipe folder for: ${unknown.join(', ')} (expected src/recipes/<slug>/recipe.ts)`)
    process.exit(2)
  }
  const targets = asked.length ? asked : all
  const byId = new Map(STATIC_UTILITIES.map(u => [u.id, u]))
  const metas = new Map(MANIFEST.map(m => [m.id, m]))
  const ctx: RecipeCheckContext = {
    utility: id => byId.get(id),
    meta: id => metas.get(id),
    run: (input, steps, previews) => runPipeline(input, steps, { load: staticRegistry.load, previews, env: 'node' }),
    recipeSlugs: new Set(all),
  }

  let failed = 0
  const loaded: Array<{ recipe: Recipe; guide: string | null }> = []
  for (const slug of targets) {
    const recipe = await loadRecipe(slug)
    const guide = readRecipeGuide(slug)
    const problems = recipe ? await checkRecipe(recipe, slug, guide, ctx) : ['recipe.ts has no default export']
    if (recipe) loaded.push({ recipe, guide })
    if (problems.length === 0) console.log(`✓ ${slug}`)
    else { failed++; console.log(`✗ ${slug}\n${problems.map(p => `  - ${p}`).join('\n')}`) }
  }

  if (!asked.length) {
    const utilityGuides = MANIFEST.flatMap(m => {
      const file = path.join(process.cwd(), 'src', 'utilities', m.id, 'guide.md')
      return existsSync(file) ? [{ id: m.id, source: readFileSync(file, 'utf8') }] : []
    })
    const problems = checkRecipeSet(loaded, utilityGuides)
    if (problems.length) { failed++; console.log(`✗ across recipes\n${problems.map(p => `  - ${p}`).join('\n')}`) }
    else console.log('✓ across recipes')
  }
  console.log(`\n${targets.length - Math.min(failed, targets.length)}/${targets.length} recipes pass`)
  if (failed) process.exit(1)
}

main().catch(e => {
  console.error(`[check-recipes] ${e?.stack ?? e}`)
  process.exit(1)
})
