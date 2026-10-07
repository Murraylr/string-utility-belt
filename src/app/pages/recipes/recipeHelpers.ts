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

/**
 * Params that differ from the utility's defaults: what the recipe actually sets,
 * each with the label the editor shows for it.
 */
export function changedParams(step: PipelineStep, utility: UtilityLookup): Array<{ key: string; label: string; value: unknown }> {
  if (!isUtilityStep(step)) return []
  const spec: Record<string, ParamSpec> = utility(step.utilityId)?.params ?? {}
  return Object.entries(step.params ?? {})
    .filter(([key, value]) => JSON.stringify((spec[key] as { default?: unknown } | undefined)?.default) !== JSON.stringify(value))
    .map(([key, value]) => ({ key, label: spec[key]?.label || key, value }))
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

/** Characters a reader cannot see, and what a step preview shows instead. */
const MARKS: Array<{ test: RegExp; legend: string; show: (ch: string) => string }> = [
  { test: /\r/, legend: '␍ carriage return', show: () => '␍' },
  { test: /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/, legend: '⍽ no-break or other special space', show: () => '⍽' },
  { test: /[\u200B\u2060\uFEFF\u00AD]/, legend: '⟨…⟩ invisible character', show: ch => `⟨${{ '\u200B': 'ZWSP', '\u2060': 'WJ', '\uFEFF': 'BOM', '\u00AD': 'SHY' }[ch]}⟩` },
  // eslint-disable-next-line no-control-regex -- control characters are what this matches
  { test: /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/, legend: '⟨…⟩ control character', show: ch => (ch === '\u001B' ? '⟨ESC⟩' : `⟨U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}⟩`) },
]

// trailing spaces/tabs (before a line break or the end), or any one character from MARKS
// eslint-disable-next-line no-control-regex -- control characters are what this matches
const INVISIBLE = /([ \t]+)(?=\r?\n|$)|[\r\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000\u200B\u2060\uFEFF\u00AD\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

/**
 * A step preview with its invisible characters drawn as symbols, and a legend for
 * the ones present. Several recipes exist to remove exactly these characters (a
 * carriage return, a no-break space, a byte order mark), so a preview that showed
 * them raw would look identical before and after the step. Emoji joiners and
 * variation selectors are left alone: they are part of the characters they join.
 */
export function revealInvisible(text: string): { text: string; legend: string[] } {
  const legend = new Set<string>()
  const shown = text.replace(INVISIBLE, (match: string, trailing?: string) => {
    if (trailing) {
      legend.add('· trailing space or ⇥ tab')
      return trailing.replace(/ /g, '·').replace(/\t/g, '⇥')
    }
    const mark = MARKS.find(m => m.test.test(match))!
    legend.add(mark.legend)
    return mark.show(match)
  })
  return { text: shown, legend: [...legend] }
}

/** A string param as a reader can see it: an empty or all-whitespace value is named. */
export function describeString(value: string): string {
  if (value === '') return '(empty)'
  if (/^ +$/.test(value)) return value.length === 1 ? '(one space)' : `(${value.length} spaces)`
  if (value === '\t') return '(tab)'
  if (value === '\n') return '(newline)'
  return value
}

/** Rule tables (`keyvalue` params, such as multi replace's find → replace pairs), or null for any other value. */
export function stringPairs(value: unknown): Array<[string, string]> | null {
  return Array.isArray(value) && value.length > 0
    && value.every(p => Array.isArray(p) && p.length === 2 && typeof p[0] === 'string' && typeof p[1] === 'string')
    ? (value as Array<[string, string]>)
    : null
}
