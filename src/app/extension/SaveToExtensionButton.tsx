import React, { useId, useMemo, useRef, useState } from 'react'
import { Puzzle } from 'lucide-react'
import {
  MAX_PIPELINE_NAME, canRunInExtension, extensionUnsupportedSteps, normalizePipelineName,
  type AppRequest, type BridgeResult,
} from '@/core/extensionBridge'
import { registry } from '@/app/registry'
import { useTool } from '@/app/ToolContext'
import { useFavorites } from '@/app/favorites'
import Dialog from '@/app/library/Dialog'
import { track, trackPipelineEvent } from '@/app/analytics/analytics'
import { sendToExtension, useExtension } from './bridge'

interface DialogProps {
  onClose: () => void
  returnFocus: React.RefObject<HTMLElement | null>
}

function SaveToExtensionDialog({ onClose, returnFocus }: DialogProps) {
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
  const runnableFavorites = useMemo(() => favorites.filter(id => {
    const meta = registry.get(id)
    return !!meta && canRunInExtension(meta)
  }), [favorites])

  const empty = state.steps.length === 0
  const canSave = !busy && !empty && unsupportedNames.length === 0 && normalizePipelineName(name) !== ''

  const send = async (request: AppRequest, onSaved: () => void) => {
    setBusy(true)
    setResult(null)
    const answer = await sendToExtension(request)
    setBusy(false)
    setResult(answer)
    if (answer.ok) onSaved()
  }

  const savePipeline = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    void send({ type: 'save-pipeline', name, steps: state.steps }, () => trackPipelineEvent('extension_pipeline_save', state.steps))
  }

  const addFavorites = () => {
    void send({ type: 'add-favorites', utilityIds: runnableFavorites }, () => track('extension_favorites_add', { count: runnableFavorites.length }))
  }

  return (
    <Dialog title="Save to extension" onClose={onClose} returnFocus={returnFocus}>
      <p className="text-sm muted">
        Saved pipelines and favourites appear on the extension&apos;s right-click menu for selected text. Edit or delete
        them on the extension&apos;s options page.
      </p>

      <form className="grid gap-2" onSubmit={savePipeline}>
        <label className="muted" htmlFor={nameId}>pipeline name</label>
        <input id={nameId} className="field" value={name} maxLength={MAX_PIPELINE_NAME} autoComplete="off"
          placeholder="e.g. decode JWT payload" onChange={e => setName(e.target.value)} />
        <div className="text-xs text-muted">Saving under a name the extension already has updates that pipeline.</div>
        {empty && <div className="text-sm text-muted">Add some steps to the pipeline first.</div>}
        {unsupportedNames.length > 0 && (
          <div role="alert" className="text-sm text-warn">
            The extension can&apos;t run {unsupportedNames.join(', ')} — remove {unsupportedNames.length === 1 ? 'that step' : 'those steps'} to save this pipeline.
          </div>
        )}
        <button type="submit" className="cta justify-self-start" disabled={!canSave}>save pipeline</button>
      </form>

      <div className="pt-2 border-t grid gap-2">
        <p className="text-sm">
          {runnableFavorites.length
            ? `Add your ${runnableFavorites.length} starred ${runnableFavorites.length === 1 ? 'utility' : 'utilities'} to the extension's favourites.`
            : 'Star utilities in the picker to add them to the extension\'s favourites.'}
        </p>
        <button type="button" className="btn justify-self-start" disabled={busy || runnableFavorites.length === 0} onClick={addFavorites}>
          add favourites
        </button>
      </div>

      <div role="status" aria-live="polite" className={`text-sm ${result && !result.ok ? 'text-warn' : ''}`}>
        {busy ? 'saving…' : result ? (result.ok ? result.message : result.error) : ''}
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
      <button ref={buttonRef} type="button" className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Puzzle size={16} aria-hidden /> save to extension
      </button>
      {open && <SaveToExtensionDialog onClose={() => setOpen(false)} returnFocus={buttonRef} />}
    </>
  )
}
