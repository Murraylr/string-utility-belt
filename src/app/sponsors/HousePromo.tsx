import React from 'react'
import { track } from '@/app/analytics/analytics'
import { useExtensionStatus } from '@/app/extension/bridge'
import { canInstallExtension } from '@/app/extension/installable'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
import { usePref } from '@/app/prefs'
import PromoBlock from './PromoBlock'
import { choosePromo, fixedPromo } from './promos'
import { pageKey, type SponsorPage } from './sponsors'

/**
 * Our own extension in the sponsor slot of a page no sponsor has booked (`PromoBlock`).
 * The browser extension only where this browser can install it and it has not answered;
 * while it is still answering, nothing — unless the page's promo does not depend on the
 * browser (`fixedPromo`), which the pre-render then shows too, so the page never shifts.
 */
export default function HousePromo({ page, className }: { page: SponsorPage; className?: string }) {
  const status = useExtensionStatus()
  const [, setIntegrationsSeen] = usePref(INTEGRATIONS_SEEN_PREF, false)
  const fixed = fixedPromo(page)
  if (!fixed && status === 'checking') return null
  const id = fixed ?? choosePromo(page, status === 'absent' && canInstallExtension())
  const onFollow = () => {
    track('integration_click', { integration: id, source: 'promo', sponsor_page: pageKey(page) })
    setIntegrationsSeen(true)
  }
  return <PromoBlock id={id} onFollow={onFollow} className={className} />
}
