import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
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

  const copyLabel = (idle: string) => copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Copy failed' : idle
  const CopyIcon = copyStatus === 'copied' ? Check : Copy
  const textareaClass = 'w-full min-h-24 resize-y px-2.5 py-[9px] border rounded-md bg-canvas font-mono text-[11.5px] leading-[17px] wrap-anywhere outline-hidden focus:border-acc'

  return (
    <Dialog title="Share pipeline" widthClass="max-w-[540px]" onClose={onClose} returnFocus={returnFocus}>
      <Tabs label="share format" tabs={TABS} value={tab} onChange={setTab} panelId="share-panel" idPrefix="share-tab" />

      <label className="flex items-center gap-2 text-[13px] cursor-pointer has-[:disabled]:cursor-default">
        <input type="checkbox" className="accent-acc" checked={includeInput} disabled={bytesInput} onChange={e => setIncludeInput(e.target.checked)} />
        Include my input
      </label>
      {bytesInput && (
        <p className="m-0 text-xs text-muted">Binary input can&apos;t be shared, because links carry text only. The steps are still included.</p>
      )}

      {tab === 'link' ? (
        <div id="share-panel" role="tabpanel" aria-labelledby="share-tab-link" className="grid gap-3">
          <label className="sr-only" htmlFor="share-url">link</label>
          <textarea id="share-url" readOnly className={textareaClass} value={shareUrl} onFocus={e => e.currentTarget.select()} />
          <div className="flex flex-wrap items-center gap-2.5">
            <button className="btn-inv h-[30px] px-3" onClick={() => copy(shareUrl, () => trackShare('share_link_copy'))}>
              <CopyIcon size={13} aria-hidden />{copyLabel('Copy link')}
            </button>
            <span className="font-mono text-[11px] text-muted">{shareUrl.length.toLocaleString()} characters</span>
          </div>
          {shareUrl.length > WARN_LENGTH && (
            <p role="alert" className="m-0 text-[12.5px] text-warn">
              This link is quite long. Chat apps and older browsers can cut off long links. Try leaving the input out, or
              download the .json instead.
            </p>
          )}
        </div>
      ) : (
        <div id="share-panel" role="tabpanel" aria-labelledby="share-tab-embed" className="grid gap-3">
          <label className="sr-only" htmlFor="embed-snippet">embed snippet</label>
          <textarea id="embed-snippet" readOnly className={textareaClass} value={embedSnippet} onFocus={e => e.currentTarget.select()} />
          <div className="flex flex-wrap items-center gap-2.5">
            <button className="btn-inv h-[30px] px-3" onClick={() => copy(embedSnippet, () => trackShare('embed_code_copy'))}>
              <CopyIcon size={13} aria-hidden />{copyLabel('Copy snippet')}
            </button>
            <span className="font-mono text-[11px] text-muted">{embedSnippet.length.toLocaleString()} characters</span>
          </div>
        </div>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {copyStatus === 'copied'
          ? `${tab === 'link' ? 'link' : 'embed snippet'} copied to clipboard`
          : copyStatus === 'error' ? 'copy failed. Select the text and copy it yourself.' : ''}
      </span>

      <div className="pt-3 border-t">
        <button className="btn h-[30px] px-2.5" onClick={downloadJson}>Download .json</button>
      </div>
    </Dialog>
  )
}
