import React, { useEffect, useMemo, useRef, useState } from 'react'
import { registry } from '@/app/registry'
import { formatForDisplay } from '@/core/coerce'
import { countSteps } from '@/core/steps'
import { isPlainLeftClick } from '@/lib/router'
import { execute } from '@/app/engine/executor'
import { useRunner } from '@/app/engine/useRunner'
import { track, trackPipelineEvent } from '@/app/analytics/analytics'
import { PRESET_INDEX } from '@/presets/_generated/index'
import { PRESETS_PATH, toPipelineSteps, type Preset } from '@/presets/types'
import type { PipelineStep } from '@/types/utility'
import {
  firstError, stepTraces, tracePreset, TRACE_ELEMENT_ID, type PipelineRunner, type PresetTrace, type SkipTrace,
} from '@/presets/trace'
import { pageTitle, SITE_NAME } from '../seo'
import { useDocumentMeta } from '../useDocumentMeta'
import { useNoindex } from '../useNoindex'
import { PresetArticle, PresetWidget } from './PresetArticle'
import { openInEditorHref, relatedPresets, stepTitle } from './presetHelpers'
import { loadPresetData, peekPresetData, type PresetData } from './presetData'
import { followLink, openPipelineInEditor } from './openInEditor'
import PresetExtension from './PresetExtension'
import PageSponsor from '@/app/sponsors/PageSponsor'
import PagePromo from '@/app/sponsors/PagePromo'

type Load = { status: 'loading' } | { status: 'missing' } | { status: 'error' } | { status: 'ok'; data: PresetData }

const fromPeek = (slug: string): Load => {
  const data = peekPresetData(slug)
  return data === undefined ? { status: 'loading' } : data === null ? { status: 'missing' } : { status: 'ok', data }
}

/** One preset page (`/presets/<slug>/`). AppShell keys it by slug, so another preset starts fresh. */
export default function PresetPage({ slug }: { slug: string }) {
  const [load, setLoad] = useState<Load>(() => fromPeek(slug))
  useEffect(() => {
    if (load.status !== 'loading') return
    let cancelled = false
    loadPresetData(slug).then(
      data => { if (!cancelled) setLoad(data ? { status: 'ok', data } : { status: 'missing' }) },
      () => { if (!cancelled) setLoad({ status: 'error' }) },
    )
    return () => { cancelled = true }
  }, [slug, load.status])

  if (load.status === 'loading') return <div className="text-sm text-muted" role="status">Loading…</div>
  if (load.status === 'missing') return <UnknownPreset slug={slug} />
  if (load.status === 'error') {
    return (
      <div role="alert" className="max-w-[560px] grid gap-3">
        <p className="m-0 text-[15px] leading-6">This preset didn't load. Check your connection, then reload the page.</p>
        <button type="button" className="btn justify-self-start" onClick={() => location.reload()}>Reload</button>
      </div>
    )
  }
  return <PresetView data={load.data} />
}

function UnknownPreset({ slug }: { slug: string }) {
  useDocumentMeta(pageTitle('Unknown preset'), `There is no ${SITE_NAME} preset called "${slug}".`)
  useNoindex()
  return (
    <div className="max-w-[560px] grid gap-3">
      <h1 className="m-0 text-[28px] leading-[34px] font-semibold tracking-[-0.02em]">No preset at this address</h1>
      <p className="page-lead">It may have been renamed.</p>
      <a className="btn justify-self-start" href={PRESETS_PATH}>Browse all presets</a>
    </div>
  )
}

/**
 * The trace the pre-render embedded for this preset's first sample, when this page
 * was loaded directly and the trace still matches the preset (a cached page from an
 * older build would not): its step outputs fill the page without running anything.
 */
function readEmbeddedTrace(preset: Preset, steps: PipelineStep[]): PresetTrace | null {
  const raw = document.getElementById(TRACE_ELEMENT_ID)?.textContent
  if (!raw) return null
  try {
    const trace = JSON.parse(raw) as PresetTrace
    const fits = trace?.slug === preset.slug
      && trace.sampleId === preset.samples[0].id
      && trace.output === preset.samples[0].output
      && Array.isArray(trace.steps) && Array.isArray(trace.skip)
      && trace.steps.map(s => s.id).join('\n') === steps.map(s => s.id).join('\n')
    return fits ? trace : null
  } catch {
    return null
  }
}

/**
 * The browser's runner for the skip traces, cancelled with `signal`: the in-flight run
 * is aborted and no further one starts, so a page left behind stops taking turns on
 * the executor that the next page's runs use.
 */
const runInBrowser = (signal: AbortSignal): PipelineRunner => (input, steps, previews) =>
  signal.aborted ? Promise.reject(new Error('the preset page was left')) : execute(input, steps, { previews, signal })

const COPIED_MS = 2000

function PresetView({ data }: { data: PresetData }) {
  const { preset } = data
  useDocumentMeta(pageTitle(data.title), data.description)
  const steps = useMemo(() => toPipelineSteps(preset.steps), [preset])
  const main = preset.samples[0]
  const [embedded] = useState(() => readEmbeddedTrace(preset, steps))
  const [sampleId, setSampleId] = useState(main.id)
  const [input, setInput] = useState(main.input)
  // runs nothing until the visitor changes something, when the build's trace is there
  const [live, setLive] = useState(!embedded)
  const run = useRunner(input, steps, { previews: true, live })
  // the example the input is (sampleId '' once the visitor has typed their own)
  const sample = preset.samples.find(s => s.id === sampleId) ?? main

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
    const left = new AbortController()
    tracePreset(preset, runInBrowser(left.signal)).then(
      trace => { if (!left.signal.aborted) setSkip(trace.skip) },
      // the section is a bonus: without it the page is still complete
      () => { if (!left.signal.aborted) setSkip([]) },
    )
    return () => left.abort()
  }, [preset, embedded])

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
      track('preset_input_edit', { preset_id: preset.slug })
    }
    setLive(true)
    // custom text: no example is selected any more, so clicking one brings it back
    setSampleId('')
    setInput(value)
  }
  const onSample = (id: string) => {
    const next = preset.samples.find(s => s.id === id)
    if (!next || id === sampleId) return
    track('preset_sample_select', { preset_id: preset.slug, sample_id: id })
    setLive(true)
    setSampleId(id)
    setInput(next.input)
  }

  const openHref = useMemo(() => openInEditorHref(steps, preset.name, sample.input), [steps, preset.name, sample.input])
  const onOpen = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(e, e.currentTarget)) return
    e.preventDefault()
    const outcome = openPipelineInEditor({ steps, input, name: preset.name })
    if (outcome === 'kept') return
    // without storage the editor cannot be handed the preset: its share link carries the
    // steps and the example input (never typed text), and runs without storage
    const method = outcome === 'opened' ? 'preset' : 'preset_share_link'
    track('pipeline_load', { method, preset_id: preset.slug, step_count: countSteps(steps) })
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
      trackPipelineEvent('output_copy', steps, { format: 'raw', source: 'preset', preset_id: preset.slug })
    }, () => { /* clipboard refused (permissions, insecure context): nothing was copied */ })
  }

  return (
    <PresetArticle
      preset={preset}
      utility={registry.get}
      guideHtml={data.guideHtml}
      steps={stepOutputs}
      skip={skip}
      related={relatedPresets(preset, PRESET_INDEX)}
      sponsor={<PageSponsor page={{ kind: 'preset', slug: preset.slug }} />}
      promo={<PagePromo page={{ kind: 'preset', slug: preset.slug }} slot="inline" />}
      running={live && run.running}
      live={(
        <PresetWidget
          samples={preset.samples}
          sampleId={sampleId}
          input={input}
          output={output}
          error={error}
          running={live && run.running}
          stepCount={preset.steps.length}
          openHref={openHref}
          onSample={onSample}
          onInput={onInput}
          onOpen={onOpen}
          onCopy={onCopy}
          copied={copied}
          notice={notice}
          extension={<PresetExtension steps={steps} name={preset.name} presetId={preset.slug} />}
        />
      )}
    />
  )
}
