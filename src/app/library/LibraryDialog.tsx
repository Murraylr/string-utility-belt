import React, { useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, PlusSquare, Search, Pencil, Trash2, Upload, X } from 'lucide-react'
import { asText, isBytes } from '@/core/coerce'
import { countSteps, stepId } from '@/core/steps'
import { useTool } from '@/app/ToolContext'
import { track } from '@/app/analytics/analytics'
import { sameSteps } from './autosave'
import Dialog from './Dialog'
import { downloadText } from './download'
import Tabs from './Tabs'
import { relativeTime } from './time'
import {
  deleteEntry, exportLibrary, getEntry, importLibrary, renameEntry, saveEntry, useLibrary,
  type EntryKind, type LibraryEntry,
} from './storage'

export interface LibraryDialogProps {
  onClose: () => void
  /** Opens straight to the macros tab (e.g. from a "save as macro" action elsewhere). */
  initialTab?: EntryKind
  /** Focus target on close when the dialog was not opened from a focused control. */
  returnFocus?: React.RefObject<HTMLElement | null>
}

const TABS: { id: EntryKind; label: string }[] = [
  { id: 'pipeline', label: 'Pipelines' },
  { id: 'macro', label: 'Macros' },
]

const matches = (entry: LibraryEntry, query: string) => {
  if (!query) return true
  const q = query.toLowerCase()
  return entry.name.toLowerCase().includes(q) || (entry.description ?? '').toLowerCase().includes(q)
}

const errorText = (err: unknown) => (err as any)?.message || String(err)

/** Browser storage holds a few MB, so a far bigger file cannot be a library export; don't read it into memory. */
const MAX_IMPORT_BYTES = 25 * 1024 * 1024

/** `File.text()` is missing in older engines (and jsdom); FileReader works everywhere. */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === 'function') return file.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read that file.'))
    reader.readAsText(file)
  })
}

export default function LibraryDialog({ onClose, initialTab = 'pipeline', returnFocus }: LibraryDialogProps) {
  const { state, dispatch, input, setInput } = useTool()
  const [tab, setTab] = useState<EntryKind>(initialTab)
  const [query, setQuery] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [saveName, setSaveName] = useState(state.name ?? '')
  // overwriting an entry that was saved with its input keeps doing so unless unticked
  const [saveInputToo, setSaveInputToo] = useState(() => !!state.libraryId && getEntry(state.libraryId)?.input !== undefined)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  // Enter/Escape unmount the rename field; focus goes back to that entry's rename button
  const renameButtons = useRef(new Map<string, HTMLButtonElement>())
  // set when Escape cancels a rename, so the blur that follows does not commit it
  const renameCancelled = useRef(false)

  const entries = useLibrary(tab)
  const filtered = useMemo(() => entries.filter(e => matches(e, query)), [entries, query])
  const bytesInput = isBytes(input)

  /** Run a library write, turning a refused write (storage full) into a readable message. */
  const attempt = (fn: () => void) => {
    setError(null)
    try { fn() } catch (err) { setStatus(null); setError(errorText(err)) }
  }

  /** Would loading something else lose work? Not when the editor holds an unchanged library entry. */
  const hasUnsavedChanges = () => {
    if (!state.steps.length) return false
    const loaded = state.libraryId ? getEntry(state.libraryId) : undefined
    return !(loaded && sameSteps(loaded.steps, state.steps))
  }

  const loadEntry = (entry: LibraryEntry) => {
    if (hasUnsavedChanges() && !sameSteps(state.steps, entry.steps)) {
      const ok = window.confirm(`Load "${entry.name}"? This replaces your current pipeline, which has unsaved changes.`)
      if (!ok) return
    }
    dispatch({ type: 'LOAD', steps: entry.steps, name: entry.name, libraryId: entry.id })
    if (entry.input !== undefined) setInput(entry.input)
    track('pipeline_load', { method: 'library', step_count: countSteps(entry.steps) })
    onClose()
  }

  const insertMacro = (entry: LibraryEntry) => {
    dispatch({
      type: 'INSERT_STEPS',
      steps: [{ id: stepId('macro'), type: 'macro', name: entry.name, steps: entry.steps, macroId: entry.id, enabled: true }],
    })
    track('pipeline_load', { method: 'library_macro', step_count: countSteps(entry.steps) })
    onClose()
  }

  const startRename = (entry: LibraryEntry) => {
    renameCancelled.current = false
    setRenamingId(entry.id)
    setRenameValue(entry.name)
  }
  const commitRename = (id: string) => {
    if (renameCancelled.current) return
    renameCancelled.current = true // Enter commits, then the unmount blur must not commit again
    const v = renameValue.trim()
    setRenamingId(null)
    if (!v) return
    attempt(() => {
      renameEntry(id, v)
      if (id === state.libraryId) dispatch({ type: 'SET_META', name: v.slice(0, 120), libraryId: id })
    })
  }
  const cancelRename = () => {
    renameCancelled.current = true
    setRenamingId(null)
  }
  const focusRenameButton = (id: string) => renameButtons.current.get(id)?.focus()

  const duplicateEntry = (entry: LibraryEntry) => attempt(() => {
    saveEntry({ kind: entry.kind, name: `${entry.name} copy`, description: entry.description, steps: entry.steps, input: entry.input })
    setStatus(`Duplicated “${entry.name}”.`)
  })

  const removeEntry = (entry: LibraryEntry) => {
    if (!window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) return
    // the focused delete button is about to disappear; keep keyboard users inside the dialog
    searchRef.current?.focus()
    attempt(() => {
      deleteEntry(entry.id)
      // the editor keeps its steps but is no longer linked to a library entry
      if (entry.id === state.libraryId) dispatch({ type: 'SET_META', name: state.name, libraryId: undefined })
      setStatus(`Deleted “${entry.name}”.`)
    })
  }

  const doSave = (mode: 'save' | 'saveAsNew') => attempt(() => {
    const name = saveName.trim() || 'untitled pipeline'
    const entry = saveEntry({
      id: mode === 'save' ? state.libraryId : undefined,
      kind: 'pipeline',
      name,
      steps: state.steps,
      ...(saveInputToo && !bytesInput ? { input: asText(input) } : {}),
    })
    dispatch({ type: 'SET_META', name: entry.name, libraryId: entry.id })
    setSaveName(entry.name)
    setStatus(`Saved “${entry.name}”.`)
    track('pipeline_save', {
      save_mode: mode === 'save' && state.libraryId ? 'update' : 'new',
      include_input: saveInputToo && !bytesInput ? 'yes' : 'no',
      step_count: countSteps(state.steps),
    })
  })

  const exportAll = () => attempt(() => downloadText('sub-library.json', exportLibrary()))

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setStatus(null)
    if (file.size > MAX_IMPORT_BYTES) {
      setError('That file is too large to be a String Utility Belt library export.')
      return
    }
    try {
      const { added, skipped } = importLibrary(await readFileText(file), 'merge')
      setStatus(`Imported ${added}, skipped ${skipped} (already in your library or unreadable).`)
    } catch (err) {
      setError(errorText(err))
    }
  }

  const panelId = 'library-panel'
  return (
    <Dialog title="Library" onClose={onClose} returnFocus={returnFocus}>
      <Tabs label="library sections" tabs={TABS} value={tab} onChange={setTab} panelId={panelId} idPrefix="library-tab" />

      <div id={panelId} role="tabpanel" aria-labelledby={`library-tab-${tab}`} className="grid gap-3">
        {/* the input itself is unstyled, and `.field`'s ring is `:focus` on this wrapper div,
            which never matches — ring the wrapper while the input inside has focus instead */}
        <div className="field flex items-center gap-2 py-1.5 focus-within:ring-2 focus-within:ring-primary-500">
          <Search size={16} className="text-muted shrink-0" aria-hidden />
          <input
            ref={searchRef}
            className="bg-transparent outline-hidden flex-1 text-sm"
            placeholder={`search ${tab === 'pipeline' ? 'pipelines' : 'macros'}…`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label={`search ${tab === 'pipeline' ? 'pipelines' : 'macros'}`}
          />
        </div>

        <ul className="grid gap-2 max-h-64 overflow-auto" aria-label={`${tab} list`}>
          {filtered.length === 0 && (
            <li className="muted text-sm">
              {query ? 'no matches' : tab === 'macro' ? 'no macros yet — group steps into a macro to save one' : 'nothing here yet'}
            </li>
          )}
          {filtered.map(entry => (
            <li key={entry.id} className="card p-3 flex items-center gap-2 flex-wrap">
              <div className="min-w-0 flex-1">
                {renamingId === entry.id ? (
                  <input
                    autoFocus
                    className="field text-sm w-full"
                    value={renameValue}
                    maxLength={120}
                    aria-label={`rename ${entry.name}`}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') { e.preventDefault(); commitRename(entry.id); focusRenameButton(entry.id) }
                      // consumed here: Escape cancels the rename, it does not close the dialog
                      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelRename(); focusRenameButton(entry.id) }
                    }}
                    onBlur={() => commitRename(entry.id)}
                  />
                ) : (
                  <div className="truncate font-medium" title={entry.name}>{entry.name}</div>
                )}
                <div className="text-xs text-muted">
                  {entry.id === state.libraryId && <span className="chip mr-1">open</span>}
                  updated <time dateTime={new Date(entry.updatedAt).toISOString()}>{relativeTime(entry.updatedAt)}</time>
                  {entry.input !== undefined && ' · with input'}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {tab === 'macro' ? (
                  <button className="btn" onClick={() => insertMacro(entry)} aria-label={`Insert ${entry.name}`}>Insert</button>
                ) : (
                  <button className="btn" onClick={() => loadEntry(entry)} aria-label={`Load ${entry.name}`}>Load</button>
                )}
                <button
                  ref={el => { if (el) renameButtons.current.set(entry.id, el); else renameButtons.current.delete(entry.id) }}
                  className="icon-btn"
                  aria-label={`rename ${entry.name}`}
                  onClick={() => startRename(entry)}
                >
                  <Pencil size={16} />
                </button>
                <button className="icon-btn" aria-label={`duplicate ${entry.name}`} onClick={() => duplicateEntry(entry)}><Copy size={16} /></button>
                <button className="icon-btn text-danger" aria-label={`delete ${entry.name}`} onClick={() => removeEntry(entry)}><Trash2 size={16} /></button>
              </div>
            </li>
          ))}
        </ul>

        {tab === 'pipeline' && (
          <div className="card p-3 grid gap-2">
            <div className="font-medium text-sm">Save current pipeline</div>
            <input
              className="field text-sm"
              placeholder="pipeline name"
              value={saveName}
              maxLength={120}
              onChange={e => setSaveName(e.target.value)}
              aria-label="pipeline name to save"
            />
            <label className="text-sm flex items-center gap-2">
              <input
                type="checkbox"
                checked={saveInputToo && !bytesInput}
                disabled={bytesInput}
                onChange={e => setSaveInputToo(e.target.checked)}
              />
              save input with pipeline
            </label>
            {bytesInput && <div className="text-xs text-muted">binary input can&apos;t be saved with the pipeline.</div>}
            <div className="flex gap-2">
              <button
                className="btn"
                disabled={!state.libraryId}
                title={state.libraryId ? 'overwrite the library entry this pipeline was loaded from' : 'load or save a pipeline first'}
                onClick={() => doSave('save')}
              >
                Save
              </button>
              <button className="cta" onClick={() => doSave('saveAsNew')}>Save as new</button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
        <button className="btn" onClick={exportAll}><Download size={16} /> export all</button>
        <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} /> import</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} onChange={onImportFile} aria-label="import library file" />
      </div>
      <div role="status" aria-live="polite" className="text-sm min-h-5">
        {status && <span className="text-success inline-flex items-center gap-1"><Check size={14} aria-hidden /> {status}</span>}
      </div>
      {error && <div role="alert" className="text-sm text-danger inline-flex items-center gap-1"><X size={14} aria-hidden /> {error}</div>}
      <p className="text-xs text-muted flex items-center gap-1"><PlusSquare size={12} aria-hidden /> macros are saved from a step group elsewhere in the editor; this dialog only manages them.</p>
    </Dialog>
  )
}
