import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clipboard, FileUp, Globe } from 'lucide-react'
import { asText, isBytes, valueType } from '@/core/coerce'
import type { Value } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import { usePref } from '@/app/prefs'
import { decodeUtf8Lossy } from '@/app/io/bytes'
import FetchUrlForm, { type FetchedMeta } from '@/app/io/FetchUrlForm'
import { readFileAsInput, type FileInputMeta } from '@/app/io/fileInput'
import { formatOffset, hexDumpRows } from '@/app/io/hex'
import { HISTORY_PREF, saveHistory } from '@/app/io/history'
import HistoryMenu from '@/app/io/HistoryMenu'
import { computeLineCol, lineStartOffset, totalLines } from '@/app/io/lineCol'
import StatsBar from '@/app/io/StatsBar'
import { scrollTextareaTo } from '@/app/io/textareaScroll'

const BINARY_PREVIEW_BYTES = 256
const TYPE_LABEL = { string: 'text', json: 'json', bytes: 'bytes' } as const
const HISTORY_DEBOUNCE_MS = 2000

/** History is best-effort: a failed save must never surface as an unhandled rejection. */
const ignore = () => { /* nothing to recover */ }

/** A note tied to one exact input value, so it disappears once the input changes. */
interface Pinned<T> { value: Value; data: T }

const hasFiles = (dt: DataTransfer | null) => !!dt && Array.from(dt.types ?? []).includes('Files')

/**
 * The file a paste should load, or null for a text paste. Office apps (Excel, Word) put a
 * snapshot image next to the copied text, so text wins — unless it is only the file's name or
 * path, which is what a copy in the OS file manager puts beside the file.
 */
function pastedFile(dt: DataTransfer | null): File | null {
  const file = dt?.files?.[0]
  if (!file) return null
  const text = (dt?.getData('text/plain') ?? '').trim()
  const isJustTheName = text === '' || text === file.name || text.endsWith(`/${file.name}`) || text.endsWith(`\\${file.name}`)
  return isJustTheName ? file : null
}

function nameFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const last = u.pathname.split('/').filter(Boolean).pop()
    if (!last) return u.hostname
    try { return decodeURIComponent(last) } catch { return last }
  } catch {
    return url
  }
}

/** The pipeline's source value: text edited inline, or a summarised binary/file input. */
export default function InputPanel() {
  const { input, setInput, run, liveRun } = useTool()
  const [autoRunOnPaste, setAutoRunOnPaste] = usePref('autoRunOnPaste', true)
  // shared with HistoryMenu's "remember inputs" switch
  const [historyOn] = usePref(HISTORY_PREF, true)

  const [source, setSource] = useState<Pinned<FileInputMeta> | null>(null)
  const [warning, setWarning] = useState<Pinned<string> | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fetchOpen, setFetchOpen] = useState(false)
  // kept here, not in the form, so a closed and reopened row still holds the last URL tried
  const [fetchUrl, setFetchUrl] = useState('')
  const [caret, setCaret] = useState(0)
  const [goToLine, setGoToLine] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const goToLineRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const fetchButtonRef = useRef<HTMLButtonElement>(null)
  const fetchError = useRef<string | null>(null)
  const focusAfterFetch = useRef<'input' | 'button' | null>(null)
  const textPasteFlag = useRef(false)
  const readSeq = useRef(0)
  const lastResult = useRef(run.result)

  const binary = isBytes(input)
  const text = useMemo(() => (typeof input === 'string' ? input : binary ? '' : asText(input)), [input, binary])
  // the caret offset is clamped so an input replaced from elsewhere never reports a line past its end
  const lineCol = useMemo(() => computeLineCol(text, Math.min(caret, text.length)), [text, caret])
  const fileMeta = source && source.value === input ? source.data : null
  const decodeWarning = warning && warning.value === input ? warning.data : null

  // Save to history 2s after typing stops, and after every completed manual run.
  useEffect(() => {
    if (!historyOn || typeof input !== 'string' || input === '') return undefined
    const timer = setTimeout(() => { saveHistory(input).catch(ignore) }, HISTORY_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input, historyOn])
  useEffect(() => {
    // in manual mode a new result object means a run the user asked for just finished
    if (run.result === lastResult.current) return
    lastResult.current = run.result
    if (historyOn && !liveRun && typeof input === 'string' && input !== '') saveHistory(input).catch(ignore)
  }, [run.result, liveRun, input, historyOn])

  const runIfManual = useCallback(() => {
    if (autoRunOnPaste && !liveRun) run.runNow()
  }, [autoRunOnPaste, liveRun, run])

  /** Reads a file into the input; only the most recently requested file may land. */
  const applyFile = useCallback(async (file: File): Promise<boolean> => {
    const seq = ++readSeq.current
    try {
      const result = await readFileAsInput(file)
      if (seq !== readSeq.current) return false
      setSource({ value: result.value, data: result.meta })
      setError(null)
      setInput(result.value)
      return true
    } catch {
      if (seq === readSeq.current) setError(`Couldn't read ${file.name || 'that file'}.`)
      return false
    }
  }, [setInput])

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) applyFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return // plain text drops: let the textarea insert the text natively
    e.preventDefault()
    applyFile(file)
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!hasFiles(e.dataTransfer)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!dragOver) setDragOver(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    // dragleave also fires when moving onto a child; only a real exit clears the highlight
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false)
  }

  // Files pasted anywhere in the panel (the textarea, or the binary view's buttons).
  const onPanelPaste = (e: React.ClipboardEvent) => {
    const file = pastedFile(e.clipboardData)
    if (!file) return
    e.preventDefault()
    applyFile(file).then(ok => { if (ok) runIfManual() })
  }
  const onTextPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (pastedFile(e.clipboardData)) return // a file: the panel handler takes it
    // the pasted text lands via the 'input' event dispatched in this same task; flag it for
    // onChange, and disarm afterwards so a paste that changed nothing can't tag the next keystroke
    textPasteFlag.current = true
    setTimeout(() => { textPasteFlag.current = false }, 0)
  }

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    setCaret(e.target.selectionStart ?? e.target.value.length)
    if (textPasteFlag.current) {
      textPasteFlag.current = false
      runIfManual()
    }
  }
  const trackCaret = (e: React.SyntheticEvent<HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart ?? 0)

  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setError('The clipboard isn\'t available here. Paste with Ctrl+V instead.')
      return
    }
    try {
      const pasted = await navigator.clipboard.readText()
      setInput(pasted)
      setCaret(pasted.length)
      setError(null)
      runIfManual()
    } catch (err) {
      setError((err as Error)?.name === 'NotAllowedError'
        ? 'The browser blocked clipboard access. Paste with Ctrl+V instead.'
        : `Couldn't read the clipboard: ${(err as Error)?.message || 'unknown error'}`)
    }
  }

  const goToOpen = goToLine !== null
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === 'g') {
      e.preventDefault()
      setGoToLine(String(lineCol.line))
    }
  }
  useEffect(() => {
    if (!goToOpen) return
    goToLineRef.current?.focus()
    goToLineRef.current?.select()
  }, [goToOpen])

  const commitGoToLine = () => {
    const n = parseInt(goToLine ?? '', 10)
    const el = textareaRef.current
    if (el && Number.isFinite(n) && n >= 1) {
      const offset = lineStartOffset(text, n)
      el.focus()
      scrollTextareaTo(el, offset)
      el.setSelectionRange(offset, offset)
      setCaret(offset)
    }
    setGoToLine(null)
  }
  const onGoToLineKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitGoToLine() }
    else if (e.key === 'Escape') { e.preventDefault(); setGoToLine(null); textareaRef.current?.focus() }
  }

  const treatAsText = () => {
    if (!isBytes(input)) return
    const decoded = decodeUtf8Lossy(input)
    setWarning(decoded.includes('�')
      ? { value: decoded, data: 'Decoded as UTF-8. Invalid bytes became the � replacement character.' }
      : null)
    setInput(decoded)
  }

  const clear = () => {
    setInput('')
    setSource(null)
    setWarning(null)
    setError(null)
  }

  const restoreFromHistory = (restored: string) => {
    setInput(restored)
    setCaret(restored.length)
    setError(null)
  }

  /** Closes the fetch row; a fetch error it showed goes with it. */
  const closeFetch = (focus: 'input' | 'button' | null) => {
    focusAfterFetch.current = focus
    setFetchOpen(false)
    const shown = fetchError.current
    fetchError.current = null
    if (shown !== null) setError(e => (e === shown ? null : e))
  }
  // after the commit that removed the row, when a fetched text input's textarea exists
  useEffect(() => {
    if (fetchOpen) return
    const target = focusAfterFetch.current
    focusAfterFetch.current = null
    // binary input has no textarea; the button is the next best place
    if (target === 'input') (textareaRef.current ?? fetchButtonRef.current)?.focus()
    else if (target === 'button') fetchButtonRef.current?.focus()
  }, [fetchOpen])
  const toggleFetch = () => {
    if (fetchOpen) closeFetch(null) // the click already focused the button
    else setFetchOpen(true)
  }
  const onFetchError = (message: string | null) => {
    fetchError.current = message
    setError(message)
  }

  const onFetched = (value: Value, meta: FetchedMeta) => {
    setInput(value)
    setError(null)
    setSource(isBytes(value)
      ? { value, data: { name: nameFromUrl(meta.url), size: value.length, mime: meta.contentType ?? '' } }
      : null)
    setFetchUrl('')
    closeFetch('input')
  }

  return (
    <div
      className={`border rounded-lg bg-surface outline-offset-2 focus-within:border-line-2 ${dragOver ? 'outline-2 outline-acc' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onPaste={onPanelPaste}
    >
      <div className="flex flex-wrap items-center gap-1 pl-3.5 pr-1.5 min-h-10 border-b">
        {binary
          ? <span className="text-[13px] font-semibold">Input</span>
          : <label className="text-[13px] font-semibold" htmlFor="pipeline-input">Input</label>}
        <span className="font-mono text-[11px] text-muted pl-1">{TYPE_LABEL[valueType(input)]}</span>
        <div className="flex-1" />
        <button type="button" className="btn-ghost" onClick={() => fileInputRef.current?.click()}><FileUp size={14} aria-hidden /> Open file</button>
        <button ref={fetchButtonRef} type="button" className="btn-ghost" aria-expanded={fetchOpen} onClick={toggleFetch}><Globe size={14} aria-hidden /> Fetch URL</button>
        {!binary && (
          <button type="button" className="btn-ghost" onClick={pasteFromClipboard}><Clipboard size={14} aria-hidden /> Paste</button>
        )}
        <HistoryMenu onRestore={restoreFromHistory} />
      </div>
      <input ref={fileInputRef} type="file" hidden onChange={onFileChosen} aria-label="choose a file to use as input" />
      {fetchOpen && (
        <FetchUrlForm
          url={fetchUrl}
          onUrlChange={setFetchUrl}
          onFetched={onFetched}
          onError={onFetchError}
          onCancel={() => closeFetch('button')}
        />
      )}

      {error && <div role="alert" className="px-3.5 py-2 text-[12.5px] text-danger-ink bg-danger-bg border-b border-danger-line">{error}</div>}
      {decodeWarning && <div role="status" className="px-3.5 py-2 text-[12.5px] text-warn border-b">{decodeWarning}</div>}

      {binary ? (
        <div className="grid gap-2.5 px-4 py-3">
          <div className="text-[13px]">
            <span className="font-medium">{fileMeta?.name ?? 'Binary input'}</span>{' '}
            <span className="text-muted">
              {input.length.toLocaleString()} bytes{fileMeta?.mime ? ` · ${fileMeta.mime}` : ''}
            </span>
          </div>
          <div className="max-h-[200px] overflow-auto font-mono text-xs leading-[19px] text-muted" role="group" aria-label="hex preview, first 256 bytes">
            {hexDumpRows(input, 0, Math.min(BINARY_PREVIEW_BYTES, input.length)).map(r => (
              <div key={r.offset} className="whitespace-pre">
                <span>{formatOffset(r.offset)}</span>{'  '}
                <span className="text-fg">{r.hex.padEnd(16 * 3 - 1, ' ')}</span>{'  '}
                <span>{r.ascii}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button type="button" className="btn h-7 px-2.5 text-[12.5px]" onClick={treatAsText}>Treat as text</button>
            <button type="button" className="btn h-7 px-2.5 text-[12.5px]" onClick={clear}>Clear</button>
          </div>
        </div>
      ) : (
        <textarea
          id="pipeline-input"
          ref={textareaRef}
          className="block w-full min-h-[150px] resize-y border-0 outline-hidden px-4 py-3.5 bg-surface text-fg font-mono text-[13.5px] leading-[22px]"
          placeholder="Type or paste text here, or drop a file on this box"
          spellCheck={false}
          value={text}
          onChange={onChange}
          onPaste={onTextPaste}
          onSelect={trackCaret}
          onKeyUp={trackCaret}
          onClick={trackCaret}
          onKeyDown={onKeyDown}
        />
      )}
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 px-3.5 py-1 min-h-[30px] border-t bg-canvas rounded-b-lg font-mono text-[11px] text-muted">
        {!binary && (
          <>
            <span>Ln {lineCol.line}, Col {lineCol.col}</span>
            {goToOpen ? (
              <label className="flex items-center gap-1.5">
                Go to line
                <input
                  ref={goToLineRef}
                  type="number"
                  min={1}
                  max={totalLines(text)}
                  className="w-16 h-[22px] px-1.5 border rounded-[4px] bg-surface text-fg font-mono text-[11px] outline-hidden focus:border-acc"
                  value={goToLine ?? ''}
                  onChange={e => setGoToLine(e.target.value)}
                  onKeyDown={onGoToLineKeyDown}
                  onBlur={() => setGoToLine(null)}
                />
              </label>
            ) : (
              <span>Ctrl+G go to line</span>
            )}
            {!liveRun && (
              <label className="flex items-center gap-1.5 font-sans text-xs cursor-pointer">
                <input type="checkbox" checked={autoRunOnPaste} onChange={e => setAutoRunOnPaste(e.target.checked)} />
                Run on paste
              </label>
            )}
          </>
        )}
        <StatsBar value={input} className="ml-auto" />
      </div>
    </div>
  )
}
