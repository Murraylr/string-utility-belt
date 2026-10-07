/**
 * Pure helpers for recipe pages, shared by the app and the pre-render
 * (`RecipeArticle`, `RecipePage`, `scripts/seo/content.ts`).
 */
import type { UtilityMeta } from '@/core/registry'
import type { ParamSpec, PipelineStep } from '@/types/utility'
import { isBranchStep, isMacroStep, isUtilityStep } from '@/core/steps'
import { encodeShare, SCHEMA_VERSION } from '@/core/serialize'
import type { Recipe, RecipeMeta } from '@/recipes/types'
import { displayName, FEATURED_RECIPE_SLUGS } from '../seo'

export type UtilityLookup = (id: string) => UtilityMeta | undefined

export const nameOf = (id: string, utility: UtilityLookup) => displayName(utility(id)?.name ?? id)

/** A step's heading: its own label, else its utility's name (or what kind of step it is). */
export function stepTitle(step: PipelineStep, utility: UtilityLookup): string {
  if (step.label) return step.label
  if (isUtilityStep(step)) return nameOf(step.utilityId, utility)
  if (isBranchStep(step)) return `Branch into ${step.branches.length} lanes`
  if (isMacroStep(step)) return step.name
  return 'Step'
}

/** Params that differ from the utility's defaults: what the recipe actually sets. */
export function changedParams(step: PipelineStep, utility: UtilityLookup): Array<[string, unknown]> {
  if (!isUtilityStep(step)) return []
  const spec: Record<string, ParamSpec> = utility(step.utilityId)?.params ?? {}
  return Object.entries(step.params ?? {}).filter(([key, value]) =>
    JSON.stringify((spec[key] as { default?: unknown } | undefined)?.default) !== JSON.stringify(value))
}

/**
 * The "Open in the editor" link: the tool with these steps and an example's input,
 * as a share link (`#/p/…`), so it works without JavaScript and on middle-click.
 * It only ever carries an example's own input, never what a visitor typed: an
 * href can end up in history, bookmarks or a copied link.
 */
export const openInEditorHref = (steps: PipelineStep[], name: string, exampleInput: string): string =>
  `/#/p/${encodeShare({ v: SCHEMA_VERSION, steps, name, input: exampleInput })}`

/** Related recipes for a page: its own picks first, then others from its category. */
export function relatedRecipes(recipe: Recipe, all: RecipeMeta[], limit = 3): RecipeMeta[] {
  const bySlug = new Map(all.map(r => [r.slug, r]))
  const picked = (recipe.related ?? []).flatMap(slug => bySlug.get(slug) ?? [])
  const sameCategory = all.filter(r => r.category === recipe.category && r.slug !== recipe.slug && !picked.includes(r))
  return [...picked, ...sameCategory].slice(0, limit)
}

/** The featured recipes that exist, in their listed order (home page, app and pre-render). */
export const featuredRecipes = (all: RecipeMeta[]): RecipeMeta[] =>
  FEATURED_RECIPE_SLUGS.flatMap(slug => all.find(r => r.slug === slug) ?? [])

/** Recipes that use a utility, for its doc page. */
export const recipesUsing = (utilityId: string, all: RecipeMeta[], limit = 3): RecipeMeta[] =>
  all.filter(r => r.utilityIds.includes(utilityId)).slice(0, limit)
