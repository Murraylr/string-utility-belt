import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

export type CodeLanguage = 'javascript' | 'json' | 'sql' | 'xml' | 'html' | 'yaml' | 'markdown'

/** One dynamic `import()` per language, so a pipeline that never shows SQL never fetches it. */
const loaders: Record<CodeLanguage, () => Promise<Extension>> = {
  javascript: async () => (await import('@codemirror/lang-javascript')).javascript({ jsx: true }),
  json: async () => (await import('@codemirror/lang-json')).json(),
  sql: async () => (await import('@codemirror/lang-sql')).sql(),
  xml: async () => (await import('@codemirror/lang-xml')).xml(),
  html: async () => (await import('@codemirror/lang-html')).html(),
  yaml: async () => (await import('@codemirror/lang-yaml')).yaml(),
  markdown: async () => (await import('@codemirror/lang-markdown')).markdown(),
}

const ALIASES: Record<string, CodeLanguage> = { js: 'javascript', jsx: 'javascript', yml: 'yaml', md: 'markdown', svg: 'xml' }

/** `undefined` means the default (JavaScript); a language we have no pack for gets plain text. */
function resolveLanguage(language: string | undefined): CodeLanguage | null {
  if (!language) return 'javascript'
  const l = language.toLowerCase()
  if (l in loaders) return l as CodeLanguage
  return ALIASES[l] ?? null
}

// Cached at module scope: two code params using the same language share one fetch.
// A failed fetch is forgotten so the next mount can retry.
const cache = new Map<CodeLanguage, Promise<Extension>>()
function loadLanguage(key: CodeLanguage): Promise<Extension> {
  let promise = cache.get(key)
  if (!promise) {
    promise = loaders[key]().catch(err => {
      cache.delete(key)
      throw err
    })
    cache.set(key, promise)
  }
  return promise
}

export interface CodeEditorProps {
  /** Put on the editable surface, so `<label htmlFor>` targets and `getElementById` find it. */
  id: string
  /** Accessible name of the editable surface (a contenteditable cannot be named by `<label>`). */
  label: string
  value: string
  onChange: (value: string) => void
  language?: string
  placeholder?: string
  dark?: boolean
  invalid?: boolean
  describedBy?: string
  /**
   * Called once, as the editor mounts: when it replaces a focused placeholder textarea,
   * returns that caret so typing continues in the editor instead of focus falling to `<body>`.
   */
  initialFocus?: () => { anchor: number; head: number } | null
}

/**
 * The real CodeMirror-backed editor. Only ever reached via `CodeParam`'s
 * `React.lazy`, which is what keeps `@uiw/react-codemirror` and every
 * `@codemirror/lang-*` package out of the app's entry chunk.
 */
export default function CodeEditor({
  id, label, value, onChange, language, placeholder, dark, invalid, describedBy, initialFocus,
}: CodeEditorProps) {
  const text = typeof value === 'string' ? value : value == null ? '' : String(value)
  const [handoff] = useState(() => {
    const at = initialFocus?.()
    if (!at) return null
    const clamp = (n: number) => Math.max(0, Math.min(n, text.length))
    return { anchor: clamp(at.anchor), head: clamp(at.head) }
  })

  const languageKey = resolveLanguage(language)
  const [loaded, setLoaded] = useState<{ key: CodeLanguage; ext: Extension } | null>(null)
  useEffect(() => {
    if (!languageKey) return
    let live = true
    // Highlighting is an enhancement: if the pack fails to load the editor still works.
    loadLanguage(languageKey).then(ext => { if (live) setLoaded({ key: languageKey, ext }) }, () => {})
    return () => { live = false }
  }, [languageKey])
  const languageExt = loaded && loaded.key === languageKey ? loaded.ext : null

  // @uiw/react-codemirror reconfigures the whole editor whenever `extensions` or
  // `onChange` change identity — so both must stay stable across keystrokes.
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => { onChangeRef.current = onChange })
  const handleChange = useCallback((v: string) => onChangeRef.current(v), [])

  // Tab indents here, so the way out has to be announced (WCAG 2.1.2): CodeMirror lets the
  // Tab that follows an Escape move focus as usual.
  const hintId = `${id}-keys`
  const extensions = useMemo(() => {
    const attrs: Record<string, string> = {
      id,
      'aria-label': label,
      'aria-describedby': [describedBy, hintId].filter(Boolean).join(' '),
    }
    if (invalid) attrs['aria-invalid'] = 'true'
    return [EditorView.contentAttributes.of(attrs), ...(languageExt ? [languageExt] : [])]
  }, [id, label, describedBy, hintId, invalid, languageExt])

  return (
    <div className="group flex flex-col gap-1">
      <div className="overflow-hidden rounded-xl border text-xs">
        <CodeMirror
          value={text}
          height="200px"
          theme={dark ? 'dark' : 'light'}
          placeholder={placeholder}
          extensions={extensions}
          onChange={handleChange}
          autoFocus={!!handoff}
          selection={handoff ?? undefined}
        />
      </div>
      <p id={hintId} className="sr-only text-xs text-muted group-focus-within:not-sr-only">
        Tab indents — press Escape, then Tab, to move focus out of the editor.
      </p>
    </div>
  )
}
