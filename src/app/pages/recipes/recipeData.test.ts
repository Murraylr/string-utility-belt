import { describe, expect, it } from 'vitest'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { loadRecipeData, peekRecipeData } from './recipeData'

describe('recipe data', () => {
  it('loads a recipe with its guide title, description and rendered body, then serves it synchronously', async () => {
    const slug = RECIPE_INDEX[0].slug
    const data = await loadRecipeData(slug)
    expect(data?.recipe.slug).toBe(slug)
    expect(data?.title.length).toBeGreaterThan(0)
    expect(data?.description.length).toBeGreaterThan(0)
    expect(data?.guideHtml).toMatch(/<h2/)
    expect(data?.guideHtml).not.toContain('title:')
    expect(peekRecipeData(slug)).toBe(data)
    expect(await loadRecipeData(slug)).toBe(data)
  })

  it('answers null for a slug with no recipe, including names on Object.prototype', async () => {
    for (const slug of ['no-such-recipe', 'constructor', 'hasownproperty', '__proto__']) {
      expect(await loadRecipeData(slug), slug).toBeNull()
      expect(peekRecipeData(slug), slug).toBeNull()
    }
  })

  it('reports nothing before a load has finished', () => {
    expect(peekRecipeData('never-requested')).toBeUndefined()
  })
})
