import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import { invalid, type ControlProps } from './types'

/**
 * Loaded content lives in the step's params, which are persisted to localStorage on every
 * change and can be put in share links — past a few MB that fails or freezes the tab.
 */
export const MAX_FILE_BYTES = 5 * 1024 * 1024

function readFile(file: File, as: 'text' | 'base64'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (as !== 'base64') return resolve(result)
      // strip the `data:…;base64,` prefix; an empty file can come back as a bare `data:`
      const comma = result.indexOf(',')
      resolve(comma === -1 ? '' : result.slice(comma + 1))
    }
    if (as === 'base64') reader.readAsDataURL(file)
    else reader.readAsText(file)
  })
}

const humanSize = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

type Status =
  | { kind: 'loaded'; name: string; size: number; content: string }
  | { kind: 'loading'; name: string }
  | { kind: 'error'; message: string }

/** Textarea holding the loaded content, a picker button, and a drop target on the whole control. */
export default function FileParam({ id, spec, value, onChange, error, describedBy }: ControlProps<'file', string>) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [dragging, setDragging] = useState(false)
  // Each read gets a ticket; only the newest may write, and none after unmount.
  const ticket = useRef(0)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  // A read finishes after later renders; the onChange captured when it started would
  // write back a stale snapshot of the sibling params, undoing edits made meanwhile.
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => { onChangeRef.current = onChange })

  const load = async (file: File | undefined | null) => {
    if (!file) return
    const mine = ++ticket.current
    if (file.size > MAX_FILE_BYTES) {
      setStatus({ kind: 'error', message: `${file.name} is too large (${humanSize(file.size)}; limit ${humanSize(MAX_FILE_BYTES)})` })
      return
    }
    setStatus({ kind: 'loading', name: file.name })
    try {
      const content = await readFile(file, spec.as ?? 'text')
      if (ticket.current !== mine || !mounted.current) return
      setStatus({ kind: 'loaded', name: file.name, size: file.size, content })
      onChangeRef.current(content)
    } catch {
      if (ticket.current !== mine || !mounted.current) return
      setStatus({ kind: 'error', message: `could not read ${file.name}` })
    }
  }

  // The file name describes the content only until it is edited or replaced from elsewhere
  // (undo, paste) — adjusted while rendering, the way React recommends for derived resets.
  const [seenValue, setSeenValue] = useState(value)
  if (value !== seenValue) {
    setSeenValue(value)
    if (status?.kind === 'loaded' && status.content !== value) setStatus(null)
  }

  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md ${dragging ? 'outline-2 outline-dashed outline-acc outline-offset-2' : ''}`}
      onDragOver={e => { if (hasFiles(e)) { e.preventDefault(); setDragging(true) } }}
      onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false) }}
      onDrop={e => {
        setDragging(false)
        if (!hasFiles(e)) return
        e.preventDefault()
        void load(e.dataTransfer.files?.[0])
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn h-[26px] text-[12.5px]"
          aria-label={`Load file for ${spec.label}`}
          onClick={() => inputRef.current?.click()}
        >
          Load file…
        </button>
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept={spec.accept}
          aria-hidden="true"
          tabIndex={-1}
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = '' // so picking the same file again still fires `change`
            void load(file)
          }}
        />
        <span role="status" className={`text-[11.5px] ${status?.kind === 'error' ? 'text-danger-ink' : 'text-muted'}`}>
          {status?.kind === 'loaded' && `${status.name} (${humanSize(status.size)})`}
          {status?.kind === 'loading' && `reading ${status.name}…`}
          {status?.kind === 'error' && status.message}
        </span>
      </div>
      <textarea
        id={id}
        className="field min-w-0 resize-y bg-canvas font-mono text-[12.5px] leading-[19px]"
        rows={6}
        placeholder={spec.placeholder ?? 'paste, drop a file here, or load one'}
        spellCheck={false}
        value={value}
        aria-invalid={invalid(error)}
        aria-describedby={describedBy}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}
