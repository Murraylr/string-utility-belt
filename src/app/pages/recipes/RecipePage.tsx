import React, { useEffect, useMemo, useRef, useState } from 'react'
import { registry } from '@/app/registry'
import { formatForDisplay } from '@/core/coerce'
import { countSteps } from '@/core/steps'
import { isPlainLeftClick } from '@/lib/router'
import { execute } from '@/app/engine/executor'
import { useRunner } from '@/app/engine/useRunner'
import { track, trackPipelineEvent } from '@/app/analytics/analytics'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { toPipelineSteps, type Recipe } from '@/recipes/types'
import type { PipelineStep } from '@/types/utility'
import {
  firstError, stepTraces, traceRecipe, TRACE_ELEMENT_ID, type PipelineRunner, type RecipeTrace, type SkipTrace,
} from '@/recipes/trace'
import { pageTitle, SITE_NAME } from '../seo'
import { useDocumentMeta } from '../useDocumentMeta'
import { useNoindex } from '../useNoindex'
import { RecipeArticle, RecipeWidget } from './RecipeArticle'
import { openInEditorHref, relatedRecipes, stepTitle } from './recipeHelpers'
import { loadRecipeData, peekRecipeData, type RecipeData } from './recipeData'
import { followLink, openPipelineInEditor } from './openInEditor'
import RecipeExtension from './RecipeExtension'
import PageSponsor from '@/app/sponsors/PageSponsor'

type Load = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ok'; data: RecipeData }

const fromPeek = (slug: string): Load => {
  const data = peekRecipeData(slug)
  return data === undefined ? { status: 'loading' } : data === null ? { status: 'missing' } : { status: 'ok', data }
}

/** One recipe page (`/recipes/<slug>/`). AppShell keys it by slug, so another recipe starts fresh. */
export default function RecipePage({ slug }: { slug: string }) {
  const [load, setLoad] = useState<Load>(() => fromPeek(slug))
  useEffect(() => {
    if (load.status !== 'loading') return
    let cancelled = false
    loadRecipeData(slug).then(
      data => { if (!cancelled) setLoad(data ? { status: 'ok', data } : { status: 'missing' }) },
      () => { if (!cancelled) setLoad({ status: 'error' }) },
    )
    return () => { cancelled = true }
  }, [slug, load.status])

  if (load.status === 'loading') return <div className="muted" role="status">Loading…</div>
  if (load.status === 'missing') return <UnknownRecipe slug={slug} />
  if (load.status === 'error') {
    return (
      <div role="alert" className="max-w-3xl mx-auto card p-6 grid gap-3">
        <p>This recipe could not be loaded. Check your connection, then reload the page.</p>
        <button type="button" className="btn w-fit" onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
  return <RecipeView data={load.data} />
}

function UnknownRecipe({ slug }: { slug: string }) {
  useDocumentMeta(pageTitle('Unknown recipe'), `There is no ${SITE_NAME} recipe called "${slug}".`)
  useNoindex()
  return (
    <div className="max-w-3xl mx-auto card p-6 grid gap-3">
      <h1 className="text-xl font-semibold">Unknown recipe “{slug}”</h1>
      <p className="muted">There's no recipe at this address. It may have been renamed.</p>
      <a className="btn w-fit" href="/recipes/">Browse all recipes</a>
    </div>
  )
}

/**
 * The trace the pre-render embedded for this recipe's first sample, when this page
 * was loaded directly and the trace still matches the recipe (a cached page from an
 * older build would not): its step outputs fill the page without running anything.
 */
function readEmbeddedTrace(recipe: Recipe, steps: PipelineStep[]): RecipeTrace | null {
  const raw = document.getElementById(TRACE_ELEMENT_ID)?.textContent
  if (!raw) return null
  try {
    const trace = JSON.parse(raw) as RecipeTrace
    const fits = trace?.slug === recipe.slug
      && trace.sampleId === recipe.samples[0].id
      && trace.output === recipe.samples[0].output
      && Array.isArray(trace.steps) && Array.isArray(trace.skip)
      && trace.steps.map(s => s.id).join('\n') === steps.map(s => s.id).join('\n')
    return fits ? trace : null
  } catch {
    return null
  }
}

const runInBrowser: PipelineRunner = (input, steps, previews) => execute(input, steps, { previews })

const COPIED_MS = 2000

function RecipeView({ data }: { data: RecipeData }) {
  const { recipe } = data
  useDocumentMeta(pageTitle(data.title), data.description)
  const steps = useMemo(() => toPipelineSteps(recipe.steps), [recipe])
  const main = recipe.samples[0]
  const [embedded] = useState(() => readEmbeddedTrace(recipe, steps))
  const [sampleId, setSampleId] = useState(main.id)
  const [input, setInput] = useState(main.input)
  // runs nothing until the visitor changes something, when the build's trace is there
  const [live, setLive] = useState(!embedded)
  const run = useRunner(input, steps, { previews: true, live })
  // the example the input is (sampleId '' once the visitor has typed their own)
  const sample = recipe.samples.find(s => s.id === sampleId) ?? main

  // Input over the runner's size guard is not run on every change (see useRunner): until
  // the visitor asks for a full run of this very input, show no output rather than the
  // result of an earlier input. `fullRunFor` is the input such a run was asked for.
  const [fullRunFor, setFullRunFor] = useState<string | null>(null)
  const large = live ? run.largeInput : null
  const held = !!large?.paused && fullRunFor !== input
  const failed = live && !!run.failure
  const result = live && !held && !failed ? run.result : null
  const runFull = () => { setFullRunFor(input); run.runNow() }
  const notice = large && (held || (result?.partial && fullRunFor !== input))
    ? {
      text: `Large input (${(large.size / (1024 * 1024)).toFixed(1)} MB): ${held ? 'the live preview is paused.' : 'the output is for the first 64 KB only.'}`,
      action: 'Run full input',
      onAction: runFull,
    }
    : undefined

  const [skip, setSkip] = useState<SkipTrace[] | null>(embedded?.skip ?? null)
  useEffect(() => {
    if (embedded) return
    let cancelled = false
    traceRecipe(recipe, runInBrowser).then(
      trace => { if (!cancelled) setSkip(trace.skip) },
      // the section is a bonus: without it the page is still complete
      () => { if (!cancelled) setSkip([]) },
    )
    return () => { cancelled = true }
  }, [recipe, embedded])

  const blank = held || failed
  const output = blank ? '' : result ? formatForDisplay(result.out) : embedded?.output ?? ''
  const stepOutputs = useMemo(
    () => (blank ? [] : result ? stepTraces(steps, result) : embedded?.steps ?? []),
    [blank, result, embedded, steps],
  )
  const error = useMemo(() => {
    if (run.failure && live) return `The pipeline could not run: ${run.failure}`
    const failed = result && firstError(result, steps)
    if (!failed) return undefined
    const at = steps.findIndex(s => s.id === failed.stepId)
    const where = at >= 0 ? `Step ${at + 1} (${stepTitle(steps[at], registry.get)})` : 'A step'
    return `${where} failed: ${failed.message}`
  }, [run.failure, live, result, steps])

  const edited = useRef(false)
  const onInput = (value: string) => {
    if (!edited.current) {
      edited.current = true
      track('recipe_input_edit', { recipe_id: recipe.slug })
    }
    setLive(true)
    // custom text: no example is selected any more, so clicking one brings it back
    setSampleId('')
    setInput(value)
  }
  const onSample = (id: string) => {
    const next = recipe.samples.find(s => s.id === id)
    if (!next || id === sampleId) return
    track('recipe_sample_select', { recipe_id: recipe.slug, sample_id: id })
    setLive(true)
    setSampleId(id)
    setInput(next.input)
  }

  const openHref = useMemo(() => openInEditorHref(steps, recipe.name, sample.input), [steps, recipe.name, sample.input])
  const onOpen = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(e, e.currentTarget)) return
    e.preventDefault()
    const outcome = openPipelineInEditor({ steps, input, name: recipe.name })
    if (outcome === 'kept') return
    // without storage the editor cannot be handed the recipe: its share link carries the
    // steps and the example input (never typed text), and runs without storage
    const method = outcome === 'opened' ? 'recipe' : 'recipe_share_link'
    track('pipeline_load', { method, recipe_id: recipe.slug, step_count: countSteps(steps) })
    if (outcome === 'failed') followLink(openHref)
  }

  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), COPIED_MS)
    return () => clearTimeout(timer)
  }, [copied])
  const onCopy = () => {
    navigator.clipboard?.writeText(output).then(() => {
      setCopied(true)
      trackPipelineEvent('output_copy', steps, { format: 'raw', source: 'recipe', recipe_id: recipe.slug })
    }, () => { /* clipboard refused (permissions, insecure context): nothing was copied */ })
  }

  return (
    <RecipeArticle
      recipe={recipe}
      utility={registry.get}
      guideHtml={data.guideHtml}
      steps={stepOutputs}
      skip={skip}
      related={relatedRecipes(recipe, RECIPE_INDEX)}
      sponsor={<PageSponsor page={{ kind: 'recipe', slug: recipe.slug }} />}
      running={live && run.running}
      live={(
        <RecipeWidget
          samples={recipe.samples}
          sampleId={sampleId}
          input={input}
          output={output}
          error={error}
          running={live && run.running}
          stepCount={recipe.steps.length}
          openHref={openHref}
          onSample={onSample}
          onInput={onInput}
          onOpen={onOpen}
          onCopy={onCopy}
          copied={copied}
          notice={notice}
          extension={<RecipeExtension steps={steps} name={recipe.name} recipeId={recipe.slug} />}
        />
      )}
    />
  )
}
