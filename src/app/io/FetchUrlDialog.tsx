import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Value } from '@/types/utility'
import { fetchAsInput } from './fetchInput'

export interface FetchedMeta {
  /** The final URL the body came from (after redirects). */
  url: string
  contentType: string | null
}

export interface FetchUrlDialogProps {
  open: boolean
  onClose: () => void
  onFetched: (value: Value, meta: FetchedMeta) => void
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

const draggingFiles = (dt: DataTransfer | null) => !!dt && Array.from(dt.types ?? []).includes('Files')

/** Accessible modal for "fetch a URL as input": focus trap, Escape to close, aborts its request on close. */
export default function FetchUrlDialog({ open, onClose, onFetched }: FetchUrlDialogProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Adjust state during render on the open->close transition (React's documented pattern for
  // resetting state on a prop change) rather than a setState call inside an effect: an aborted
  // request must not leave `loading` stuck, and a reopened dialog must not show the old error.
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      if (loading) setLoading(false)
      if (error) setError(null)
    }
  }

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement
      const t = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
    abortRef.current?.abort()
    abortRef.current = null
    ;(openerRef.current as HTMLElement | null)?.focus?.()
    return undefined
  }, [open])

  // unmounting while a request is in flight is a close too
  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Tab') {
        // disabled controls are skipped by the browser, so they must not be the trap's ends
        const list = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
        if (list.length === 0) return
        const first = list[0]
        const last = list[list.length - 1]
        const inside = dialogRef.current?.contains(document.activeElement)
        if (e.shiftKey && (document.activeElement === first || !inside)) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && (document.activeElement === last || !inside)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // a resubmit (Enter while loading) supersedes the request in flight
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setError(null)
    setLoading(true)
    try {
      const { value, contentType, finalUrl } = await fetchAsInput(url, { signal: ac.signal })
      if (ac.signal.aborted) return
      onFetched(value, { url: finalUrl, contentType })
      setUrl('')
      onClose()
    } catch (err) {
      if (ac.signal.aborted) return
      setError(err instanceof Error ? err.message : 'fetch failed')
    } finally {
      if (!ac.signal.aborted) setLoading(false)
      if (abortRef.current === ac) abortRef.current = null
    }
  }

  // Portalled to <body>: an ancestor with a transform or backdrop-filter (the tool's `.glass` hero)
  // would otherwise become the containing block of this `fixed` overlay and clip it.
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      // a file dropped on the modal must neither load as input nor make the browser open it
      // (a dragged link or text still drops into the URL field normally)
      onDragOver={e => { if (draggingFiles(e.dataTransfer)) { e.preventDefault(); e.dataTransfer.dropEffect = 'none' } }}
      onDrop={e => { if (draggingFiles(e.dataTransfer)) e.preventDefault() }}
    >
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="fetch-url-title" className="card p-4 w-full max-w-md grid gap-3">
        <h2 id="fetch-url-title" className="font-semibold">Fetch URL as input</h2>
        <form onSubmit={submit} className="grid gap-2" aria-busy={loading}>
          <label className="muted" htmlFor="fetch-url-input">URL</label>
          <input
            id="fetch-url-input"
            ref={inputRef}
            className="field"
            type="url"
            inputMode="url"
            placeholder="https://example.com/data.json"
            value={url}
            onChange={e => setUrl(e.target.value)}
            required
          />
          <p className="muted text-xs">Sites that block cross-origin requests are fetched through this site&apos;s proxy (5 MB max).</p>
          {error && <div role="alert" className="text-sm text-danger">{error}</div>}
          <span role="status" className="sr-only">{loading ? 'fetching…' : ''}</span>
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" className="btn" onClick={onClose}>cancel</button>
            <button type="submit" className="cta" disabled={loading}>{loading ? 'fetching…' : 'fetch'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
