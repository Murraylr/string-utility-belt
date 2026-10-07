/**
 * The recipe routes, and their preload: `main.tsx` waits for a recipe page's code
 * and data (briefly) before React mounts, so the first render replaces the
 * pre-rendered HTML with the same page rather than a loading state.
 */
import type { Route } from '@/lib/router'
import { preloadable } from '@/app/preloadable'

export const RecipePage = preloadable(() => import('./RecipePage'))
export const RecipesIndexPage = preloadable(() => import('./RecipesIndexPage'))

/** Starts loading what `route` renders; resolves when it is ready (or right away for other routes). */
export function preloadRecipeRoute(route: Route): Promise<unknown> {
  if (route.name === 'recipes') return RecipesIndexPage.preload()
  if (route.name === 'recipe') {
    return Promise.all([
      RecipePage.preload(),
      import('./recipeData').then(m => m.loadRecipeData(route.params.slug)),
    ])
  }
  return Promise.resolve()
}
