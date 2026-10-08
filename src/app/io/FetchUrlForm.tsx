import React, { useEffect, useRef, useState } from 'react'
import type { Value } from '@/types/utility'
import { fetchAsInput } from './fetchInput'

export interface FetchedMeta {
  /** The final URL the body came from (after redirects). */
  url: string
  contentType: string | null
}

export interface FetchUrlFormProps {
  /** The URL field's value, kept by the panel so it survives closing the row. */
  url: string
  onUrlChange: (url: string) => void
  onFetched: (value: Value, meta: FetchedMeta) => void
  /** A failed fetch's message, or null when a new attempt starts. */
  onError: (message: string | null) => void
  /** Escape or Cancel: the row should close. */
  onCancel: () => void
}

/**
 * The inline "fetch a URL as input" row under the input panel's header. It is mounted only while
 * open: it focuses its field on mount, and unmounting aborts the request in flight.
 */
export default function FetchUrlForm({ url, onUrlChange, onFetched, onError, onCancel }: FetchUrlFormProps) {
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    return () => abortRef.current?.abort()
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    // a resubmit supersedes the request in flight
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    onError(null)
    setLoading(true)
    try {
      const { value, contentType, finalUrl } = await fetchAsInput(url, { signal: ac.signal })
      if (ac.signal.aborted) return
      onFetched(value, { url: finalUrl, contentType })
    } catch (err) {
      if (ac.signal.aborted) return
      onError(err instanceof Error ? err.message : 'fetch failed')
    } finally {
      if (!ac.signal.aborted) setLoading(false)
      if (abortRef.current === ac) abortRef.current = null
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Escape') return
    e.preventDefault()
    // this Escape belongs to the row: the page's own Escape handlers must not also act on it
    e.stopPropagation()
    onCancel()
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={onKeyDown}
      // a pasted file belongs in neither the URL field nor the input: keep it from the panel's paste handler
      onPaste={e => e.stopPropagation()}
      aria-busy={loading}
      className="m-0 flex flex-wrap gap-1.5 px-2.5 py-2 border-b bg-surface-2"
    >
      <input
        ref={inputRef}
        className="field h-[30px] flex-1 min-w-0 basis-40 font-mono text-[12.5px]"
        type="url"
        inputMode="url"
        aria-label="URL to fetch"
        aria-describedby="fetch-url-hint"
        placeholder="https://example.com/data.json"
        value={url}
        onChange={e => onUrlChange(e.target.value)}
        required
      />
      <div className="flex gap-1.5 ml-auto">
        {loading && <button type="button" className="btn h-[30px]" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="btn-inv h-[30px] px-3" disabled={loading}>{loading ? 'Fetching…' : 'Fetch'}</button>
      </div>
      <p id="fetch-url-hint" className="m-0 basis-full text-[11.5px] text-muted">If a site blocks requests from other pages, we fetch it through this site&apos;s proxy. 5 MB max.</p>
      <span role="status" className="sr-only">{loading ? 'Fetching…' : ''}</span>
    </form>
  )
}
