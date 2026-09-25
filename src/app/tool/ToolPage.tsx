import React, { useMemo, useRef, useState } from 'react'
import UtilityPicker from '@/components/UtilityPicker'
import { defaultParams } from '@/core/params'
import { typesOf, valueType } from '@/core/coerce'
import { isUtilityStep } from '@/core/steps'
import type { ValueType } from '@/types/utility'
import { registry } from '@/app/registry'
import { useTool } from '@/app/ToolContext'
import { trackUtilityAdd } from '@/app/analytics/analytics'
import ToolCommandBridge from '@/app/commands/ToolCommandBridge'
import EngineControls from '@/app/engine/EngineControls'
import MagicButton from '@/app/magic/MagicButton'
import ShareButton from '@/app/share/ShareButton'
import LibraryButton from '@/app/library/LibraryButton'
import PresetsButton from '@/app/library/PresetsButton'
import BulkToggle from './steps/BulkToggle'
import EmptyState from './EmptyState'
import IOSection from './IOSection'
import PipelineToolbar from './PipelineToolbar'
import StepList from './StepList'

/** The pipeline editor. Must be rendered inside <ToolProvider>. */
export default function ToolPage({ banner }: { banner?: React.ReactNode }) {
  const { state, dispatch, input, run } = useTool()
  const [showPicker, setShowPicker] = useState(false)
  // whichever control opened the picker gets focus back when it closes
  const opener = useRef<HTMLElement | null>(null)

  const openPicker = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setShowPicker(true)
  }
  const closePicker = () => {
    setShowPicker(false)
    // after the picker (and its focused search box) unmounts
    requestAnimationFrame(() => opener.current?.focus())
  }
  const togglePicker = () => (showPicker ? closePicker() : openPicker())
  const addStep = (id: string) => {
    dispatch({ type: 'ADD_STEP', utilityId: id, params: defaultParams(registry.get(id)) })
    trackUtilityAdd(id, 'picker')
    closePicker()
  }

  // What a step appended at the end will receive — the pipeline's actual output type
  // when a run has finished, else the last enabled utility's declared output, else
  // the input's type. Drives the picker's compatibility badges.
  const previousProduces = useMemo<ValueType[]>(() => {
    if (state.steps.length && run.result) return [valueType(run.result.out)]
    const last = [...state.steps].reverse().find(s => isUtilityStep(s) && s.enabled !== false)
    const meta = last && isUtilityStep(last) ? registry.get(last.utilityId) : undefined
    return meta ? typesOf(meta.produces) : [valueType(input)]
  }, [state.steps, input, run.result])

  return (
    <>
      <ToolCommandBridge />
      {banner}
      <section className="glass rounded-[28px] p-4 sm:p-6 md:p-8 shadow-glow grid gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-semibold">String Utility Belt</h1>
            <p className="muted">Efficiently chain string utilities, preview every step, and export/share your pipeline.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="cta" onClick={openPicker}>Add utility</button>
            <a className="btn" href="/blog/">Read blog</a>
          </div>
        </div>
        <IOSection />
      </section>

      <PipelineToolbar onTogglePicker={togglePicker} pickerOpen={showPicker}>
        <MagicButton />
        <PresetsButton />
        <LibraryButton />
        <ShareButton />
        <BulkToggle />
        <EngineControls />
      </PipelineToolbar>

      {showPicker && (
        // UtilityPicker lists every matching utility inline with no scroll container of
        // its own (by design: arrow-key nav needs the whole listbox mounted) — capping
        // height here keeps the ~250-utility "All" view from turning the page into a
        // multi-thousand-pixel scroll, especially on mobile.
        <section className="max-h-[70vh] overflow-y-auto rounded-[28px]">
          <UtilityPicker onPick={addStep} onClose={closePicker} previousProduces={previousProduces} />
        </section>
      )}

      <section className="grid gap-3" aria-label="pipeline steps">
        {state.steps.length === 0
          ? <EmptyState onAddUtility={openPicker} />
          : <StepList steps={state.steps} />}
      </section>
    </>
  )
}
