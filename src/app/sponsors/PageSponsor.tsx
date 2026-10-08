import React from 'react'
import { track } from '@/app/analytics/analytics'
import HousePromo from './HousePromo'
import SponsorBlock from './SponsorBlock'
import { pageKey, sponsorFor, utcDay, type SponsorPage, type Sponsorship } from './sponsors'
import { SPONSORSHIPS } from './sponsorships'

/**
 * The page's sponsor slot: today's sponsor, reporting clicks on its link (ids only), or —
 * while no one has booked the page — our own extension (`HousePromo`).
 */
export default function PageSponsor({ page, className, sponsorships = SPONSORSHIPS }: {
  page: SponsorPage
  className?: string
  /** For tests; defaults to the booked `SPONSORSHIPS`. */
  sponsorships?: readonly Sponsorship[]
}) {
  const s = sponsorFor(page, utcDay(new Date()), sponsorships)
  if (!s) return <HousePromo page={page} className={className} />
  const onFollow = () => track('sponsor_click', { sponsorship_id: s.id, sponsor_page: pageKey(page) })
  return <SponsorBlock sponsorship={s} page={page} onFollow={onFollow} className={className} />
}
