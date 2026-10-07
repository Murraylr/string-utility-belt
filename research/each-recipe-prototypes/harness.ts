/**
 * Prototype harness for draft recipes. Run from the repo root:
 *   npx vite-node <scratchpad>/proto/<your-file>.ts
 * where <your-file>.ts does:
 *   import { proto } from './harness'
 *   import { step, each, laneStep, branch } from '/home/user/string-utility-belt/src/recipes/define'
 *   await proto(recipe)            // a full Recipe object (samples' `output` may be '' at first)
 *
 * It runs the repo's own recipe checker (src/recipes/check.ts) with the engine the SEO build
 * uses, against every recipe already on main and every utility guide. Problems about the
 * guide prose are dropped (drafts have no guide.md yet). For each sample it prints the actual
 * output, so you can paste it in as the golden `output` once it is right.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { runPipeline } from '/home/user/string-utility-belt/src/core/runner'
import { formatForDisplay } from '/home/user/string-utility-belt/src/core/coerce'
import { staticRegistry, STATIC_UTILITIES } from '/home/user/string-utility-belt/src/utilities/static-registry'
import { MANIFEST } from '/home/user/string-utility-belt/src/utilities/_generated/manifest'
import { checkRecipe, checkRecipeSet, type RecipeCheckContext } from '/home/user/string-utility-belt/src/recipes/check'
import { STATIC_RECIPES } from '/home/user/string-utility-belt/src/recipes/_generated/static'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import type { PipelineStep, Value } from '/home/user/string-utility-belt/src/types/utility'

const ROOT = '/home/user/string-utility-belt'
const byId = new Map(STATIC_UTILITIES.map(u => [u.id, u]))
const metas = new Map(MANIFEST.map(m => [m.id, m]))

/** Run any steps on any input with the build's engine; returns the display string, step errors and the raw result. */
export async function run(input: Value, steps: PipelineStep[]) {
  const result = await runPipeline(input, steps, { load: staticRegistry.load, previews: false, env: 'node' })
  return { out: formatForDisplay(result.out), errors: result.err, result }
}

const GUIDE_PROBLEM = /guide|prose|words|description|title must|frontmatter|heading|link/i

export async function proto(recipe: Recipe): Promise<string[]> {
  const ctx: RecipeCheckContext = {
    utility: id => byId.get(id),
    meta: id => metas.get(id),
    run: (input, steps, previews) => runPipeline(input, steps, { load: staticRegistry.load, previews, env: 'node' }),
    recipeSlugs: new Set([...STATIC_RECIPES.map(r => r.slug), recipe.slug]),
  }
  const own = (await checkRecipe(recipe, recipe.slug, null, ctx)).filter(p => !GUIDE_PROBLEM.test(p) || /sample|expected|actual|step/i.test(p))
  const utilityGuides = MANIFEST.flatMap(m => {
    const file = path.join(ROOT, 'src', 'utilities', m.id, 'guide.md')
    return existsSync(file) ? [{ id: m.id, source: readFileSync(file, 'utf8') }] : []
  })
  const others = STATIC_RECIPES.filter(r => r.slug !== recipe.slug).map(r => ({
    recipe: r,
    guide: readFileSync(path.join(ROOT, 'src', 'recipes', r.slug, 'guide.md'), 'utf8'),
  }))
  const set = checkRecipeSet([...others, { recipe, guide: null }], utilityGuides)
    .filter(p => p.includes(`recipe:${recipe.slug}`))
  const problems = [...own, ...set]

  console.log(`\n=== ${recipe.slug}  (${problems.length ? `${problems.length} problem(s)` : 'checker: OK'})`)
  for (const p of problems) console.log(`  - ${p}`)
  const steps = toPipelineSteps(recipe.steps)
  for (const s of recipe.samples) {
    const { out, errors } = await run(s.input, steps)
    console.log(`--- sample ${s.id}${Object.keys(errors).length ? `  STEP ERRORS: ${JSON.stringify(errors)}` : ''}`)
    console.log(out)
  }
  return problems
}
