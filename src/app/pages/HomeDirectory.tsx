import React from 'react'
import { registry, type UtilityMeta } from '@/app/registry'
import { utilityPath } from './related'
import { POPULAR_UTILITY_IDS, displayName } from './seo'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { RecipeCards } from './recipes/RecipeArticle'
import { featuredRecipes } from './recipes/recipeHelpers'

/**
 * Below the pipeline editor on the home page: featured recipes and the popular
 * utilities as crawlable links, so the site's most-visited page leads people (and
 * search engines) to the recipe and per-utility pages. The pre-render writes the
 * same lists (`renderHomeContent`).
 */
export default function HomeDirectory() {
  const popular = POPULAR_UTILITY_IDS.map(id => registry.get(id)).filter((m): m is UtilityMeta => !!m)
  const total = registry.list().length
  const recipes = featuredRecipes(RECIPE_INDEX)

  return (
    <>
    {recipes.length > 0 && (
      <section className="card p-6 grid gap-4" aria-labelledby="home-recipes-h">
        <div className="grid gap-1">
          <h2 id="home-recipes-h" className="text-lg font-medium">Recipes</h2>
          <p className="muted text-sm">Ready-made pipelines for jobs one tool can't do alone. Each shows every step with its output.</p>
        </div>
        <RecipeCards recipes={recipes} />
        <a className="btn w-fit" href="/recipes/">Browse all {RECIPE_INDEX.length} recipes</a>
      </section>
    )}
    <section className="card p-6 grid gap-4" aria-labelledby="home-directory-h">
      <div className="grid gap-1">
        <h2 id="home-directory-h" className="text-lg font-medium">Popular tools</h2>
        <p className="muted text-sm">
          Every utility also has its own page with a guide, worked examples and a playground.
          They all run in your browser: nothing you paste is uploaded.
        </p>
      </div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {popular.map(u => (
          <li key={u.id}>
            <a className="block h-full p-3 rounded-xl border bg-surface hover:border-primary-600 hover:shadow-glow transition" href={utilityPath(u.id)}>
              <div className="font-medium">{displayName(u.name)}</div>
              <div className="text-xs text-muted line-clamp-2">{u.description}</div>
            </a>
          </li>
        ))}
      </ul>
      <a className="btn w-fit" href="/utilities/">Browse all {total} utilities</a>
    </section>
    </>
  )
}
