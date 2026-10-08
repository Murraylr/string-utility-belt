import React from 'react'

/**
 * The sponsor slot's layout, shared by a paid `SponsorBlock` and our own `PromoBlock` so
 * both look and read the same: a label row (what the block is, and a link to
 * /advertise/), then a 48px mark beside a bold name and one line of text, all one link —
 * to another site in a new tab, to a page of this one in place. Free of browser APIs:
 * the pre-render uses it too.
 */
export default function Slot({ label, mark, name, text, href, rel, newTab = true, onFollow, className, data }: {
  /** What the block is: "Sponsor" for a paid booking, never for our own products. */
  label: string
  /** The 48×48 mark: an `<img>` or an icon. */
  mark: React.ReactNode
  name: string
  text: string
  href: string
  rel?: string
  /** Open in a new tab (another site). False for a page of this site, which then opens in place. */
  newTab?: boolean
  onFollow?: () => void
  className?: string
  /** `data-*` attributes identifying what is shown. */
  data: Record<`data-${string}`, string>
}) {
  return (
    <aside className={className ? `sponsor ${className}` : 'sponsor'} aria-label={label} {...data}>
      <span className="sponsor-label"><span>{label}</span><a href="/advertise/">Advertise here</a></span>
      {/* name and text sit on two lines; the accessible name joins them into one phrase */}
      <a className="sponsor-link" href={href} rel={rel} target={newTab ? '_blank' : undefined} onClick={onFollow}
        aria-label={`${name} — ${text}${newTab ? ' (opens in a new tab)' : ''}`}>
        {mark}
        <span className="grid gap-0.5 min-w-0">
          <span className="sponsor-name">{name}</span>
          <span className="sponsor-text">{text}</span>
        </span>
      </a>
    </aside>
  )
}
