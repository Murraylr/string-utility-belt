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
import SaveToExtensionButton from '@/app/extension/SaveToExtensionButton'
import BulkToggle from './steps/BulkToggle'
import EmptyState from './EmptyState'
import IOSection from './IOSection'
import PipelineToolbar from './PipelineToolbar'
import StepList from './StepList'

/** Longest pipeline name kept, as the library keeps it. */
const MAX_NAME = 120

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

  const titleRow = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1 min-w-[240px] flex-1">
        <h1 className="sr-only">String Utility Belt</h1>
        <input
          className="w-full min-w-0 p-0 bg-transparent border-0 border-b border-transparent outline-hidden focus:border-line-2 text-2xl leading-[30px] font-semibold tracking-[-0.02em]"
          aria-label="Pipeline name"
          placeholder="Untitled pipeline"
          maxLength={MAX_NAME}
          autoComplete="off"
          spellCheck={false}
          value={state.name ?? ''}
          onChange={e => dispatch({ type: 'SET_META', name: e.target.value || undefined, libraryId: state.libraryId })}
        />
        <p className="m-0 text-[13px] text-muted text-pretty">
          Paste some text, add steps, and watch what each one does to it. It all runs in your browser, so nothing you
          paste gets uploaded.
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <PresetsButton />
        <LibraryButton />
        <ShareButton />
        <SaveToExtensionButton />
      </div>
    </div>
  )

  return (
    <>
      <ToolCommandBridge />
      {banner}
      <IOSection header={titleRow}>
        <div className="grid gap-3.5 min-w-0">
          <PipelineToolbar onTogglePicker={togglePicker} pickerOpen={showPicker}>
            <MagicButton />
            <BulkToggle />
            <EngineControls />
          </PipelineToolbar>

          {showPicker && (
            // UtilityPicker lists every matching utility inline with no scroll container of
            // its own (by design: arrow-key nav needs the whole listbox mounted) — capping
            // height here keeps the ~250-utility "All" view from turning the page into a
            // multi-thousand-pixel scroll, especially on mobile.
            <section className="max-h-[70vh] overflow-y-auto rounded-lg">
              <UtilityPicker onPick={addStep} onClose={closePicker} previousProduces={previousProduces} />
            </section>
          )}

          <section className="grid gap-3" aria-label="pipeline steps">
            {state.steps.length === 0
              ? <EmptyState onAddUtility={openPicker} />
              : <StepList steps={state.steps} />}
          </section>
        </div>
      </IOSection>
    </>
  )
}
