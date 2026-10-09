import React from 'react'
import Slot from './Slot'
import { LOGO_DIR, sponsoredHref, type SponsorPage, type Sponsorship } from './sponsors'

/**
 * One sponsorship, as /advertise/ sells it: labelled "Sponsor", with the sponsor's logo
 * (served by us), name, one line of text and a plain `rel="sponsored"` link. No script,
 * pixel or cookie of the sponsor's ever runs. Rendered by the app (`PageSponsor`) and by
 * the pre-render (`scripts/seo/content.ts`), so both show the same markup.
 */
export default function SponsorBlock({ sponsorship: s, page, onFollow, className }: {
  sponsorship: Sponsorship
  page: SponsorPage
  /** Layout classes for the block, e.g. spacing in the column it sits in. */
  className?: string
  /** Called when the visitor follows the sponsor's link (the app counts it; the pre-render has none). */
  onFollow?: () => void
}) {
  return (
    <Slot
      label="Sponsor"
      mark={<img className="sponsor-logo" src={`${LOGO_DIR}${s.logo}`} alt="" width={48} height={48} decoding="async" />}
      name={s.name}
      text={s.text}
      href={sponsoredHref(s, page)}
      rel="sponsored noopener"
      onFollow={onFollow}
      className={className}
      data={{ 'data-sponsorship': s.id }}
    />
  )
}
