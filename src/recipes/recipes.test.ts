/**
 * Every shipped recipe (`src/recipes/<slug>/`) passes the rules in `check.ts`, run
 * with the engine the SEO build uses (the static registry in Node mode): the
 * build pre-renders each recipe's worked example from these same runs.
 *
 * Check a few recipes quickly:  npm run check:recipes -- excel-column-to-sql-in-clause
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { runPipeline } from '../core/runner'
import { formatForDisplay } from '../core/coerce'
import { staticRegistry, STATIC_UTILITIES } from '../utilities/static-registry'
import { MANIFEST } from '../utilities/_generated/manifest'
import { STATIC_RECIPES } from './_generated/static'
import { checkRecipe, checkRecipeSet, type RecipeCheckContext } from './check'
import { toPipelineSteps } from './types'

const DIR = path.join(process.cwd(), 'src', 'recipes')
const readGuide = (slug: string): string | null => {
  const file = path.join(DIR, slug, 'guide.md')
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}
const byId = new Map(STATIC_UTILITIES.map(u => [u.id, u]))
const metas = new Map(MANIFEST.map(m => [m.id, m]))
const ctx: RecipeCheckContext = {
  utility: id => byId.get(id),
  meta: id => metas.get(id),
  run: (input, steps, previews) => runPipeline(input, steps, { load: staticRegistry.load, previews, env: 'node' }),
  recipeSlugs: new Set(STATIC_RECIPES.map(r => r.slug)),
}

describe('recipes', () => {
  afterEach(() => { vi.useRealTimers() })

  it('ships every recipe folder (run `npm run gen` after adding one)', () => {
    const folders = readdirSync(DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_') && existsSync(path.join(DIR, d.name, 'recipe.ts')))
      .map(d => d.name).sort()
    expect(STATIC_RECIPES.map(r => r.slug).sort()).toEqual(folders)
  })

  for (const recipe of STATIC_RECIPES) {
    it(`${recipe.slug} passes every recipe rule`, async () => {
      expect(await checkRecipe(recipe, recipe.slug, readGuide(recipe.slug), ctx)).toEqual([])
    }, 30000)

    it(`${recipe.slug} gives the same output whatever the date`, async () => {
      // a worked example that drifts with the clock ("2 years ago") would fail the build months later
      vi.useFakeTimers({ toFake: ['Date'] })
      const steps = toPipelineSteps(recipe.steps)
      for (const now of ['2020-01-01T00:00:00Z', '2035-06-15T12:00:00Z']) {
        vi.setSystemTime(new Date(now))
        for (const sample of recipe.samples) {
          const result = await runPipeline(sample.input, steps, { load: staticRegistry.load, env: 'node' })
          expect(formatForDisplay(result.out), `${sample.id} at ${now}`).toBe(sample.output)
        }
      }
    })
  }

  it('pass the rules across recipes and utility guides (unique titles and queries, no near-copied prose)', () => {
    const utilityGuides = MANIFEST.flatMap(m => {
      const file = path.join(process.cwd(), 'src', 'utilities', m.id, 'guide.md')
      return existsSync(file) ? [{ id: m.id, source: readFileSync(file, 'utf8') }] : []
    })
    expect(checkRecipeSet(STATIC_RECIPES.map(recipe => ({ recipe, guide: readGuide(recipe.slug) })), utilityGuides)).toEqual([])
  })
})
