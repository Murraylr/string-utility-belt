import React from 'react'
import { countEvent } from '@/app/events/countEvent'
import { useExtensionStatus } from '@/app/extension/bridge'
import { canInstallExtension } from '@/app/extension/installable'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
import { usePref } from '@/app/prefs'
import PromoBlock from './PromoBlock'
import { choosePromo, fixedPromo } from './promos'
import type { SponsorPage } from './sponsors'

/**
 * Our own tool in the sponsor slot of a page no sponsor has booked (`PromoBlock`).
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
    countEvent({ name: 'integration_click', integration: id, source: 'promo' })
    setIntegrationsSeen(true)
  }
  return <PromoBlock id={id} onFollow={onFollow} className={className} />
}
