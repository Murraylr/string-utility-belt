import React, { useId, useMemo, useRef, useState } from 'react'
import { Puzzle } from 'lucide-react'
import {
  MAX_PIPELINE_NAME, canRunInExtension, extensionUnsupportedSteps, normalizePipelineName, unknownStepTypes,
  type AppRequest, type BridgeResult,
} from '@/core/extensionBridge'
import { registry } from '@/app/registry'
import { useTool } from '@/app/ToolContext'
import { useFavorites } from '@/app/favorites'
import Dialog from '@/app/library/Dialog'
import { sendToExtension, useExtension } from './bridge'

interface DialogProps {
  /** Step types the installed extension can save. */
  stepTypes: readonly string[]
  onClose: () => void
  returnFocus: React.RefObject<HTMLElement | null>
}

/** How the dialog names a step type the extension is too old for. */
const STEP_TYPE_NAMES: Record<string, string> = { each: '"run on each" steps' }

function SaveToExtensionDialog({ stepTypes, onClose, returnFocus }: DialogProps) {
  const { state } = useTool()
  const { favorites } = useFavorites()
  const nameId = useId()
  const [name, setName] = useState(state.name ?? '')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BridgeResult | null>(null)

  // The extension refuses these (it re-checks); say so before the user tries.
  const unsupportedNames = useMemo(() => [...new Set(
    extensionUnsupportedSteps(state.steps, id => registry.get(id)).map(u => registry.get(u.utilityId)?.name ?? u.utilityId),
  )], [state.steps])
  // an extension that predates a step type would drop such steps while saving, changing what the pipeline does
  const tooNew = useMemo(() => unknownStepTypes(state.steps, stepTypes).map(t => STEP_TYPE_NAMES[t] ?? `${t} steps`),
    [state.steps, stepTypes])
  const runnableFavorites = useMemo(() => favorites.filter(id => {
    const meta = registry.get(id)
    return !!meta && canRunInExtension(meta)
  }), [favorites])

  const empty = state.steps.length === 0
  const canSave = !busy && !empty && unsupportedNames.length === 0 && tooNew.length === 0 && normalizePipelineName(name) !== ''

  const send = async (request: AppRequest) => {
    setBusy(true)
    setResult(null)
    const answer = await sendToExtension(request)
    setBusy(false)
    setResult(answer)
  }

  const savePipeline = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    void send({ type: 'save-pipeline', name, steps: state.steps })
  }

  const addFavorites = () => {
    void send({ type: 'add-favorites', utilityIds: runnableFavorites })
  }

  return (
    <Dialog title="Save to extension" widthClass="max-w-[500px]" onClose={onClose} returnFocus={returnFocus}>
      <p className="m-0 text-[13px] text-muted text-pretty">
        Saved pipelines and favourites show up in the extension&apos;s right-click menu for selected text. You can edit or
        delete them on the extension&apos;s options page.
      </p>

      <form className="grid gap-1.5" onSubmit={savePipeline}>
        <label className="text-[11.5px] text-muted" htmlFor={nameId}>Pipeline name</label>
        <div className="flex flex-wrap gap-1.5">
          <input id={nameId} className="field flex-1 min-w-40 h-[30px]" value={name} maxLength={MAX_PIPELINE_NAME} autoComplete="off"
            placeholder="e.g. decode JWT payload" onChange={e => setName(e.target.value)} />
          <button type="submit" className="cta h-[30px] px-3" disabled={!canSave}>Save pipeline</button>
        </div>
        <span className="text-xs text-muted">If the extension already has a pipeline with this name, it gets updated.</span>
        {empty && <span className="text-[12.5px] text-warn">Add some steps first.</span>}
        {tooNew.length > 0 && (
          <div role="alert" className="text-[12.5px] text-warn">
            This version of the extension can&apos;t save {tooNew.join(' or ')}. Update the extension to save this pipeline.
          </div>
        )}
        {unsupportedNames.length > 0 && (
          <div role="alert" className="text-[12.5px] text-warn">
            The extension can&apos;t run {unsupportedNames.join(', ')}. Remove {unsupportedNames.length === 1 ? 'that step' : 'those steps'} to save this pipeline.
          </div>
        )}
      </form>

      <div className="pt-3 border-t flex flex-wrap items-center gap-2.5">
        <p className="m-0 flex-1 min-w-[200px] text-[13px]">
          {runnableFavorites.length
            ? `Add your ${runnableFavorites.length} starred ${runnableFavorites.length === 1 ? 'utility' : 'utilities'} to the extension's favourites.`
            : 'Star utilities in the picker to add them to the extension\'s favourites.'}
        </p>
        <button type="button" className="btn h-7 px-2.5 text-[12.5px]" disabled={busy || runnableFavorites.length === 0} onClick={addFavorites}>
          Add favourites
        </button>
      </div>

      <div role="status" aria-live="polite" className={`text-[12.5px] ${result && !result.ok ? 'text-warn' : 'text-add-ink'}`}>
        {busy ? 'Saving…' : result ? (result.ok ? result.message : result.error) : ''}
      </div>
    </Dialog>
  )
}

/** Offers "save to extension" — only once the browser extension has announced itself on this page. */
export default function SaveToExtensionButton() {
  const extension = useExtension()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  if (!extension) return null
  return (
    <>
      <button ref={buttonRef} type="button" className="btn h-[30px] px-2.5" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Puzzle size={14} aria-hidden /> Save to extension
      </button>
      {open && <SaveToExtensionDialog stepTypes={extension.stepTypes} onClose={() => setOpen(false)} returnFocus={buttonRef} />}
    </>
  )
}
