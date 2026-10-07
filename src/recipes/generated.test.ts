import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { build, RECIPES_GENERATED_DIR } from '../../scripts/gen-recipes'
import { RECIPE_INDEX } from './_generated/index'
import { RECIPE_LOADERS } from './_generated/loaders'
import { STATIC_RECIPES } from './_generated/static'

describe('generated recipe index', () => {
  it('is up to date — run `npm run gen` if this fails', async () => {
    const { files } = await build()
    const stale = Object.entries(files)
      .filter(([name, content]) => readFileSync(path.join(RECIPES_GENERATED_DIR, name), 'utf8') !== content)
      .map(([name]) => name)
    expect(stale).toEqual([])
  }, 120000)

  it('covers the same recipes in the index, the loaders and the static list', () => {
    const slugs = STATIC_RECIPES.map(r => r.slug).sort()
    expect(RECIPE_INDEX.map(m => m.slug).sort()).toEqual(slugs)
    expect(Object.keys(RECIPE_LOADERS).sort()).toEqual(slugs)
  })

  it('carries metadata only in the index — no steps or samples', () => {
    for (const m of RECIPE_INDEX) {
      expect(m).not.toHaveProperty('steps')
      expect(m).not.toHaveProperty('samples')
    }
  })

  it('loads a recipe and its guide markdown through its lazy loader', async () => {
    const slug = RECIPE_INDEX[0].slug
    const { recipe, guide } = await RECIPE_LOADERS[slug]()
    expect(recipe.slug).toBe(slug)
    expect(guide).toMatch(/^---\ntitle: /)
  })
})
