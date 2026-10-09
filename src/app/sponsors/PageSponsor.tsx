import React from 'react'
import { countEvent } from '@/app/events/countEvent'
import HousePromo from './HousePromo'
import SponsorBlock from './SponsorBlock'
import { pageKey, sponsorFor, utcDay, type SponsorPage, type Sponsorship } from './sponsors'
import { SPONSORSHIPS } from './sponsorships'

/**
 * The page's sponsor slot: today's sponsor, counting clicks on its link (booking and page
 * only), or, while no one has booked the page, one of our own tools (`HousePromo`).
 */
export default function PageSponsor({ page, className, sponsorships = SPONSORSHIPS }: {
  page: SponsorPage
  className?: string
  /** For tests; defaults to the booked `SPONSORSHIPS`. */
  sponsorships?: readonly Sponsorship[]
}) {
  const s = sponsorFor(page, utcDay(new Date()), sponsorships)
  if (!s) return <HousePromo page={page} className={className} />
  const onFollow = () => countEvent({ name: 'sponsor_click', sponsorship: s.id, page: pageKey(page) })
  return <SponsorBlock sponsorship={s} page={page} onFollow={onFollow} className={className} />
}
