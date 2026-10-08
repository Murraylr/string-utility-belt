import React from 'react'
import { track } from '@/app/analytics/analytics'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
import { usePref } from '@/app/prefs'
import ExtraPromo from './ExtraPromo'
import { promoPlan, type ExtraSlot, type PromoPage } from './promos'
import { pageKey } from './sponsors'

/**
 * The tool `promoPlan` gives this page's `slot`, or nothing when the plan leaves it empty.
 * A click is an `integration_click` from `promo_<slot>`, so reports tell the slots apart
 * from the sponsor slot's `promo` without a new parameter.
 */
export default function PagePromo({ page, slot, className }: { page: PromoPage; slot: ExtraSlot; className?: string }) {
  const [, setIntegrationsSeen] = usePref(INTEGRATIONS_SEEN_PREF, false)
  const id = promoPlan(page)[slot]
  if (!id) return null
  const onFollow = () => {
    track('integration_click', {
      integration: id,
      source: `promo_${slot}`,
      ...(page.kind === 'index' ? {} : { sponsor_page: pageKey(page) }),
    })
    setIntegrationsSeen(true)
  }
  return <ExtraPromo id={id} slot={slot} onFollow={onFollow} className={className} />
}
