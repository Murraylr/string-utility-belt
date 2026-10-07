/**
 * Recipe pages' data in the browser: the recipe and its rendered guide, one lazy
 * chunk per recipe (`_generated/loaders.ts`). Loads are cached, and a finished
 * one is readable synchronously (`peekRecipeData`), so a page whose data was
 * preloaded before React mounted (see `routes.ts`) renders complete on its
 * first pass instead of flashing a loading state over the pre-rendered HTML.
 */
import { RECIPE_LOADERS } from '@/recipes/_generated/loaders'
import type { Recipe } from '@/recipes/types'
import { parseGuide, renderMarkdownDocument } from '../guide'

export interface RecipeData {
  recipe: Recipe
  /** The guide's search title and description (the pre-rendered page's `<head>` has the same). */
  title: string
  description: string
  /** The guide body as trusted HTML (everything escaped by `renderMarkdownDocument`). */
  guideHtml: string
}

const pending = new Map<string, Promise<RecipeData | null>>()
const settled = new Map<string, RecipeData | null>()

/** The recipe with this slug, or null when there is none. Rejects when its chunk fails to load. */
export function loadRecipeData(slug: string): Promise<RecipeData | null> {
  let load = pending.get(slug)
  if (!load) {
    // own keys only: a slug such as "constructor" must not reach Object.prototype
    load = !Object.prototype.hasOwnProperty.call(RECIPE_LOADERS, slug)
      ? Promise.resolve(null)
      : RECIPE_LOADERS[slug]().then(({ recipe, guide }) => {
        const parsed = parseGuide(guide)
        return {
          recipe,
          title: parsed.title ?? recipe.name,
          description: parsed.description ?? recipe.summary,
          guideHtml: renderMarkdownDocument(guide),
        }
      })
    pending.set(slug, load)
    load.then(
      data => { settled.set(slug, data) },
      // a failed chunk load (offline, a deploy replaced the chunk) may be retried
      () => { pending.delete(slug) },
    )
  }
  return load
}

/** A finished load: the data, null for no such recipe, undefined while not loaded (or failed). */
export const peekRecipeData = (slug: string): RecipeData | null | undefined => settled.get(slug)
