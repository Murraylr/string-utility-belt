/**
 * The recipe page's markup, shared by the app (`RecipePage`) and the pre-render
 * (`scripts/seo/content.ts`, via `renderToStaticMarkup`), so the static HTML a
 * search engine indexes is the page a visitor gets. Keep it pure: no browser
 * APIs, no registry import (utility metadata comes in through `utility`), no
 * effects. Interactivity arrives through props: the live widget is a slot, and
 * every handler is optional (the pre-render passes none).
 */
import React from 'react'
import type { BranchStep, Condition, EachStep, PipelineStep, ValueType } from '@/types/utility'
import { isBranchStep, isEachStep, isMacroStep, isUtilityStep, utilityIds, walkSteps } from '@/core/steps'
import { itemNoun } from '@/core/split'
import { RECIPE_CATEGORIES, RECIPES_PATH, recipePath, type Recipe, type RecipeMeta, type RecipeSample } from '@/recipes/types'
import type { Preview, SkipTrace, StepTrace } from '@/recipes/trace'
import { utilityPath } from '../related'
import { changedParams, describeString, nameOf, revealInvisible, stepCountText, stepTitle, stringPairs, type UtilityLookup } from './recipeHelpers'

/** One param value, as the recipe runs it: strings raw (never JSON-escaped), rule tables as rows. */
function ParamValue({ value }: { value: unknown }) {
  const pairs = stringPairs(value)
  if (pairs) {
    return (
      <table className="mono text-xs border-separate border-spacing-x-2">
        <tbody>
          {pairs.map(([find, replace], i) => (
            <tr key={i}>
              <td className="wrap-anywhere"><code className="bg-surface-2 rounded px-1">{describeString(find)}</code></td>
              <td aria-label="becomes" className="text-muted">→</td>
              <td className="wrap-anywhere"><code className="bg-surface-2 rounded px-1">{describeString(replace)}</code></td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
  const shown = typeof value === 'string' ? describeString(value) : JSON.stringify(value)
  return shown.includes('\n') || shown.length > 60
    ? <pre className="mono whitespace-pre-wrap wrap-anywhere bg-surface-2 rounded-lg p-2">{shown}</pre>
    : <code className="mono bg-surface-2 rounded px-1 wrap-anywhere">{shown}</code>
}

function ParamList({ params }: { params: Array<{ key: string; label: string; value: unknown }> }) {
  if (params.length === 0) return null
  return (
    <dl className="grid gap-1 text-xs">
      {params.map(({ key, label, value }) => (
        <div key={key} className="grid gap-1">
          <dt className="text-muted">{label}</dt>
          <dd className="min-w-0 overflow-auto"><ParamValue value={value} /></dd>
        </div>
      ))}
    </dl>
  )
}

function PreviewBlock({ preview, label }: { preview: Preview; label: string }) {
  const note = preview.kind === 'bytes'
    ? `${preview.size} bytes${preview.truncated ? ', first shown as hex' : ', as hex'}`
    : preview.truncated ? `first part of ${preview.size.toLocaleString('en-US')} characters` : null
  const shown = preview.kind === 'bytes' ? { text: preview.text, legend: [] } : revealInvisible(preview.text)
  return (
    <figure className="grid gap-1 min-w-0">
      <figcaption className="text-xs text-muted">{label}{note ? ` (${note})` : ''}</figcaption>
      <pre className="mono text-xs whitespace-pre-wrap wrap-anywhere bg-surface-2 rounded-lg p-2 max-h-72 overflow-auto">
        {shown.text}{preview.truncated ? '\n…' : ''}
      </pre>
      {shown.legend.length > 0 && <p className="text-xs text-muted">Shown as symbols: {shown.legend.join(', ')}.</p>}
    </figure>
  )
}

const VALUE_TYPE_NAMES: Record<ValueType, string> = { string: 'text', bytes: 'bytes', json: 'JSON' }

/** A regex condition's flags in words: `i` is the one recipes use. */
function flagNote(flags = ''): string {
  const other = flags.replace('i', '')
  const notes = [flags.includes('i') ? 'ignoring case' : '', other ? `flags ${other}` : ''].filter(Boolean)
  return notes.length ? ` (${notes.join(', ')})` : ''
}

/** What a step's condition does, worded the same for a top-level step and a nested one. */
function ConditionNote({ condition }: { condition?: Condition }) {
  if (!condition || condition.kind === 'always') return null
  const what = condition.kind === 'regex'
    ? <>matches <code className="mono">{condition.pattern}</code>{flagNote(condition.flags)}</>
    : condition.kind === 'nonEmpty' ? 'is not empty' : `is ${VALUE_TYPE_NAMES[condition.type]}`
  return (
    <p className="text-xs text-muted">
      {condition.negate
        ? <>Skipped (its input passes through) when the input {what}.</>
        : <>Runs only when its input {what}; otherwise the input passes through.</>}
    </p>
  )
}

/** A failure policy other than the default (a failed step hands its input on). */
function ErrorNote({ step }: { step: PipelineStep }) {
  if (!step.onError || step.onError === 'passthrough') return null
  const noun = isEachStep(step) ? itemNoun(step.split.mode, 1) : ''
  const text = isEachStep(step)
    ? step.onError === 'empty' ? `A ${noun} whose steps fail comes out empty.` : `One ${noun} that fails fails the whole step.`
    : step.onError === 'empty' ? 'If it fails, the next step gets empty input.' : 'If it fails, the steps after it do not run.'
  return <p className="text-xs text-muted">{text}</p>
}

/** How a "run on each" step cuts its input, as the line above its steps. */
function eachIntro(step: EachStep): React.ReactNode {
  const empty = step.skipEmpty === false ? ', empty ones included,' : ''
  switch (step.split.mode) {
    case 'lines': return <>Each line{empty} goes through:</>
    case 'delimiter': return <>Each item between <code className="mono">{describeString(step.split.separator)}</code>{empty} goes through:</>
    case 'json-array': return <>Each element of the JSON array{empty} goes through:</>
    case 'json-values': return <>Each value of the JSON object{empty} goes through:</>
  }
}

/** How a branch puts its lanes back together, as the line above its lanes. */
function branchIntro(step: BranchStep): React.ReactNode {
  const merge = step.merge ?? { mode: 'concat' }
  const sep = (separator = '\n') => <code className="mono">{describeString(separator)}</code>
  switch (merge.mode) {
    case 'concat': return <>Every lane gets the same input, and their outputs are joined with {sep(merge.separator)}:</>
    case 'zip': return <>Every lane gets the same input, and their outputs are interleaved line by line, joined with {sep(merge.separator)}:</>
    case 'json': return <>Every lane gets the same input, and their outputs are collected into a JSON array:</>
    case 'pick': return <>Every lane gets the same input, and only lane {merge.index + 1}’s output is kept:</>
  }
}

/** A nested step's name: a link to its utility's page, after the step's own label when it has one. */
function NestedTitle({ step, utility }: { step: PipelineStep; utility: UtilityLookup }) {
  if (!isUtilityStep(step)) return <span className="text-sm">{stepTitle(step, utility)}</span>
  const link = <a className="underline underline-offset-2" href={utilityPath(step.utilityId)}>{nameOf(step.utilityId, utility)}</a>
  return step.label
    ? <span className="text-sm">{step.label} <span className="text-muted">(</span>{link}<span className="text-muted">)</span></span>
    : <span className="text-sm">{link}</span>
}

/** Steps inside a container, in order, each with everything it is set to. */
function StepSequence({ steps, utility }: { steps: PipelineStep[]; utility: UtilityLookup }) {
  return (
    <ol className="grid gap-2 border-l-2 pl-3 min-w-0">
      {steps.map(s => (
        <li key={s.id} className="grid gap-1 min-w-0">
          <NestedTitle step={s} utility={utility} />
          <StepSettings step={s} utility={utility} />
        </li>
      ))}
    </ol>
  )
}

/** What runs inside a branch, macro or "run on each" step, containers within containers included. */
function ContainerBody({ step, utility }: { step: PipelineStep; utility: UtilityLookup }) {
  if (isEachStep(step)) {
    return (
      <div className="grid gap-1 min-w-0">
        <p className="text-xs text-muted">{eachIntro(step)}</p>
        <StepSequence steps={step.steps} utility={utility} />
      </div>
    )
  }
  if (isBranchStep(step)) {
    return (
      <div className="grid gap-1 min-w-0">
        <p className="text-xs text-muted">{branchIntro(step)}</p>
        <ol className="grid gap-2 min-w-0">
          {step.branches.map((lane, i) => (
            <li key={i} className="grid gap-1 min-w-0">
              <span className="text-xs text-muted">Lane {i + 1}{lane.length === 0 ? ': its input, unchanged' : ':'}</span>
              {lane.length > 0 && <StepSequence steps={lane} utility={utility} />}
            </li>
          ))}
        </ol>
      </div>
    )
  }
  if (isMacroStep(step)) return <StepSequence steps={step.steps} utility={utility} />
  return null
}

/**
 * Everything a step is set to: its condition, failure policy and changed params, then
 * (for a container) the steps it runs, each shown the same way. The pre-rendered page
 * is all a crawler or a visitor without JavaScript gets, so nothing here may hide.
 */
function StepSettings({ step, utility }: { step: PipelineStep; utility: UtilityLookup }) {
  return (
    <>
      <ConditionNote condition={step.condition} />
      <ErrorNote step={step} />
      <ParamList params={changedParams(step, utility)} />
      <ContainerBody step={step} utility={utility} />
    </>
  )
}

export interface RecipeWidgetProps {
  samples: RecipeSample[]
  sampleId: string
  input: string
  output: string
  /** The first failing step of the current run, already worded for people. */
  error?: string
  running?: boolean
  stepCount: number
  /** `#/p/<payload>` link to the tool with these steps: works without JavaScript and on middle-click. */
  openHref: string
  onSample?: (id: string) => void
  onInput?: (value: string) => void
  onOpen?: (e: React.MouseEvent<HTMLAnchorElement>) => void
  onCopy?: () => void
  copied?: boolean
  /** Why the output is not (or only partly) for the current input, and the button that fixes it. */
  notice?: { text: string; action: string; onAction?: () => void }
  /** The browser-extension strip (app only: the pre-render has no extension to ask). */
  extension?: React.ReactNode
}

/**
 * The worked example, live: pick a sample or paste your own input, see the output,
 * then open the pipeline in the editor. Fixed-height panes, so the static render
 * and the live one occupy the same space; shorter when stacked on a narrow screen,
 * so "Open in the editor" stays near the top.
 */
export function RecipeWidget(props: RecipeWidgetProps) {
  const { samples, sampleId, input, output, error, running, stepCount, openHref, onSample, onInput, onOpen, onCopy, copied, notice, extension } = props
  return (
    <section className="card p-4 sm:p-6 grid gap-4" aria-labelledby="recipe-try-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="recipe-try-h" className="text-lg font-medium">Try it with your own data</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="examples">
          {samples.map(s => (
            <button key={s.id} type="button" className="chip" aria-pressed={s.id === sampleId} onClick={onSample && (() => onSample(s.id))}>
              {s.title}
            </button>
          ))}
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4 min-w-0">
        <label className="grid gap-1 text-sm min-w-0">
          <span className="muted">Input — paste your own</span>
          <textarea
            className="field mono text-xs h-40 lg:h-64 resize-y"
            value={input}
            readOnly={!onInput}
            onChange={onInput && (e => onInput(e.target.value))}
            spellCheck={false}
            aria-label="recipe input"
          />
        </label>
        <div className="grid gap-1 text-sm min-w-0 content-start">
          <span className="muted"><span id="recipe-output-label">Output</span>{running ? ' — running…' : ''}</span>
          <pre
            role="status"
            aria-labelledby="recipe-output-label"
            aria-busy={running || undefined}
            className="mono text-xs whitespace-pre-wrap wrap-anywhere bg-surface-2 rounded-xl p-3 h-40 lg:h-64 overflow-auto transition-opacity aria-busy:opacity-60"
          >{output}</pre>
        </div>
      </div>
      {/* always mounted: text injected together with a brand-new live region is not reliably announced */}
      <div role="status" className={notice ? 'card flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm' : 'sr-only'}>
        {notice && (
          <>
            <span>{notice.text}</span>
            <button type="button" className="btn" onClick={notice.onAction}>{notice.action}</button>
          </>
        )}
      </div>
      {error && <p role="alert" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl p-2">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <a className="cta" href={openHref} rel="nofollow" onClick={onOpen}>Open in the editor</a>
        <button type="button" className="btn" onClick={onCopy}>{copied ? 'Copied' : 'Copy output'}</button>
        <span className="text-sm text-muted">
          {stepCountText(stepCount)}, every one editable. Runs in your browser: nothing you paste is uploaded.
        </span>
      </div>
      {extension}
    </section>
  )
}

export interface RecipeArticleProps {
  recipe: Recipe
  utility: UtilityLookup
  /** The guide body as trusted HTML (`renderMarkdownDocument`, which escapes everything). */
  guideHtml: string
  /** Each top-level step's output on the current input (the build's trace, or the live run). */
  steps: StepTrace[]
  /** What leaving out each step does to the first sample; null while it is being worked out, empty when it could not be. */
  skip: SkipTrace[] | null
  /** The live widget (`RecipeWidget`). */
  live: React.ReactNode
  related: RecipeMeta[]
  /** An ad unit, placed after the worked example and before the guide (app only). */
  ad?: React.ReactNode
  /** A run is in progress: the step outputs shown are about to change. */
  running?: boolean
}

export function RecipeArticle({ recipe, utility, guideHtml, steps, skip, live, related, ad, running }: RecipeArticleProps) {
  const traceOf = new Map(steps.map(s => [s.id, s]))
  const skipOf = new Map((skip ?? []).map(s => [s.id, s]))
  // every step id, nested ones included, to the number of the top-level step it is in
  const index = new Map<string, number>()
  recipe.steps.forEach((top, i) => walkSteps([top], s => { index.set(s.id, i + 1) }))
  const firstSample = recipe.samples[0]
  const utilitiesUsed = utilityIds(recipe.steps)

  return (
    <article className="w-full max-w-5xl mx-auto grid gap-6 min-w-0">
      <header className="grid gap-2">
        <nav aria-label="breadcrumb" className="text-sm text-muted">
          <a className="underline underline-offset-2" href={RECIPES_PATH}>Recipes</a>
          <span aria-hidden> / </span>
          <span>{recipe.category}</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl font-semibold">{recipe.name}</h1>
        <p className="muted max-w-3xl">{recipe.summary}</p>
        <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="steps">
          {recipe.steps.map((s, i) => (
            <li key={s.id} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden className="text-muted">→</span>}
              <span className="chip">{stepTitle(s, utility)}</span>
            </li>
          ))}
        </ol>
      </header>

      {live}

      <section className="card p-4 sm:p-6 grid gap-4" aria-labelledby="recipe-steps-h">
        <h2 id="recipe-steps-h" className="text-lg font-medium">Step by step</h2>
        <ol className="grid gap-5 transition-opacity aria-busy:opacity-60" aria-busy={running || undefined}>
          {recipe.steps.map((s, i) => {
            const trace = traceOf.get(s.id)
            return (
              <li key={s.id} className="grid gap-2 border-t pt-4 first:border-t-0 first:pt-0 min-w-0">
                <h3 className="font-medium">{i + 1}. {stepTitle(s, utility)}</h3>
                <p className="text-sm">{s.why}</p>
                <div className="grid sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3 min-w-0">
                  <div className="grid gap-2 content-start min-w-0">
                    {isUtilityStep(s) && (
                      <a className="text-sm underline underline-offset-2 w-fit" href={utilityPath(s.utilityId)}>{nameOf(s.utilityId, utility)}</a>
                    )}
                    <StepSettings step={s} utility={utility} />
                  </div>
                  <div className="grid gap-2 content-start min-w-0">
                    {trace?.error && <p className="text-sm text-danger">This step failed: {trace.error}</p>}
                    {trace?.skipped && <p className="text-xs text-muted">Its condition did not match this input, so the input passed through unchanged.</p>}
                    {trace?.output && <PreviewBlock preview={trace.output} label="Output after this step" />}
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {/* an empty list means it could not be worked out in this browser: leave the section out */}
      {(skip === null || skip.length > 0) && <section className="card p-4 sm:p-6 grid gap-4" aria-labelledby="recipe-skip-h">
        <div className="grid gap-1">
          <h2 id="recipe-skip-h" className="text-lg font-medium">What if you skip a step?</h2>
          <p className="text-sm muted">
            Each step is there for a reason. Here is what the example “{firstSample.title}” turns into with one step left out.
          </p>
        </div>
        {skip === null
          ? <p className="text-sm muted" role="status">Working it out…</p>
          : (
            <ul className="grid gap-4">
              {recipe.steps.map((s, i) => {
                const result = skipOf.get(s.id)
                if (!result) return null
                const at = result.error && index.get(result.error.stepId)
                const where = at ? `step ${at} (${stepTitle(recipe.steps[at - 1], utility)})` : 'a later step'
                return (
                  <li key={s.id} className="grid gap-2 border-t pt-3 first:border-t-0 first:pt-0 min-w-0">
                    <h3 className="text-sm font-medium">Without step {i + 1}, {stepTitle(s, utility)}</h3>
                    {result.error && <p className="text-sm">The pipeline breaks: {where} fails with “{result.error.message}”.</p>}
                    {!result.error && result.unchanged && (
                      <p className="text-sm muted">Nothing changes for this example: the step is there for inputs like the other examples.</p>
                    )}
                    {!result.error && !result.unchanged && result.output && <PreviewBlock preview={result.output} label="The result instead" />}
                  </li>
                )
              })}
            </ul>
          )}
      </section>}

      {ad}

      {/* trusted: renderMarkdownDocument escapes every character of the guide source */}
      <section className="md card p-4 sm:p-6 min-w-0 [&>div>:first-child]:mt-0" aria-label="guide">
        <div dangerouslySetInnerHTML={{ __html: guideHtml }} />
      </section>

      <section className="card p-4 sm:p-6 grid gap-4 min-w-0" aria-labelledby="recipe-more-h">
        <h2 id="recipe-more-h" className="text-lg font-medium">Utilities in this recipe</h2>
        <ul className="grid sm:grid-cols-2 gap-2 text-sm">
          {utilitiesUsed.map(id => (
            <li key={id}>
              <a className="underline underline-offset-2" href={utilityPath(id)}>{nameOf(id, utility)}</a>
              {utility(id)?.description && <span className="text-muted"> — {utility(id)!.description}</span>}
            </li>
          ))}
        </ul>
        {related.length > 0 && (
          <>
            <h2 className="text-lg font-medium">More recipes</h2>
            <RecipeCards recipes={related} />
          </>
        )}
        <a className="btn w-fit" href={RECIPES_PATH}>Browse all recipes</a>
      </section>
    </article>
  )
}

/** Recipe cards linking to their pages: the hub, related recipes, the home page and utility pages. */
export function RecipeCards({ recipes, className = 'grid sm:grid-cols-2 lg:grid-cols-3 gap-2' }: { recipes: RecipeMeta[]; className?: string }) {
  return (
    <ul className={className}>
      {recipes.map(r => (
        <li key={r.slug}>
          <a className="block h-full p-3 rounded-xl border bg-surface hover:border-primary-600 hover:shadow-glow transition" href={recipePath(r.slug)}>
            <div className="font-medium">{r.name}</div>
            <div className="text-xs text-muted line-clamp-2">{r.summary}</div>
            <div className="text-xs text-muted mt-1">{r.chain.join(' → ')}</div>
          </a>
        </li>
      ))}
    </ul>
  )
}

/** The recipe index's body: every recipe, by category. */
export function RecipesIndex({ recipes }: { recipes: RecipeMeta[] }) {
  const groups = RECIPE_CATEGORIES
    .map(category => ({ category, items: recipes.filter(r => r.category === category) }))
    .filter(g => g.items.length > 0)
  return (
    <div className="w-full max-w-5xl mx-auto grid gap-6 min-w-0">
      <header className="grid gap-2">
        <h1 className="text-2xl font-semibold">Recipes</h1>
        <p className="muted max-w-3xl">
          Ready-made pipelines for jobs that take more than one tool: decoding layered formats, cleaning pasted text,
          converting data between shapes. Each recipe shows every step with its real output and opens in the editor,
          where you can change anything.
        </p>
      </header>
      {groups.map(g => (
        <section key={g.category} className="card p-4 sm:p-6 grid gap-3" aria-labelledby={`recipes-${g.category.replace(/\W+/g, '-').toLowerCase()}`}>
          <h2 id={`recipes-${g.category.replace(/\W+/g, '-').toLowerCase()}`} className="text-lg font-medium">{g.category}</h2>
          <RecipeCards recipes={g.items} />
        </section>
      ))}
      <p className="text-sm muted">
        Looking for a single conversion? <a className="underline underline-offset-2" href="/utilities/">Browse all utilities</a>.
      </p>
    </div>
  )
}
