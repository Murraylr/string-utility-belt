import React from 'react'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { RECIPES_TITLE, recipesDescription } from '../seo'
import { useDocumentMeta } from '../useDocumentMeta'
import { RecipesIndex } from './RecipeArticle'

/** Every recipe, by category (`/recipes/`). The pre-render writes the same `RecipesIndex`. */
export default function RecipesIndexPage() {
  useDocumentMeta(RECIPES_TITLE, recipesDescription(RECIPE_INDEX.length))
  return <RecipesIndex recipes={RECIPE_INDEX} />
}
