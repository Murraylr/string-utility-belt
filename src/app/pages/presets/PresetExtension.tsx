import React, { useState } from 'react'
import { Puzzle } from 'lucide-react'
import { unknownStepTypes, type BridgeResult } from '@/core/extensionBridge'
import type { PipelineStep } from '@/types/utility'
import { usePref } from '@/app/prefs'
import { countEvent } from '@/app/events/countEvent'
import { sendToExtension, useExtensionStatus } from '@/app/extension/bridge'
import { canInstallExtension } from '@/app/extension/installable'
import { ChromeIcon } from '@/app/integrations/icons'
import { CHROME_WEB_STORE_URL, INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'

interface Props {
  steps: PipelineStep[]
  /** Saved under this name: the extension's right-click menu shows it. */
  name: string
}

const HEADING = 'Use this preset on any web page'

/** The strip's layout in both states: the pitch on the left, the action and its status on the right. */
function Strip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t">
      <div className="grid gap-0.5 max-w-xl">
        <p className="m-0 text-[13.5px] font-semibold">{HEADING}</p>
        <p className="m-0 text-[12.5px] text-muted text-pretty">{text}</p>
      </div>
      {/* capped, so a status message wraps under the action instead of pushing it below the pitch */}
      <div className="grid gap-1 justify-items-start sm:justify-items-end sm:text-right sm:max-w-xs">{children}</div>
    </div>
  )
}

function SavePreset({ steps, name, stepTypes }: Props & { stepTypes: readonly string[] }) {
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BridgeResult | null>(null)
  // an extension that predates one of the preset's step types would drop those steps while saving
  const outdated = unknownStepTypes(steps, stepTypes).length > 0

  const save = async () => {
    setBusy(true)
    setResult(null)
    const answer = await sendToExtension({ type: 'save-pipeline', name, steps })
    setBusy(false)
    setResult(answer)
  }

  return (
    <Strip text="Save it to your String Utility Belt extension, then select text on any page and run this preset from the right-click menu.">
      <button type="button" className="btn" disabled={busy || outdated} onClick={() => void save()}>
        <Puzzle size={16} aria-hidden /> Save to extension
      </button>
      {/* always mounted: text injected together with a brand-new live region is not reliably announced */}
      <p role="status" className={`m-0 text-xs ${outdated || (result && !result.ok) ? 'text-warn' : 'text-muted'}`}>
        {outdated
          ? 'This preset needs a newer version of the extension. Update it, then reload this page.'
          : busy ? 'Saving…' : result ? (result.ok ? result.message : result.error) : ''}
      </p>
    </Strip>
  )
}

function GetExtension() {
  const [, setIntegrationsSeen] = usePref(INTEGRATIONS_SEEN_PREF, false)
  const [followed, setFollowed] = useState(false)

  const onClick = () => {
    countEvent({ name: 'integration_click', integration: 'chrome', source: 'preset' })
    setIntegrationsSeen(true)
    setFollowed(true)
  }

  return (
    <Strip text="Select text on any page, right-click, and run this preset on it with the free String Utility Belt browser extension. It runs on your device: your text never leaves the browser.">
      <a className="btn" href={CHROME_WEB_STORE_URL} target="_blank" rel="noopener" onClick={onClick}>
        <ChromeIcon size={16} className="shrink-0" /> Get the free extension
        <span className="sr-only"> (opens the Chrome Web Store in a new tab)</span>
      </a>
      {/* the page can only reach an extension installed before it loaded */}
      <p role="status" className="m-0 text-xs text-muted">
        {followed ? 'Installed it? Reload this page to save this preset to it.' : ''}
      </p>
    </Strip>
  )
}

/**
 * The preset page's way into the browser extension: "Save to extension" once the extension
 * has answered, a link to its store listing when it is not installed and this browser could
 * install it, and nothing otherwise (still asking, or a browser with no Chrome Web Store).
 * Client-only: the pre-render has no extension to ask.
 */
export default function PresetExtension(props: Props) {
  const status = useExtensionStatus()
  if (status === 'checking') return null
  if (status === 'absent') return canInstallExtension() ? <GetExtension /> : null
  return <SavePreset {...props} stepTypes={status.stepTypes} />
}
