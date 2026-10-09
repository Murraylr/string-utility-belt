import React from 'react'
import { INTEGRATIONS_SEEN_PREF } from '@/app/integrations/links'
import { usePref } from '@/app/prefs'
import ExtraPromo from './ExtraPromo'
import { promoPlan, type ExtraSlot, type PromoPage } from './promos'

/**
 * The tool `promoPlan` gives this page's `slot`, or nothing when the plan leaves it empty.
 * Following it marks the integrations seen, as the header's links do.
 */
export default function PagePromo({ page, slot, className }: { page: PromoPage; slot: ExtraSlot; className?: string }) {
  const [, setIntegrationsSeen] = usePref(INTEGRATIONS_SEEN_PREF, false)
  const id = promoPlan(page)[slot]
  if (!id) return null
  return <ExtraPromo id={id} slot={slot} onFollow={() => setIntegrationsSeen(true)} className={className} />
}
