import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { registry, loadExamples, type UtilityMeta } from '@/app/registry'
import { runPipeline } from '@/core/runner'
import { defaultParams } from '@/core/params'
import { formatForDisplay } from '@/core/coerce'
import { stepId } from '@/core/steps'
import { loadState, saveState } from '@/lib/persist'
import { isPlainLeftClick, navigateToPath } from '@/lib/router'
import ParamsEditor from '@/components/ParamsEditor'
import AdSlot from '@/app/ads/AdSlot'
import { track, trackUtilityAdd } from '@/app/analytics/analytics'
import type { ParamSpec, Params, UtilityEnv, UtilityExample } from '@/types/utility'
import UtilityGuide from './UtilityGuide'
import { useUtilityGuide } from './useUtilityGuide'
import { useDocumentMeta } from './useDocumentMeta'
import { useNoindex } from './useNoindex'
import { relatedUtilities, utilityPath } from './related'
import { RECIPE_INDEX } from '@/recipes/_generated/index'
import { RecipeCards } from './recipes/RecipeArticle'
import { recipesUsing } from './recipes/recipeHelpers'
import { SITE_NAME, displayName, pageTitle } from './seo'

const ENV_NOTES: Record<UtilityEnv, string> = {
  dom: 'Needs the DOM (DOMParser/document) — browser main thread only.',
  wasm: 'Compiles WebAssembly at runtime — not available in the edge API.',
  eval: 'Executes user-supplied code — never run this on a server.',
  main: 'Must run on the browser main thread.',
}

const PLAYGROUND_DEBOUNCE_MS = 300
const PLAYGROUND_STEP_ID = '__doc_playground__'

function boundsOrOptions(spec: ParamSpec): string {
  switch (spec.kind) {
    case 'number':
    case 'range': {
      const parts: string[] = []
      if (spec.min !== undefined || spec.max !== undefined) {
        parts.push(`${spec.min ?? '−∞'}–${spec.max ?? '∞'}`)
      }
      if (spec.kind === 'number' && spec.step !== undefined) parts.push(`step ${spec.step}`)
      if (spec.kind === 'number' && spec.integer) parts.push('integer')
      return parts.join(', ') || '—'
    }
    case 'select':
    case 'multiselect':
      return spec.options.join(', ')
    case 'string':
    case 'textarea':
      return spec.maxLength ? `max ${spec.maxLength} chars` : '—'
    default:
      return '—'
  }
}

const defaultOf = (spec: ParamSpec): string => {
  const d = (spec as { default?: unknown }).default
  if (d === undefined) return '—'
  return typeof d === 'string' ? d || '(empty)' : JSON.stringify(d)
}

/** The param's help text; its label when it has none (unless that just repeats the name). */
const describeParam = (name: string, spec: ParamSpec): string =>
  spec.description || (spec.label && spec.label !== name ? spec.label : '—')

/** Example inputs stored hex/base64-encoded are bytes — the text playground cannot take them as-is. */
const playable = (ex: UtilityExample) => !ex.inputEncoding || ex.inputEncoding === 'text' || ex.inputEncoding === 'json'

/**
 * Opens the tool page. On a pre-rendered `/util/<id>/` page the path itself routes
 * here, so `#/` alone would land right back on this page: leave the path for the root.
 */
function openTool() {
  const root = import.meta.env.BASE_URL || '/'
  if (location.pathname === root) {
    location.hash = '#/'
    return
  }
  history.pushState(history.state, '', `${root}#/`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/** Documentation for one utility: description, params, examples and a live playground. */
export default function UtilityDocPage({ id }: { id: string }) {
  const meta = registry.get(id)
  if (!meta) return <UnknownUtility id={id} />
  // keyed on id: switching utilities remounts the body, resetting its local state
  // (playground input/params/output, saved examples) without an extra effect for it
  return <UtilityDocPageBody key={id} id={id} meta={meta} />
}

function UnknownUtility({ id }: { id: string }) {
  useDocumentMeta(pageTitle('Unknown utility'), `There is no ${SITE_NAME} utility called "${id}".`)
  // the host answers any /util/<id>/ with a page: keep the made-up ones out of the index
  useNoindex()
  return (
    <div className="max-w-3xl mx-auto card p-6 grid gap-3">
      <h1 className="text-xl font-semibold">Unknown utility "{id}"</h1>
      <p className="muted">There's no utility with that id. Search the full list instead.</p>
      <a className="btn w-fit" href="/utilities/">Browse all utilities</a>
    </div>
  )
}

function UtilityDocPageBody({ id, meta }: { id: string; meta: UtilityMeta }) {
  const [examples, setExamples] = useState<UtilityExample[]>([])
  const [playInput, setPlayInput] = useState('')
  const [playParams, setPlayParams] = useState<Params>(() => defaultParams(meta))
  const [playOutput, setPlayOutput] = useState('')
  const [playError, setPlayError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const playgroundId = useId()
  const guide = useUtilityGuide(id)
  const seo = guide.status === 'ok' ? guide.guide : undefined

  // the guide's SEO title/description match the pre-rendered page's <head>
  useDocumentMeta(
    pageTitle(seo?.title ?? displayName(meta.name)),
    seo?.description || meta.description || `${displayName(meta.name)} — a ${SITE_NAME} utility.`,
  )

  useEffect(() => {
    let cancelled = false
    loadExamples()
      .then(all => { if (!cancelled) setExamples(all[id] ?? []) })
      .catch(() => { /* examples are optional extras: a failed chunk load just hides them */ })
    return () => { cancelled = true }
  }, [id])

  useEffect(() => {
    const ctrl = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const result = await runPipeline(
          playInput,
          [{ id: PLAYGROUND_STEP_ID, utilityId: id, params: playParams, enabled: true }],
          { load: registry.load, signal: ctrl.signal, env: 'browser-main' }
        )
        if (ctrl.signal.aborted) return
        if (result.err[PLAYGROUND_STEP_ID]) {
          setPlayError(result.err[PLAYGROUND_STEP_ID])
          setPlayOutput('')
        } else {
          setPlayError(null)
          setPlayOutput(formatForDisplay(result.out))
        }
      } catch (e) {
        if (!ctrl.signal.aborted) { setPlayError((e as Error)?.message || String(e)); setPlayOutput('') }
      }
    }, PLAYGROUND_DEBOUNCE_MS)
    return () => { ctrl.abort(); clearTimeout(timer) }
  }, [id, playInput, playParams])

  const related = useMemo(() => relatedUtilities(meta, registry.list()), [meta])
  const recipes = useMemo(() => recipesUsing(id, RECIPE_INDEX), [id])

  const tryExample = (ex: UtilityExample) => {
    setPlayInput(ex.input)
    setPlayParams({ ...defaultParams(meta), ...ex.params })
    inputRef.current?.focus()
    track('doc_example_try', { utility_id: id })
  }

  const useInPipeline = () => {
    const current = loadState()
    const step = { id: stepId(), utilityId: id, enabled: true, params: { ...playParams } }
    saveState({ ...current, steps: [...current.steps, step] })
    trackUtilityAdd(id, 'doc_page')
    setSaved(true)
    openTool()
  }

  const paramEntries = Object.entries(meta.params)

  return (
    // w-full + min-w-0: a param table or long mono value can otherwise force this grid
    // item wider than the viewport (shrink-to-fit under `mx-auto`) instead of scrolling
    // within its own overflow-auto wrapper
    <article className="w-full max-w-3xl mx-auto grid gap-6 min-w-0">
      <header className="card p-6 grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{displayName(meta.name)}</h1>
          <span className="chip">{meta.category}</span>
        </div>
        <p className="muted">{meta.description}</p>
        <div className="text-sm text-muted">
          accepts <span className="mono">{[meta.accepts].flat().join(' | ')}</span>
          {' → '}
          produces <span className="mono">{[meta.produces].flat().join(' | ')}</span>
        </div>
        {meta.env.length > 0 && (
          <ul className="text-sm text-muted grid gap-1" aria-label="environment notes">
            {meta.env.map(e => <li key={e}><span aria-hidden>⚠ </span>{ENV_NOTES[e] ?? e}</li>)}
          </ul>
        )}
        {(meta.tags.length > 0 || meta.aliases.length > 0) && (
          <div className="flex flex-wrap gap-1 mt-1">
            {meta.aliases.map(a => <span key={`a:${a}`} className="chip" title="alias">{a}</span>)}
            {meta.tags.map(t => <span key={`t:${t}`} className="chip" title="tag">{t}</span>)}
          </div>
        )}
      </header>

      {/* first after the header: most visitors arrive from a search for the tool itself */}
      <section className="card p-6 grid gap-3" aria-labelledby={`${playgroundId}-h`}>
        <h2 id={`${playgroundId}-h`} className="text-lg font-medium">Try it</h2>
        <label className="grid gap-1 text-sm">
          <span className="muted">input</span>
          <textarea
            ref={inputRef}
            className="field font-mono min-h-24"
            value={playInput}
            onChange={e => setPlayInput(e.target.value)}
            placeholder="type or paste something to try…"
            aria-label="playground input"
          />
        </label>
        {paramEntries.length > 0 && (
          <ParamsEditor
            spec={meta.params}
            params={playParams}
            onChange={setPlayParams}
            idPrefix={`doc-playground-${id}`}
            sampleInput={playInput}
          />
        )}
        {playError && (
          <div role="status" aria-label="playground error" className="text-sm text-danger bg-danger/10 border border-danger/30 rounded-xl p-2">
            {playError}
          </div>
        )}
        <div className="grid gap-1 text-sm">
          <span className="muted" aria-hidden>output</span>
          {/* a named live region: aria-label alone is not allowed on a plain <pre> */}
          <pre
            role="status"
            aria-label="playground output"
            className="mono text-xs whitespace-pre-wrap wrap-anywhere bg-surface-2 rounded-lg p-3 min-h-12 max-h-96 overflow-auto"
          >
            {playOutput}
          </pre>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" className="cta w-fit" onClick={useInPipeline}>Use in pipeline</button>
          {saved && <span role="status" className="text-sm text-success">Added — opening the tool…</span>}
        </div>
      </section>

      <UtilityGuide name={meta.name} state={guide} onOpen={() => track('guide_open', { utility_id: id })} />

      {/* between content sections, clear of the playground's controls */}
      <AdSlot placement="doc-page" />

      {paramEntries.length > 0 && (
        <section className="card p-6 grid gap-3">
          <h2 className="text-lg font-medium">Parameters</h2>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted">
                  <th scope="col" className="pr-3 py-1">name</th>
                  <th scope="col" className="pr-3 py-1">kind</th>
                  <th scope="col" className="pr-3 py-1">default</th>
                  <th scope="col" className="pr-3 py-1">bounds / options</th>
                  <th scope="col" className="py-1">description</th>
                </tr>
              </thead>
              <tbody>
                {paramEntries.map(([name, spec]) => (
                  <tr key={name} className="border-t">
                    <th scope="row" className="pr-3 py-1 mono font-normal text-left">{name}</th>
                    <td className="pr-3 py-1">{spec.kind}</td>
                    <td className="pr-3 py-1 mono">{defaultOf(spec)}</td>
                    <td className="pr-3 py-1">{boundsOrOptions(spec)}</td>
                    <td className="py-1 text-muted">{describeParam(name, spec)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {examples.length > 0 && (
        <section className="card p-6 grid gap-4">
          <h2 className="text-lg font-medium">Examples</h2>
          {examples.map((ex, i) => (
            <div key={i} className="grid gap-1 border-t pt-3 first:border-t-0 first:pt-0">
              {ex.title && <h3 className="font-medium text-sm">{ex.title}</h3>}
              <div className="text-xs text-muted">
                input{ex.inputEncoding && ex.inputEncoding !== 'text' ? ` (${ex.inputEncoding})` : ''}
              </div>
              <pre className="mono text-xs whitespace-pre-wrap wrap-anywhere bg-surface-2 rounded-lg p-2">{ex.input}</pre>
              {ex.params && Object.keys(ex.params).length > 0 && (
                <>
                  <div className="text-xs text-muted">params</div>
                  <pre className="mono text-xs whitespace-pre-wrap wrap-anywhere bg-surface-2 rounded-lg p-2">
                    {JSON.stringify(ex.params)}
                  </pre>
                </>
              )}
              <div className="text-xs text-muted">
                output{ex.output === undefined && ex.outputMatches ? ' (varies between runs — matches this pattern)' : ''}
              </div>
              <pre className="mono text-xs whitespace-pre-wrap wrap-anywhere bg-surface-2 rounded-lg p-2">
                {ex.output ?? (ex.outputMatches ? `/${ex.outputMatches}/` : '(varies between runs)')}
              </pre>
              {playable(ex) && (
                <button
                  type="button"
                  className="btn w-fit text-xs"
                  aria-label={`Try example${ex.title ? `: ${ex.title}` : ` ${i + 1}`} in the playground`}
                  onClick={() => tryExample(ex)}
                >
                  Try it
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {recipes.length > 0 && (
        <section className="card p-6 grid gap-3">
          <h2 className="text-lg font-medium">Recipes that use {displayName(meta.name)}</h2>
          <RecipeCards recipes={recipes} className="grid sm:grid-cols-2 gap-2" />
        </section>
      )}

      {related.length > 0 && (
        <section className="card p-6 grid gap-2">
          <h2 className="text-lg font-medium">Related utilities</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {related.map(m => (
              <li key={m.id}>
                {/* a crawlable path href (search engines drop #/ fragments); clicks stay in the app */}
                <a
                  className="hover:underline"
                  href={utilityPath(m.id)}
                  onClick={e => {
                    if (!isPlainLeftClick(e, e.currentTarget)) return
                    e.preventDefault()
                    navigateToPath(utilityPath(m.id))
                  }}
                >
                  {displayName(m.name)}
                </a>
                <span className="text-xs text-muted ml-2">{m.category}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
