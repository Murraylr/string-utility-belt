import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, ClipboardCopy } from 'lucide-react'
import { asText, isBytes } from '@/core/coerce'
import { encodeShare } from '@/core/serialize'
import type { PipelineDoc } from '@/types/utility'
import { useTool } from '@/app/ToolContext'
import Dialog from '@/app/library/Dialog'
import Tabs from '@/app/library/Tabs'
import { downloadText, safeFilename } from '@/app/library/download'
import { trackPipelineEvent } from '@/app/analytics/analytics'

/** Above this many characters a share link risks being truncated by chat apps, some browsers and old proxies. */
const WARN_LENGTH = 8000

type Tab = 'link' | 'embed'

/**
 * Sandbox for the embed snippet. `allow-popups-to-escape-sandbox` matters: without it
 * the "Open in String Utility Belt" tab inherits the iframe's sandbox and opens a
 * crippled app (no confirm dialogs, no downloads, no forms).
 */
export const EMBED_SANDBOX = 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox'

const TABS: { id: Tab; label: string }[] = [{ id: 'link', label: 'Link' }, { id: 'embed', label: 'Embed' }]

export interface ShareDialogProps {
  onClose: () => void
  /** Focus target on close when the dialog was not opened from a focused control. */
  returnFocus?: React.RefObject<HTMLElement | null>
}

export default function ShareDialog({ onClose, returnFocus }: ShareDialogProps) {
  const { state, input } = useTool()
  const [tab, setTab] = useState<Tab>('link')
  const [includeInput, setIncludeInput] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const bytesInput = isBytes(input)

  // the input only matters (and is only re-encoded) while it is being shared
  const sharedInput = includeInput && !bytesInput ? asText(input) : undefined
  const doc = useMemo<PipelineDoc>(() => {
    const base: PipelineDoc = { v: 2, steps: state.steps }
    if (state.name) base.name = state.name
    if (sharedInput !== undefined) base.input = sharedInput
    return base
  }, [state.steps, state.name, sharedInput])

  const payload = useMemo(() => encodeShare(doc), [doc])
  const origin = typeof location !== 'undefined' ? `${location.origin}${location.pathname}` : ''
  const shareUrl = `${origin}#/p/${payload}`
  const embedUrl = `${origin}#/embed/${payload}`
  const embedSnippet = `<iframe src="${embedUrl}" width="100%" height="420" title="String Utility Belt pipeline" loading="lazy" sandbox="${EMBED_SANDBOX}"></iframe>`

  useEffect(() => () => { if (statusTimer.current) clearTimeout(statusTimer.current) }, [])

  const announce = useCallback((status: 'copied' | 'error') => {
    setCopyStatus(status)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setCopyStatus('idle'), 1500)
  }, [])

  // what was shared, never the link itself (it carries the input when included)
  const trackShare = (event: string) =>
    trackPipelineEvent(event, state.steps, { include_input: sharedInput !== undefined ? 'yes' : 'no' })

  const copy = useCallback(async (text: string, onCopied: () => void) => {
    try {
      await navigator.clipboard.writeText(text)
      announce('copied')
    } catch {
      announce('error')
      return
    }
    onCopied()
  }, [announce])

  const downloadJson = () => {
    downloadText(`${safeFilename(state.name || '')}.json`, JSON.stringify(doc, null, 2))
    trackShare('share_json_download')
  }

  return (
    <Dialog title="Share pipeline" onClose={onClose} returnFocus={returnFocus}>
      <Tabs label="share format" tabs={TABS} value={tab} onChange={setTab} panelId="share-panel" idPrefix="share-tab" />

      <label className="text-sm flex items-center gap-2">
        <input type="checkbox" checked={includeInput} disabled={bytesInput} onChange={e => setIncludeInput(e.target.checked)} />
        Include my input
      </label>
      {bytesInput && (
        <div className="text-xs text-muted">binary input can&apos;t be shared in a link (links carry text only) — only the pipeline steps will be included.</div>
      )}

      {tab === 'link' ? (
        <div id="share-panel" role="tabpanel" aria-labelledby="share-tab-link" className="grid gap-2">
          <label className="muted" htmlFor="share-url">link</label>
          <textarea id="share-url" readOnly className="field mono text-xs min-h-[72px]" value={shareUrl} onFocus={e => e.currentTarget.select()} />
          <div className="text-xs text-muted">{shareUrl.length.toLocaleString()} characters</div>
          {shareUrl.length > WARN_LENGTH && (
            <div role="alert" className="text-sm text-warn">
              This link is quite long ({shareUrl.length.toLocaleString()} characters) — some chat apps and old browsers
              truncate very long URLs. Consider unchecking "include my input" or downloading the .json file instead.
            </div>
          )}
          <button className="btn justify-self-start" onClick={() => copy(shareUrl, () => trackShare('share_link_copy'))}>
            {copyStatus === 'copied' ? <Check size={16} /> : <ClipboardCopy size={16} />}
            {copyStatus === 'copied' ? 'copied' : copyStatus === 'error' ? 'copy failed' : 'copy link'}
          </button>
        </div>
      ) : (
        <div id="share-panel" role="tabpanel" aria-labelledby="share-tab-embed" className="grid gap-2">
          <label className="muted" htmlFor="embed-snippet">embed snippet</label>
          <textarea id="embed-snippet" readOnly className="field mono text-xs min-h-[96px]" value={embedSnippet} onFocus={e => e.currentTarget.select()} />
          <button className="btn justify-self-start" onClick={() => copy(embedSnippet, () => trackShare('embed_code_copy'))}>
            {copyStatus === 'copied' ? <Check size={16} /> : <ClipboardCopy size={16} />}
            {copyStatus === 'copied' ? 'copied' : copyStatus === 'error' ? 'copy failed' : 'copy snippet'}
          </button>
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {copyStatus === 'copied'
          ? `${tab === 'link' ? 'link' : 'embed snippet'} copied to clipboard`
          : copyStatus === 'error' ? 'copy failed — select the text and copy it manually' : ''}
      </span>

      <div className="pt-2 border-t">
        <button className="btn" onClick={downloadJson}>Download .json</button>
      </div>
    </Dialog>
  )
}
