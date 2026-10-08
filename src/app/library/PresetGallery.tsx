import React from 'react'
import { cloneWithNewIds, countSteps } from '@/core/steps'
import { useTool } from '@/app/ToolContext'
import { track } from '@/app/analytics/analytics'
import Dialog from './Dialog'
import { PRESETS } from './presets'

export interface PresetGalleryProps {
  onClose: () => void
  /** Focus target on close when the dialog was not opened from a focused control. */
  returnFocus?: React.RefObject<HTMLElement | null>
}

/** Responsive card grid of shipped example pipelines. */
export default function PresetGallery({ onClose, returnFocus }: PresetGalleryProps) {
  const { dispatch, setInput } = useTool()

  const tryIt = (id: string) => {
    const preset = PRESETS.find(p => p.id === id)
    if (!preset) return
    // fresh ids so trying the same preset twice never collides with the first copy
    dispatch({ type: 'LOAD', steps: preset.steps.map(cloneWithNewIds), name: preset.name })
    setInput(preset.sampleInput)
    track('pipeline_load', { method: 'preset', preset_id: preset.id, step_count: countSteps(preset.steps) })
    onClose()
  }

  return (
    <Dialog title="Preset gallery" onClose={onClose} widthClass="max-w-[880px]" returnFocus={returnFocus}>
      <p className="m-0 text-[13px] text-muted">Try it replaces your pipeline and input with the preset. Undo brings your steps back.</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(230px,100%),1fr))] gap-2" role="list" aria-label="presets">
        {PRESETS.map(preset => {
          const n = countSteps(preset.steps)
          return (
            <div key={preset.id} role="listitem" className="grid gap-1.5 content-start p-3 border rounded-[7px]">
              <div className="flex items-start justify-between gap-2">
                <h3 className="m-0 text-[13.5px] font-semibold leading-[18px]">{preset.name}</h3>
                <span className="font-mono text-[10.5px] text-muted whitespace-nowrap">{n} step{n === 1 ? '' : 's'}</span>
              </div>
              <p className="m-0 text-[12.5px] text-muted text-pretty">{preset.description}</p>
              <button
                type="button"
                className="justify-self-start mt-1 h-[26px] px-2.5 border rounded-[5px] bg-surface text-[12.5px] font-medium hover:border-acc hover:text-acc"
                aria-label={`Try it: ${preset.name}`}
                onClick={() => tryIt(preset.id)}
              >
                Try it
              </button>
            </div>
          )
        })}
      </div>
    </Dialog>
  )
}
