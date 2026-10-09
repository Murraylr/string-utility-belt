import React, { useEffect, useRef, useState } from 'react'
import { cloneWithNewIds, countSteps } from '@/core/steps'
import { useTool } from '@/app/ToolContext'
import { track } from '@/app/analytics/analytics'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { RECIPE_LOADERS } from '@/recipes/_generated/loaders'
import { RECIPE_CATEGORIES, recipePath, toPipelineSteps, type RecipeMeta } from '@/recipes/types'
import Dialog from './Dialog'

export interface RecipeGalleryProps {
  onClose: () => void
  /** Focus target on close when the dialog was not opened from a focused control. */
  returnFocus?: React.RefObject<HTMLElement | null>
}

const GROUPS = RECIPE_CATEGORIES
  .map(category => ({ category, recipes: RECIPE_INDEX.filter(r => r.category === category) }))
  .filter(g => g.recipes.length > 0)

const groupId = (category: string) => `recipe-gallery-${category.replace(/\W+/g, '-').toLowerCase()}`

/**
 * Every published recipe, by category, as a card grid in the editor. The cards come
 * from the generated index; a recipe's steps load (one small chunk) only when "Try it"
 * is clicked, so the dialog costs nothing per recipe until one is used.
 */
export default function RecipeGallery({ onClose, returnFocus }: RecipeGalleryProps) {
  const { dispatch, setInput } = useTool()
  const [loading, setLoading] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  // a load that finishes after the dialog was closed must not replace the pipeline
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const tryIt = async (meta: RecipeMeta) => {
    if (loading) return
    setLoading(meta.slug)
    setFailed(null)
    let loaded
    try {
      loaded = await RECIPE_LOADERS[meta.slug]()
    } catch {
      // offline, or a deploy replaced the chunk: say so on the card and let Try it be clicked again
      if (mounted.current) { setLoading(null); setFailed(meta.slug) }
      return
    }
    if (!mounted.current) return
    const { recipe } = loaded
    const steps = toPipelineSteps(recipe.steps)
    // fresh ids so trying the same recipe twice never collides with the first copy
    dispatch({ type: 'LOAD', steps: steps.map(cloneWithNewIds), name: recipe.name })
    setInput(recipe.samples[0]?.input ?? '')
    track('pipeline_load', { method: 'recipe_gallery', recipe_id: recipe.slug, step_count: countSteps(steps) })
    onClose()
  }

  return (
    <Dialog title="Recipes" onClose={onClose} widthClass="max-w-[880px]" returnFocus={returnFocus}>
      <p className="m-0 text-[13px] text-muted text-pretty">
        Ready-made pipelines for real jobs. Try it replaces your pipeline and input with the recipe and its worked
        example; undo brings your steps back.
      </p>
      {GROUPS.map(({ category, recipes }) => (
        <section key={category} className="grid gap-2" aria-labelledby={groupId(category)}>
          <h3 id={groupId(category)} className="m-0 pt-1 text-[12.5px] font-semibold text-muted">{category}</h3>
          <ul className="m-0 p-0 list-none grid grid-cols-[repeat(auto-fill,minmax(min(250px,100%),1fr))] gap-2">
            {recipes.map(recipe => (
              <li key={recipe.slug} className="flex flex-col gap-1.5 p-3 border rounded-[7px]">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="m-0 text-[13.5px] font-semibold leading-[18px]">{recipe.name}</h4>
                  <span className="font-mono text-[10.5px] text-muted whitespace-nowrap">
                    {recipe.stepCount} step{recipe.stepCount === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="m-0 text-[12.5px] text-muted text-pretty line-clamp-3">{recipe.summary}</p>
                {/* pinned to the bottom, so the cards in a row line up whatever their summary's length */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-auto pt-1">
                  <button
                    type="button"
                    className="h-[26px] px-2.5 border rounded-[5px] bg-surface text-[12.5px] font-medium hover:border-acc hover:text-acc disabled:opacity-60"
                    aria-label={`Try it: ${recipe.name}`}
                    // the loading button stays enabled, so keyboard focus is not dropped to <body>
                    disabled={loading !== null && loading !== recipe.slug}
                    aria-busy={loading === recipe.slug || undefined}
                    onClick={() => { void tryIt(recipe) }}
                  >
                    {loading === recipe.slug ? 'Loading…' : 'Try it'}
                  </button>
                  <a
                    className="text-[12.5px] text-muted underline underline-offset-[3px] hover:text-fg"
                    href={recipePath(recipe.slug)}
                    aria-label={`How it works: ${recipe.name}`}
                  >
                    How it works
                  </a>
                </div>
                {failed === recipe.slug && (
                  <p role="alert" className="m-0 text-[11.5px] text-danger-ink">
                    This recipe could not be loaded. Check your connection and try again.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Dialog>
  )
}
