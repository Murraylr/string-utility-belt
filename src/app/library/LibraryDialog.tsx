import React, { useMemo, useRef, useState } from 'react'
import { Check, Copy, Download, Search, Pencil, Trash2, Upload, X } from 'lucide-react'
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
  const rowButton = 'h-[26px] px-[9px] border rounded-[5px] bg-surface text-[12.5px] hover:bg-surface-2'
  const rowIcon = 'grid place-items-center size-[26px] rounded-[5px] text-muted hover:bg-surface-2 hover:text-fg'
  return (
    <Dialog title="Library" widthClass="max-w-[540px]" onClose={onClose} returnFocus={returnFocus}>
      <Tabs label="library sections" tabs={TABS} value={tab} onChange={setTab} panelId={panelId} idPrefix="library-tab" />

      <div id={panelId} role="tabpanel" aria-labelledby={`library-tab-${tab}`} className="grid gap-3">
        {tab === 'pipeline' ? (
          <div className="grid gap-2">
            <div className="flex flex-wrap gap-1.5">
              <input
                className="field flex-1 min-w-40 h-[30px]"
                placeholder="Pipeline name"
                value={saveName}
                maxLength={120}
                onChange={e => setSaveName(e.target.value)}
                aria-label="pipeline name to save"
              />
              {/* the button that does what the user most likely wants is the filled one */}
              <button
                className={`${state.libraryId ? 'btn-inv' : 'btn'} h-[30px]`}
                disabled={!state.libraryId}
                title={state.libraryId ? 'Overwrite the library entry this pipeline was loaded from' : 'Load or save a pipeline first'}
                onClick={() => doSave('save')}
              >
                Save
              </button>
              <button className={`${state.libraryId ? 'btn' : 'btn-inv'} h-[30px]`} onClick={() => doSave('saveAsNew')}>Save as new</button>
            </div>
            <label className="flex items-center gap-2 text-[13px] cursor-pointer has-[:disabled]:cursor-default">
              <input
                type="checkbox"
                className="accent-acc"
                checked={saveInputToo && !bytesInput}
                disabled={bytesInput}
                onChange={e => setSaveInputToo(e.target.checked)}
              />
              Save input with pipeline
            </label>
            <p className="m-0 text-xs text-muted">
              {bytesInput && 'Binary input can\'t be saved with the pipeline. '}
              Save updates the pipeline you loaded. Save as new adds another entry. Pipelines stay in this browser.
            </p>
          </div>
        ) : (
          <p className="m-0 text-xs text-muted">Select steps in the editor, then choose Save as macro. Insert adds a macro as one step.</p>
        )}

        <div className="field h-[30px] flex items-center gap-2 focus-within:border-acc">
          <Search size={14} className="text-muted shrink-0" aria-hidden />
          <input
            ref={searchRef}
            className="bg-transparent outline-hidden flex-1 min-w-0 text-[13px]"
            placeholder={`Search ${tab === 'pipeline' ? 'pipelines' : 'macros'}`}
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label={`search ${tab === 'pipeline' ? 'pipelines' : 'macros'}`}
          />
        </div>

        <ul className="m-0 p-0 list-none border rounded-md max-h-[300px] overflow-auto" aria-label={`${tab} list`}>
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-[12.5px] text-muted">
              {query
                ? 'Nothing matches that search.'
                : tab === 'macro'
                  ? 'No macros yet. Select steps, then choose Save as macro.'
                  : 'Nothing saved yet. Name the current pipeline above and save it.'}
            </li>
          )}
          {filtered.map(entry => {
            const n = countSteps(entry.steps)
            return (
              <li key={entry.id} className="flex items-center gap-1.5 py-[9px] pl-3 pr-2 border-b last:border-b-0">
                <div className="min-w-0 flex-1 grid">
                  {renamingId === entry.id ? (
                    <input
                      autoFocus
                      className="field h-7 w-full"
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
                    <div className="truncate text-[13px] font-medium" title={entry.name}>{entry.name}</div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-1 font-mono text-[11px] text-muted">
                    {entry.id === state.libraryId && <span className="chip text-acc border-acc">open</span>}
                    <span>
                      {n} step{n === 1 ? '' : 's'} · <time dateTime={new Date(entry.updatedAt).toISOString()}>{relativeTime(entry.updatedAt)}</time>
                      {entry.input !== undefined && ' · with input'}
                    </span>
                  </div>
                </div>
                {tab === 'macro' ? (
                  <button className={rowButton} onClick={() => insertMacro(entry)} aria-label={`Insert ${entry.name}`}>Insert</button>
                ) : (
                  <button className={rowButton} onClick={() => loadEntry(entry)} aria-label={`Load ${entry.name}`}>Load</button>
                )}
                <button
                  ref={el => { if (el) renameButtons.current.set(entry.id, el); else renameButtons.current.delete(entry.id) }}
                  className={rowIcon}
                  aria-label={`rename ${entry.name}`}
                  onClick={() => startRename(entry)}
                >
                  <Pencil size={13} aria-hidden />
                </button>
                <button className={rowIcon} aria-label={`duplicate ${entry.name}`} onClick={() => duplicateEntry(entry)}><Copy size={13} aria-hidden /></button>
                <button className={`${rowIcon} hover:text-danger`} aria-label={`delete ${entry.name}`} onClick={() => removeEntry(entry)}><Trash2 size={13} aria-hidden /></button>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <button className="btn-ghost" onClick={() => fileRef.current?.click()}><Upload size={13} aria-hidden /> Import .json</button>
        <button className="btn-ghost" onClick={exportAll}><Download size={13} aria-hidden /> Export all</button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" tabIndex={-1} onChange={onImportFile} aria-label="import library file" />
      </div>
      <div role="status" aria-live="polite" className="text-[12.5px] text-add-ink">
        {status && <span className="inline-flex items-center gap-1"><Check size={13} aria-hidden /> {status}</span>}
      </div>
      {error && <div role="alert" className="text-[12.5px] text-danger-ink inline-flex items-center gap-1"><X size={13} aria-hidden /> {error}</div>}
    </Dialog>
  )
}
