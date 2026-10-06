import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clipboard, FileUp, Link as LinkIcon } from 'lucide-react'
import { asText, isBytes } from '@/core/coerce'
import type { Value } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import { usePref } from '@/app/prefs'
import { trackInput } from '@/app/analytics/analytics'
import { decodeUtf8Lossy } from '@/app/io/bytes'
import FetchUrlDialog, { type FetchedMeta } from '@/app/io/FetchUrlDialog'
import { readFileAsInput, type FileInputMeta } from '@/app/io/fileInput'
import { formatOffset, hexDumpRows } from '@/app/io/hex'
import { HISTORY_PREF, saveHistory } from '@/app/io/history'
import HistoryMenu from '@/app/io/HistoryMenu'
import { computeLineCol, lineStartOffset, totalLines } from '@/app/io/lineCol'
import StatsBar from '@/app/io/StatsBar'
import { scrollTextareaTo } from '@/app/io/textareaScroll'

const BINARY_PREVIEW_BYTES = 256
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

/**
 * React bubbles events through portals, so a paste/drop in the (portalled) fetch dialog would
 * otherwise reach the panel's handlers; only events from the panel's own DOM count.
 */
const fromPanel = (e: React.SyntheticEvent) => e.currentTarget.contains(e.target as Node)

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
  const [caret, setCaret] = useState(0)
  const [goToLine, setGoToLine] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const goToLineRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  const applyFile = useCallback(async (file: File, via: 'file' | 'drop' | 'paste_file'): Promise<boolean> => {
    const seq = ++readSeq.current
    try {
      const result = await readFileAsInput(file)
      if (seq !== readSeq.current) return false
      setSource({ value: result.value, data: result.meta })
      setError(null)
      setInput(result.value)
      trackInput(via, result.value)
      return true
    } catch {
      if (seq === readSeq.current) setError(`could not read ${file.name || 'that file'}`)
      return false
    }
  }, [setInput])

  const onFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) applyFile(file, 'file')
  }

  const onDrop = (e: React.DragEvent) => {
    setDragOver(false)
    if (!fromPanel(e)) return
    const file = e.dataTransfer?.files?.[0]
    if (!file) return // plain text drops: let the textarea insert the text natively
    e.preventDefault()
    applyFile(file, 'drop')
  }
  const onDragOver = (e: React.DragEvent) => {
    if (!fromPanel(e) || !hasFiles(e.dataTransfer)) return
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
    if (!fromPanel(e)) return
    const file = pastedFile(e.clipboardData)
    if (!file) return
    e.preventDefault()
    applyFile(file, 'paste_file').then(ok => { if (ok) runIfManual() })
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
      trackInput('paste', e.target.value)
      runIfManual()
    }
  }
  const trackCaret = (e: React.SyntheticEvent<HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart ?? 0)

  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.readText) {
      setError('the clipboard is not available here — paste with Ctrl+V instead')
      return
    }
    try {
      const pasted = await navigator.clipboard.readText()
      setInput(pasted)
      setCaret(pasted.length)
      setError(null)
      trackInput('clipboard_button', pasted)
      runIfManual()
    } catch (err) {
      setError((err as Error)?.name === 'NotAllowedError'
        ? 'clipboard permission was denied'
        : `could not read the clipboard: ${(err as Error)?.message || 'unknown error'}`)
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
      ? { value: decoded, data: 'decoded as UTF-8 — invalid bytes were replaced with the � replacement character' }
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
    trackInput('history', restored)
  }

  const onFetched = (value: Value, meta: FetchedMeta) => {
    setInput(value)
    setError(null)
    trackInput('url', value)
    setSource(isBytes(value)
      ? { value, data: { name: nameFromUrl(meta.url), size: value.length, mime: meta.contentType ?? '' } }
      : null)
  }

  return (
    <div
      className={`grid gap-2 rounded-2xl transition ${dragOver ? 'ring-2 ring-primary-500' : ''}`}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onPaste={onPanelPaste}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {binary ? <span className="muted">input</span> : <label className="muted" htmlFor="pipeline-input">input</label>}
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}><FileUp size={16} /> open file</button>
          <button type="button" className="btn" onClick={() => setFetchOpen(true)}><LinkIcon size={16} /> fetch URL</button>
          {!binary && (
            <button type="button" className="btn" onClick={pasteFromClipboard}><Clipboard size={16} /> paste</button>
          )}
          <HistoryMenu onRestore={restoreFromHistory} />
        </div>
      </div>
      <input ref={fileInputRef} type="file" hidden onChange={onFileChosen} aria-label="choose a file to use as input" />

      {error && <div role="alert" className="text-sm text-danger">{error}</div>}
      {decodeWarning && <div role="status" className="text-sm text-warn">{decodeWarning}</div>}

      {binary ? (
        <div className="border rounded-2xl p-3 min-h-[160px] bg-surface grid gap-2">
          <div className="text-sm">
            <span className="font-medium">{fileMeta?.name ?? 'binary input'}</span>{' '}
            <span className="muted">
              · {input.length.toLocaleString()} bytes{fileMeta?.mime ? ` · ${fileMeta.mime}` : ''}
            </span>
          </div>
          <div className="mono text-xs overflow-auto" role="group" aria-label="hex preview, first 256 bytes">
            {hexDumpRows(input, 0, Math.min(BINARY_PREVIEW_BYTES, input.length)).map(r => (
              <div key={r.offset} className="whitespace-pre">
                <span className="text-muted">{formatOffset(r.offset)}</span>{'  '}
                <span>{r.hex.padEnd(16 * 3 - 1, ' ')}</span>{'  '}
                <span className="text-muted">{r.ascii}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={treatAsText}>treat as text</button>
            <button type="button" className="btn" onClick={clear}>clear</button>
          </div>
        </div>
      ) : (
        <>
          <textarea
            id="pipeline-input"
            ref={textareaRef}
            className="border rounded-2xl p-3 min-h-[160px] focus:ring-3 focus:ring-[#3b82f680] outline-hidden mono bg-surface text-fg shadow-soft"
            placeholder="type or paste your text here…"
            value={text}
            onChange={onChange}
            onPaste={onTextPaste}
            onSelect={trackCaret}
            onKeyUp={trackCaret}
            onClick={trackCaret}
            onKeyDown={onKeyDown}
          />
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <span className="muted">Ln {lineCol.line}, Col {lineCol.col}</span>
            {goToOpen ? (
              <label className="flex items-center gap-1">
                go to line
                <input
                  ref={goToLineRef}
                  type="number"
                  min={1}
                  max={totalLines(text)}
                  className="field w-20 py-0.5"
                  value={goToLine ?? ''}
                  onChange={e => setGoToLine(e.target.value)}
                  onKeyDown={onGoToLineKeyDown}
                  onBlur={() => setGoToLine(null)}
                />
              </label>
            ) : (
              <span className="muted">Ctrl+G: go to line</span>
            )}
            {!liveRun && (
              <label className="flex items-center gap-1 muted ml-auto">
                <input type="checkbox" checked={autoRunOnPaste} onChange={e => setAutoRunOnPaste(e.target.checked)} />
                auto-run on paste
              </label>
            )}
          </div>
        </>
      )}
      <StatsBar value={input} compact />
      <FetchUrlDialog open={fetchOpen} onClose={() => setFetchOpen(false)} onFetched={onFetched} />
    </div>
  )
}
