import React from 'react'
import { countEvent } from '@/app/events/countEvent'
import { useExtensionStatus } from '@/app/extension/bridge'
import { canInstallExtension } from '@/app/extension/installable'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
import { usePref } from '@/app/prefs'
import PromoBlock from './PromoBlock'
import type { PromoId } from './promos'

/**
 * One of our own tools under the pipeline editor's output: the browser extension where this
 * browser can install it and doesn't have it, else the VS Code extension. House-only by
 * design — no sponsor's content ever sits beside what people paste into the editor — and,
 * like every promo, hidden on phones. Nothing while the extension is still answering, so it
 * never flips from one tool to the other.
 */
export default function ToolPromo({ className }: { className?: string }) {
  const status = useExtensionStatus()
  const [, setIntegrationsSeen] = usePref(INTEGRATIONS_SEEN_PREF, false)
  if (status === 'checking') return null
  const id: PromoId = status === 'absent' && canInstallExtension() ? 'chrome' : 'vscode'
  const onFollow = () => {
    countEvent({ name: 'integration_click', integration: id, source: 'promo_tool' })
    setIntegrationsSeen(true)
  }
  return <PromoBlock id={id} onFollow={onFollow} className={className} />
}
