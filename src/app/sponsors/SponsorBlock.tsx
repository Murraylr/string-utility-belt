import React from 'react'
import { LOGO_DIR, sponsoredHref, type SponsorPage, type Sponsorship } from './sponsors'

/**
 * One sponsorship, as /advertise/ sells it: a labelled block with the sponsor's logo
 * (served by us), name, one line of text and a plain link. No script, pixel or cookie
 * of the sponsor's ever runs. Rendered by the app (`PageSponsor`) and by the
 * pre-render (`scripts/seo/content.ts`), so both show the same markup; keep it free of
 * browser APIs.
 */
export default function SponsorBlock({ sponsorship: s, page, onFollow, className }: {
  sponsorship: Sponsorship
  page: SponsorPage
  /** Layout classes for the block, e.g. spacing in the column it sits in. */
  className?: string
  /** Called when the visitor follows the sponsor's link (the app reports it; the pre-render has none). */
  onFollow?: () => void
}) {
  return (
    <aside className={className ? `sponsor ${className}` : 'sponsor'} aria-label="Sponsor" data-sponsorship={s.id}>
      {/* first, so it is read first; on its own line on narrow screens, to the right from sm up */}
      <span className="sponsor-label">Sponsor · <a href="/advertise/">Advertise</a></span>
      <a className="sponsor-link" href={sponsoredHref(s, page)} rel="sponsored noopener" target="_blank" onClick={onFollow}>
        <img className="sponsor-logo" src={`${LOGO_DIR}${s.logo}`} alt="" width={48} height={48} decoding="async" />
        <span><strong>{s.name}</strong> — {s.text} <span className="sr-only">(opens in a new tab)</span></span>
      </a>
    </aside>
  )
}
