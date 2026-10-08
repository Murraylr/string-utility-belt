import React from 'react'

/**
 * The sponsor slot's layout, shared by a paid `SponsorBlock` and our own `HousePromo` so
 * both look and read the same: a label (read first; on its own line on narrow screens,
 * to the right from sm up) with a link to /advertise/, then a 48px mark, a bold name and
 * one line of text, all one link that opens in a new tab. Free of browser APIs: the
 * pre-render uses it too.
 */
export default function Slot({ label, mark, name, text, href, rel, onFollow, className, data }: {
  /** What the block is: "Sponsor" for a paid booking, never for our own products. */
  label: string
  /** The 48×48 mark: an `<img>` or an icon. */
  mark: React.ReactNode
  name: string
  text: string
  href: string
  rel: string
  onFollow?: () => void
  className?: string
  /** `data-*` attributes identifying what is shown. */
  data: Record<`data-${string}`, string>
}) {
  return (
    <aside className={className ? `sponsor ${className}` : 'sponsor'} aria-label={label} {...data}>
      <span className="sponsor-label">{label} · <a href="/advertise/">Advertise</a></span>
      <a className="sponsor-link" href={href} rel={rel} target="_blank" onClick={onFollow}>
        {mark}
        <span><strong>{name}</strong> — {text} <span className="sr-only">(opens in a new tab)</span></span>
      </a>
    </aside>
  )
}
