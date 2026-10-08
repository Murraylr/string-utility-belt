import { Suspense, lazy, useCallback, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import type CodeEditor from './CodeEditor'
import type { CodeEditorProps } from './CodeEditor'
import { useIsDark } from './useIsDark'
import { asText, invalid, type ControlProps } from './types'

export interface CodeParamProps extends ControlProps<'code', string> {
  /** Accessible name for the editor surface once CodeMirror has loaded. Defaults to `spec.label`. */
  label?: string
}

/** Plain textarea standing in for CodeMirror: while its chunk loads, and for good if it cannot. */
function PlainCodeArea({ id, value, onChange, placeholder, invalid: bad, describedBy, initialFocus, textareaRef }:
  CodeEditorProps & { textareaRef?: MutableRefObject<HTMLTextAreaElement | null> }) {
  const own = useRef<HTMLTextAreaElement | null>(null)
  const [handoff] = useState(() => initialFocus?.() ?? null)
  useLayoutEffect(() => {
    if (!handoff || !own.current) return
    own.current.focus()
    own.current.setSelectionRange(Math.min(handoff.anchor, handoff.head), Math.max(handoff.anchor, handoff.head))
  }, [handoff])
  const setRef = (el: HTMLTextAreaElement | null) => {
    own.current = el
    if (textareaRef) textareaRef.current = el
  }
  return (
    <textarea
      ref={setRef}
      id={id}
      className="field min-w-0 resize-y bg-canvas font-mono text-[12.5px] leading-[19px]"
      rows={8}
      spellCheck={false}
      placeholder={placeholder}
      value={value}
      aria-invalid={bad || undefined}
      aria-describedby={describedBy}
      onChange={e => onChange(e.target.value)}
    />
  )
}

// A failed chunk fetch (offline, or a stale tab after a deploy) degrades to the plain
// textarea instead of throwing to the nearest error boundary and blanking the page.
const LazyCodeEditor = lazy(() =>
  import('./CodeEditor').catch(() => ({ default: PlainCodeArea as typeof CodeEditor })),
)

/**
 * Loads CodeMirror only once a code param actually renders. The Suspense
 * fallback is a plain textarea bound to the same value/onChange, so a
 * keystroke typed before the editor chunk arrives is never lost — and if the
 * textarea has focus when the editor replaces it, focus and caret move across.
 */
export default function CodeParam({ id, spec, value, onChange, error, describedBy, label }: CodeParamProps) {
  const dark = useIsDark()
  const text = asText(value)
  const fallbackRef = useRef<HTMLTextAreaElement | null>(null)

  // Read while the editor renders for the first time — the fallback is still mounted then.
  const initialFocus = useCallback(() => {
    const el = fallbackRef.current
    if (!el || typeof document === 'undefined' || document.activeElement !== el) return null
    const back = el.selectionDirection === 'backward'
    return { anchor: back ? el.selectionEnd : el.selectionStart, head: back ? el.selectionStart : el.selectionEnd }
  }, [])

  const common: CodeEditorProps = {
    id,
    label: label ?? spec.label,
    value: text,
    onChange,
    language: spec.language,
    placeholder: spec.placeholder,
    dark,
    invalid: !!invalid(error),
    describedBy,
  }

  return (
    <Suspense fallback={<PlainCodeArea {...common} textareaRef={fallbackRef} />}>
      <LazyCodeEditor {...common} initialFocus={initialFocus} />
    </Suspense>
  )
}
