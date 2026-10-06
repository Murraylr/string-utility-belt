import React, { useEffect, useMemo, useState } from 'react'
import type { Value } from '@/types/utility'
import { isBytes } from '@/core/coerce'
import { decodeUtf8Prefix, looksLikeText } from './bytes'
import { detectKind, type OutputKind } from './detectKind'
import HexView from './HexView'
import { useDarkMode } from './useDarkMode'

/** Rough proxy for "output over ~1 MB": UTF-16 length, cheap to check before committing to CodeMirror. */
const MAX_HIGHLIGHT_CHARS = 1024 * 1024
/** The text view of a bytes value renders at most this much; copy/download still get all of it. */
const MAX_BYTES_AS_TEXT = 1024 * 1024

type CmModule = typeof import('@uiw/react-codemirror')
let cmModulePromise: Promise<CmModule> | null = null
function loadCodeMirror(): Promise<CmModule> {
  if (!cmModulePromise) cmModulePromise = import('@uiw/react-codemirror')
  return cmModulePromise
}

async function loadLanguageExtension(kind: OutputKind) {
  switch (kind) {
    case 'json': return (await import('@codemirror/lang-json')).json()
    case 'xml': return (await import('@codemirror/lang-xml')).xml()
    case 'html': return (await import('@codemirror/lang-html')).html()
    case 'sql': return (await import('@codemirror/lang-sql')).sql()
    case 'yaml': return (await import('@codemirror/lang-yaml')).yaml()
    case 'markdown': return (await import('@codemirror/lang-markdown')).markdown()
    default: return null
  }
}

/**
 * Module-level so its identity never changes: @uiw/react-codemirror reconfigures the whole
 * editor (re-highlighting the document) whenever `basicSetup` or `extensions` is a new object.
 */
const BASIC_SETUP = { lineNumbers: true, foldGutter: false } as const

const PRE_CLASS = 'mono whitespace-pre-wrap wrap-anywhere border rounded-2xl p-3 bg-surface min-h-[160px] max-h-128 overflow-auto'

export interface OutputViewProps {
  value: Value
  text: string
  /** Accessible name of the highlighted editor. */
  label?: string
}

/** Renders a pipeline value: hex/text toggle for bytes, syntax-highlighted read-only CodeMirror for text/json. */
export default function OutputView({ value, text, label = 'output' }: OutputViewProps) {
  const dark = useDarkMode()
  if (isBytes(value)) return <BytesView bytes={value} />
  return <HighlightedText value={value} text={text} dark={dark} label={label} />
}

function BytesView({ bytes }: { bytes: Uint8Array }) {
  // null: follow the content (text-like bytes as text, anything else as hex) until the user picks
  const [chosen, setChosen] = useState<'text' | 'hex' | null>(null)
  const auto = useMemo(() => (looksLikeText(bytes) ? 'text' : 'hex'), [bytes])
  const view = chosen ?? auto
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2" role="group" aria-label="show bytes as">
        <button type="button" className="btn" aria-pressed={view === 'text'} onClick={() => setChosen('text')}>text</button>
        <button type="button" className="btn" aria-pressed={view === 'hex'} onClick={() => setChosen('hex')}>hex</button>
      </div>
      {view === 'hex' ? <HexView bytes={bytes} /> : <BytesAsText bytes={bytes} />}
    </div>
  )
}

function BytesAsText({ bytes }: { bytes: Uint8Array }) {
  // memoised and capped: the panel re-renders on run-state flips, and a multi-megabyte <pre> freezes the page
  const decoded = useMemo(() => decodeUtf8Prefix(bytes, MAX_BYTES_AS_TEXT), [bytes])
  const cut = bytes.length > MAX_BYTES_AS_TEXT
  return (
    <>
      <pre className={PRE_CLASS} tabIndex={0}>{decoded}</pre>
      {cut && (
        <p className="muted text-xs">
          showing the first 1 MB of {bytes.length.toLocaleString()} bytes — copy or download for all of it
        </p>
      )}
    </>
  )
}

function HighlightedText({ value, text, dark, label }: { value: Value; text: string; dark: boolean; label: string }) {
  const tooBig = text.length > MAX_HIGHLIGHT_CHARS
  // detection parses JSON / scans every line, so it is skipped for outputs that won't be highlighted anyway
  const kind = useMemo<OutputKind>(() => (tooBig ? 'text' : detectKind(value, text)), [value, text, tooBig])
  // undetected/plain text has no grammar to highlight — skip CodeMirror entirely rather than pay
  // for an editor mount that renders identically to a <pre>, but with its text split across nodes
  const plain = kind === 'text'
  const [cm, setCm] = useState<CmModule | null>(null)
  const [extension, setExtension] = useState<unknown>(null)
  const [failed, setFailed] = useState(false)

  // clear a stale failure during render on a kind change (React's documented "adjusting state
  // on a prop change" pattern), rather than a setState call inside the load effect below
  const [lastKind, setLastKind] = useState(kind)
  if (lastKind !== kind) {
    setLastKind(kind)
    if (failed) setFailed(false)
  }

  useEffect(() => {
    if (plain) return undefined
    let cancelled = false
    Promise.all([loadCodeMirror(), loadLanguageExtension(kind)])
      .then(([mod, ext]) => {
        if (cancelled) return
        setCm(mod)
        setExtension(ext)
      })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [kind, plain])

  const extensions = useMemo(() => {
    const list: unknown[] = []
    if (extension) list.push(extension)
    // the editor's content element is the focusable textbox: it needs its own name
    if (cm && 'EditorView' in cm) list.push(cm.EditorView.contentAttributes.of({ 'aria-label': label }))
    return list as never[]
  }, [cm, extension, label])

  if (plain || failed || !cm) {
    return <pre className={PRE_CLASS} tabIndex={0}>{text}</pre>
  }

  const CodeMirror = cm.default
  return (
    <div className="border rounded-2xl overflow-hidden" data-testid="output-codemirror">
      {/* readOnly (not editable={false}) keeps the editor focusable, so keyboard users can move and select */}
      <CodeMirror
        value={text}
        readOnly
        theme={dark ? 'dark' : 'light'}
        extensions={extensions}
        basicSetup={BASIC_SETUP}
        maxHeight="32rem"
      />
    </div>
  )
}
