import React from 'react'
import { Sparkles } from 'lucide-react'
import { cloneWithNewIds, countSteps } from '@/core/steps'
import { useTool } from '@/app/ToolContext'
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
    onClose()
  }

  return (
    <Dialog title="Preset gallery" onClose={onClose} className="max-w-4xl" returnFocus={returnFocus}>
      <p className="muted">Shipped example pipelines — "Try it" replaces the current pipeline and input with the preset (undo brings the old steps back).</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3" role="list" aria-label="presets">
        {PRESETS.map(preset => {
          const n = countSteps(preset.steps)
          return (
            <div key={preset.id} role="listitem" className="card p-4 grid gap-2 content-start">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium leading-snug">{preset.name}</h3>
                <span className="chip shrink-0">{n} step{n === 1 ? '' : 's'}</span>
              </div>
              <p className="text-sm text-muted">{preset.description}</p>
              <button className="btn justify-self-start mt-1" aria-label={`Try it: ${preset.name}`} onClick={() => tryIt(preset.id)}>
                <Sparkles size={14} aria-hidden /> Try it
              </button>
            </div>
          )
        })}
      </div>
    </Dialog>
  )
}
