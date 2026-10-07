/**
 * Recipes: hand-picked multi-step pipelines for one real task ("decode a SAML
 * request"), each published as a pre-rendered page at `/recipes/<slug>/`.
 *
 * A recipe lives in `src/recipes/<slug>/`: `recipe.ts` (default export, type
 * `Recipe`: the steps, why each is there, and worked samples with golden
 * outputs) and `guide.md` (the page's search title/description frontmatter and
 * its prose). `npm run gen` writes `_generated/` from them; the rules every
 * recipe must pass are in `check.ts`.
 */
import type { BranchStep, EachStep, MacroStep, PipelineStep, UtilityStep } from '../types/utility'

/** Hub sections, in display order. */
export const RECIPE_CATEGORIES = [
  'Web & APIs',
  'DevOps & Config',
  'Data & Spreadsheets',
  'Writing & Marketing',
  'Frontend',
] as const
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number]

/** The reason a top-level step is in the recipe, shown beside its output on the page. */
interface Why { why: string }

/** A top-level step: any pipeline step plus its reason. Steps inside a branch, macro or each carry no reason. */
export type RecipeStep = (UtilityStep & Why) | (BranchStep & Why) | (MacroStep & Why) | (EachStep & Why)

/** One worked input. The first sample is the one the page opens with. */
export interface RecipeSample {
  /** Unique within the recipe, kebab-case (`redirect-url`). */
  id: string
  /** Its tab label on the page (`Redirect binding URL`). */
  title: string
  input: string
  /** The exact output, as `formatForDisplay` renders it; checked by the recipe tests and the build. */
  output: string
}

export interface Recipe {
  /** URL slug, equal to the folder name: lowercase words joined by single hyphens. */
  slug: string
  /** The page's H1 and card title, task-phrased: "Decode a SAML request". */
  name: string
  /** One or two sentences under the H1 and on cards. */
  summary: string
  category: RecipeCategory
  /**
   * The search this page is written for. It must not be the head term of a utility
   * page (a utility guide title containing it), or the two pages would compete.
   */
  primaryQuery: string
  /** `YYYY-MM-DD`. */
  published: string
  /** `YYYY-MM-DD` of the last substantial revision. */
  updated?: string
  steps: RecipeStep[]
  samples: RecipeSample[]
  /** Other recipes worth linking from this one, by slug. */
  related?: string[]
}

/** What `_generated/index.ts` keeps of each recipe: enough for cards and links, no samples or steps. */
export interface RecipeMeta {
  slug: string
  name: string
  summary: string
  category: RecipeCategory
  /** Every utility the recipe uses, nested branch steps included. */
  utilityIds: string[]
  /** The top-level steps' labels (else their utilities' display names), in order. */
  chain: string[]
  /** Top-level steps: the numbered steps on the page (a branch counts once). */
  stepCount: number
  published: string
  updated?: string
}

/** The steps as the engine, share links and the library take them: reasons dropped, `enabled` explicit. */
export function toPipelineSteps(steps: RecipeStep[]): PipelineStep[] {
  return steps.map(s => {
    const step: Record<string, unknown> = { ...s, enabled: s.enabled !== false }
    delete step.why
    return step as unknown as PipelineStep
  })
}

/** A recipe page's path. */
export const recipePath = (slug: string): string => `/recipes/${encodeURIComponent(slug)}/`

export const RECIPES_PATH = '/recipes/'
