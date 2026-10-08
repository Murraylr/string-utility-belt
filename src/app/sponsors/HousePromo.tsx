import React from 'react'
import { track } from '@/app/analytics/analytics'
import { useExtensionStatus } from '@/app/extension/bridge'
import { canInstallExtension } from '@/app/extension/installable'
import { ChromeIcon, VsCodeIcon } from '@/app/integrations/icons'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
import { usePref } from '@/app/prefs'
import Slot from './Slot'
import { PROMOS, choosePromo, type PromoId } from './promos'
import { pageKey, type SponsorPage } from './sponsors'

const ICONS: Record<PromoId, typeof ChromeIcon> = { chrome: ChromeIcon, vscode: VsCodeIcon }

/**
 * Our own extension in the sponsor slot of a page no sponsor has booked. Labelled as
 * ours — never "Sponsor" — and hidden on phones, which can install neither extension.
 * App-only (the pre-render cannot know the visitor's browser), and silent while the
 * browser extension is still answering, so it never flips from one promo to the other.
 */
export default function HousePromo({ page, className }: { page: SponsorPage; className?: string }) {
  const status = useExtensionStatus()
  const [, setIntegrationsSeen] = usePref(INTEGRATIONS_SEEN_PREF, false)
  if (status === 'checking') return null
  const id = choosePromo(page, status === 'absent' && canInstallExtension())
  const promo = PROMOS[id]
  const Icon = ICONS[id]
  const onFollow = () => {
    track('integration_click', { integration: id, source: 'promo', sponsor_page: pageKey(page) })
    setIntegrationsSeen(true)
  }
  return (
    <Slot
      label="From String Utility Belt"
      mark={<span className="sponsor-logo sponsor-mark"><Icon size={26} /></span>}
      name={promo.name}
      text={promo.text}
      href={promo.href}
      rel="noopener"
      onFollow={onFollow}
      className={className ? `hidden sm:flex ${className}` : 'hidden sm:flex'}
      data={{ 'data-promo': id }}
    />
  )
}
