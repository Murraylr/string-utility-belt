import React from 'react'
import { track } from '@/app/analytics/analytics'
import SponsorBlock from './SponsorBlock'
import { pageKey, sponsorFor, utcDay, type SponsorPage, type Sponsorship } from './sponsors'
import { SPONSORSHIPS } from './sponsorships'

/** The page's sponsor today, if it has one, reporting clicks on its link (ids only). */
export default function PageSponsor({ page, className, sponsorships = SPONSORSHIPS }: {
  page: SponsorPage
  className?: string
  /** For tests; defaults to the booked `SPONSORSHIPS`. */
  sponsorships?: readonly Sponsorship[]
}) {
  const s = sponsorFor(page, utcDay(new Date()), sponsorships)
  if (!s) return null
  const onFollow = () => track('sponsor_click', { sponsorship_id: s.id, sponsor_page: pageKey(page) })
  return <SponsorBlock sponsorship={s} page={page} onFollow={onFollow} className={className} />
}
